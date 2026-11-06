import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../apps/server/src/store.js';
import {Auth,issuer} from '../apps/server/src/auth.js';
import {LoginLimiter} from '../apps/server/src/login-limiter.js';
import {app} from '../apps/server/src/app.js';
import {config} from './helpers.js';

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
