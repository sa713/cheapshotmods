import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../apps/server/src/store.js';
import {Auth,issuer} from '../apps/server/src/auth.js';
import {LoginLimiter} from '../apps/server/src/login-limiter.js';
import {app} from '../apps/server/src/app.js';
import {config,initData,command} from './helpers.js';

test('bounded login windows and five-minute anonymous sessions; cleanup also runs without login',async()=>{
  const limiter=new LoginLimiter();
  for(let i=0;i<20;i++)limiter.check('same',1000);
  assert.throws(()=>limiter.check('same',1000),/LOGIN_RATE_LIMIT/);
  for(let i=0;i<80;i++)limiter.check('different-'+i,1000);
  assert.throws(()=>limiter.check('new',1000),/LOGIN_RATE_LIMIT/);
  limiter.check('same',60000);
  const s=new Store(':memory:'),a=new Auth(s,config);
  try {
    const start=a.start(),row=s.session(a.hash(start.raw),Math.floor(Date.now()/1000))!;
    assert.ok(row.expires<=Math.floor(Date.now()/1000)+300);
    s.db.prepare('UPDATE sessions SET expires=1').run();
    const f=await app(s,config);
    assert.equal((s.db.prepare('SELECT count(*) AS n FROM sessions').get() as {n:number}).n,0);
    for(let i=0;i<20;i++)assert.equal((await f.inject('/auth/oidc/start')).statusCode,302);
    const r=await f.inject('/auth/oidc/start');assert.equal(r.statusCode,429);assert.equal(r.headers['retry-after'],'60');
    assert.equal((s.db.prepare('SELECT count(*) AS n FROM sessions').get() as {n:number}).n,20);
    await f.close();
  } finally{s.close();}
});
test('retired command receipts reject old retries permanently without applying or losing newer state',()=>{
  const s=new Store(':memory:');
  try {
    const state=s.summary('111'),old={key:randomUUID(),revision:state.revision,experiment:state.experiment,action:{type:'level',value:'200'}};
    const original=s.command('111',old);assert.deepEqual(s.command('111',old),original);
    s.db.prepare('UPDATE commands SET created=1').run();s.maintain();
    const compact=s.db.prepare('SELECT payload,result FROM commands').get() as {payload:string;result:string};
    assert.match(compact.payload,/^[a-f0-9]{64}$/);assert.equal(compact.result,'');
    assert.throws(()=>s.command('111',old),/COMMAND_EXPIRED/);
    assert.throws(()=>s.command('111',{...old,action:{type:'level',value:'201'}}),/KEY_REUSED/);
    assert.deepEqual(s.summary('111'),original);
  } finally{s.close();}
});
test('OIDC cancellation binds state, ignores extra fields, checks issuer and has a safe browser error page',async()=>{
  const s=new Store(':memory:'),f=await app(s,config);
  try {
    const start=await f.inject('/auth/oidc/start'),cookie=start.cookies[0]!.value,state=new URL(start.headers.location!).searchParams.get('state')!;
    const callback=(q:Record<string,string>)=>f.inject({url:'/auth/oidc/callback?'+new URLSearchParams(q),cookies:{chm_session:cookie}});
    assert.equal((await callback({state:'wrong',error:'access_denied'})).statusCode,401);
    assert.equal((await callback({state,error:'access_denied',iss:'https://evil.invalid'})).statusCode,401);
    const denied=await callback({state,error:'access_denied',error_description:'secret-provider-text',iss:issuer,extra:'ignored'});
    assert.equal(denied.statusCode,302);assert.equal(denied.headers.location,'/?login=cancelled');
    assert.equal((await callback({state,error:'access_denied'})).statusCode,401);
    const bad=await f.inject({url:'/auth/oidc/callback?state=secret&code=secret',headers:{accept:'text/html'}});
    assert.equal(bad.statusCode,401);assert.match(bad.body,/Вернуться к входу/);assert.ok(!bad.body.includes('secret'));
  } finally{await f.close();s.close();}
});

test('Mini signed context takes precedence over another account cookie, and old tabs cannot adopt it',async()=>{
  const s=new Store(':memory:'),f=await app(s,config),a=new Auth(s,config),old=a.create('111');
  try {
    command(s,{type:'level',value:'200'});
    const oldAccount=(await f.inject({url:'/api/session',cookies:{chm_session:old.raw}})).json().account;
    const login=await f.inject({method:'POST',url:'/auth/mini',cookies:{chm_session:old.raw},headers:{origin:config.baseUrl},payload:{initData:initData(222)}});
    assert.equal(login.statusCode,200);const fresh=login.cookies[0]!.value;assert.notEqual(fresh,old.raw);
    assert.equal((await f.inject({url:'/api/state',cookies:{chm_session:old.raw}})).statusCode,401);
    const cookies={chm_session:fresh};assert.equal((await f.inject({url:'/api/state',cookies})).json().level,'1');
    assert.equal((await f.inject({url:'/api/state',headers:{'x-chm-account':oldAccount}})).statusCode,401);
    const newAccount=(await f.inject({url:'/api/session',cookies})).json().account;
    assert.equal((await f.inject({url:'/api/state',cookies,headers:{'x-chm-account':newAccount}})).json().level,'1');
    for(const url of ['/api/state','/api/session','/api/inventory?scope=work']){
      const r=await f.inject({url,cookies,headers:{'x-chm-account':oldAccount}});assert.equal(r.statusCode,401);assert.deepEqual(r.json(),{error:'SESSION_CHANGED'});
    }
    assert.equal(s.summary('111').level,'200');assert.equal(s.summary('222').level,'1');
  } finally{await f.close();s.close();}
});

test('stale signed Mini context only resumes same existing unexpired identity, without issuance or extension',async()=>{
  const s=new Store(':memory:'),f=await app(s,config),a=new Auth(s,config),current=a.create('111'),now=Math.floor(Date.now()/1000);
  const raw=initData(111,now-1000),before=s.session(a.hash(current.raw),now)!;
  const send=(initData:string,cookie=current.raw)=>f.inject({method:'POST',url:'/auth/mini',cookies:{chm_session:cookie},headers:{origin:config.baseUrl},payload:{initData}});
  try {
    const resumed=await send(raw);assert.equal(resumed.statusCode,200);assert.equal(resumed.cookies.length,0);assert.equal(resumed.json().csrf,current.csrf);
    assert.deepEqual(s.session(a.hash(current.raw),now),before);
    const tampered=new URLSearchParams(raw);tampered.set('user',JSON.stringify({id:222}));
    for(const data of [initData(222,now-1000),tampered.toString(),initData(111,now+120)])assert.equal((await send(data)).statusCode,401);
    assert.equal((await send(raw,'missing')).statusCode,401);
    const anonymous=a.create(null);assert.equal((await send(raw,anonymous.raw)).statusCode,401);
    s.db.prepare('UPDATE sessions SET expires=1 WHERE hash=?').run(a.hash(current.raw));assert.equal((await send(raw)).statusCode,401);
    assert.equal((s.db.prepare('SELECT count(*) AS n FROM players').get() as {n:number}).n,1);
  } finally{await f.close();s.close();}
});
