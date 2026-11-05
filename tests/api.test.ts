import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {app} from '../apps/server/src/app.js';
import {Store} from '../apps/server/src/store.js';
import {Auth} from '../apps/server/src/auth.js';
import {config,initData} from './helpers.js';
test('HTTPS sessions set Secure, HttpOnly, SameSite and rotate after Mini App login',async()=>{
  const s=new Store(':memory:'),secure={...config,baseUrl:'https://fixture.invalid'},f=await app(s,secure);
  try {
    const old=new Auth(s,secure).create('111');
    const r=await f.inject({method:'POST',url:'/auth/mini',cookies:{chm_session:old.raw},headers:{origin:secure.baseUrl},payload:{initData:initData()}});
    assert.equal(r.statusCode,200);assert.notEqual(r.cookies[0]!.value,old.raw);
    const header=r.headers['set-cookie'] as string;for(const attr of ['HttpOnly','Secure','SameSite=Lax','Max-Age=43200'])assert.ok(header.includes(attr));
    assert.equal((await f.inject({url:'/api/state',cookies:{chm_session:old.raw}})).statusCode,401);
  }finally{await f.close();s.close();}
});
test('HTTP authorization, CSRF, owner isolation, exact numbers, retry, conflicts and logout',async()=>{
  const s=new Store(':memory:'),f=await app(s,config),origin=config.baseUrl;
  try {
    for (const url of ['/api/state','/api/session','/api/inventory?scope=work']) assert.equal((await f.inject({url,headers:{'x-user-id':'111'}})).statusCode,401);
    const login=await f.inject({method:'POST',url:'/auth/mini',headers:{origin},payload:{initData:initData()}});assert.equal(login.statusCode,200);
    const cookies={chm_session:login.cookies[0]!.value},headers={origin,'x-csrf-token':login.json().csrf},base=(await f.inject({url:'/api/state',cookies})).json();
    const payload={key:randomUUID(),revision:base.revision,experiment:base.experiment,action:{type:'original.put',kind:'💚',tier:6,value:'9007199254740993',quantity:'9007199254740993'}};
    for(const h of [{},{...headers,origin:'https://evil.invalid'},{origin}]) assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies,headers:h,payload})).statusCode,403);
    assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload:{...payload,owner:'222'}})).statusCode,400);
    const first=await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload});assert.equal(first.statusCode,200);
    assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload})).body,first.body);
    const groups=(await f.inject({url:'/api/inventory?scope=original',cookies})).json().items;assert.equal(groups[0].value,'9007199254740993');assert.equal(groups[0].quantity,'9007199254740993');
    const next=first.json(),level={key:randomUUID(),revision:next.revision,experiment:next.experiment,action:{type:'level',value:'9007199254740993'}};
    const competing=await Promise.all([level,{...level,key:randomUUID()}].map(payload=>f.inject({method:'POST',url:'/api/commands',cookies,headers,payload})));
    assert.deepEqual(competing.map(r=>r.statusCode).sort(),[200,409]);assert.equal((await f.inject({url:'/api/state',cookies})).json().level,'9007199254740993');
    const second=await f.inject({method:'POST',url:'/auth/mini',headers:{origin},payload:{initData:initData(222)}}),secondCookies={chm_session:second.cookies[0]!.value};
    const secondState=(await f.inject({url:'/api/state',cookies:secondCookies})).json();
    assert.equal((await f.inject({url:'/api/state?owner=111',cookies:secondCookies})).json().level,'1');
    assert.deepEqual((await f.inject({url:'/api/inventory?scope=original',cookies:secondCookies})).json().items,[]);
    const alien={key:randomUUID(),revision:secondState.revision,experiment:secondState.experiment,action:{type:'original.delete',id:groups[0].id}};
    assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies:secondCookies,headers:{origin,'x-csrf-token':second.json().csrf},payload:alien})).statusCode,404);
    assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies:secondCookies,headers:{origin,'x-csrf-token':second.json().csrf},payload:{...alien,experiment:next.experiment}})).statusCode,409);
    const oversized=await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload:{padding:'x'.repeat(1024*1024)}});assert.equal(oversized.statusCode,413);assert.equal(oversized.json().error,'REQUEST_TOO_LARGE');
    assert.equal((await f.inject({method:'POST',url:'/auth/logout',cookies,headers})).statusCode,200);
    assert.equal((await f.inject({url:'/api/state',cookies})).statusCode,401);
    for (const bad of ['', 'chm-forged']) assert.equal((await f.inject({url:'/api/state',cookies:{chm_session:bad}})).statusCode,401);
    const expired=new Auth(s,config).create('111');s.db.prepare('UPDATE sessions SET expires=0').run();assert.equal((await f.inject({url:'/api/state',cookies:{chm_session:expired.raw}})).statusCode,401);
  }finally{await f.close();s.close();}
});
test('real socket response lost after commit; restart preserves idempotency and exact API integers',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-http-')),path=join(dir,'db');let s=new Store(path),f=await app(s,config);
  try {
    f.addHook('onSend',async(req,reply,payload)=>{if(req.headers['x-drop-fixture']==='yes')reply.raw.destroy();return payload;});
    const address=await f.listen({host:'127.0.0.1',port:0});
    const session=new Auth(s,config).create('111'),cookie='chm_session='+session.raw;
    const headers={origin:config.baseUrl,'x-csrf-token':session.csrf,cookie,'content-type':'application/json'};
    async function send(action:Record<string,unknown>) {const state=s.summary('111');const r=await fetch(address+'/api/commands',{method:'POST',headers,body:JSON.stringify({key:randomUUID(),revision:state.revision,experiment:state.experiment,action})});assert.equal(r.status,200);return await r.json() as {createdId:string};}
    const big='9007199254740993',huge=await send({type:'original.put',kind:'💚',tier:6,value:big,quantity:big});
    await send({type:'level',value:big});await send({type:'equip',items:[{id:huge.createdId,quantity:'1'}]});
    assert.equal(s.summary('111').stats.health,'811296384146076004301129887254');
    const six=await send({type:'original.put',kind:'🅾',tier:1,value:'10',quantity:'6'});
    // Original edits after equip do not affect work, so reset to import the new group.
    await send({type:'reset'});const before=s.summary('111');
    const envelope={key:randomUUID(),revision:before.revision,experiment:before.experiment,action:{type:'craft',items:[{id:six.createdId,quantity:'3',worn:'0'}]}};
    await assert.rejects(()=>fetch(address+'/api/commands',{method:'POST',headers:{...headers,'x-drop-fixture':'yes'},body:JSON.stringify(envelope)}));
    const committed=s.summary('111');assert.equal(committed.spent,'84');
    const replay=await fetch(address+'/api/commands',{method:'POST',headers,body:JSON.stringify(envelope)});assert.equal(replay.status,200);const result=await replay.json();
    await f.close();s.close();s=new Store(path);f=await app(s,config);
    const retry=await f.inject({method:'POST',url:'/api/commands',headers,payload:envelope});assert.equal(retry.statusCode,200);assert.deepEqual(retry.json(),result);assert.deepEqual(s.summary('111'),committed);
    const data=(await f.inject({url:'/api/inventory?scope=work',headers})).json().items as {id:string;value:string;quantity:string}[];
    const group=data.find(g=>g.id===huge.createdId)!;assert.equal(group.value,big);assert.equal(group.quantity,big);assert.equal(s.summary('111').level,big);
  }finally{await f.close();if(s.db.open)s.close();rmSync(dir,{recursive:true,force:true});}
});
test('missing configuration, safe errors, database failure and readiness',async()=>{
  const s=new Store(':memory:');let f=await app(s,{...config,botToken:undefined,clientId:undefined,clientSecret:undefined});
  try {
    assert.deepEqual((await f.inject('/api/config')).json(),{oidc:false,mini:false});assert.equal((await f.inject('/auth/oidc/start')).statusCode,503);
    assert.equal((await f.inject({method:'POST',url:'/auth/mini',headers:{origin:config.baseUrl},payload:{initData:initData()}})).statusCode,503);
    assert.deepEqual((await f.inject('/version')).json(),{version:'a'.repeat(40)});assert.equal((await f.inject('/health')).statusCode,200);
    const auth=new Auth(s,config),session=auth.create('111');
    assert.equal((await f.inject({url:'/api/state',cookies:{chm_session:session.raw}})).statusCode,401);
    await f.close();f=await app(s,config);
    s.db.exec(`CREATE TRIGGER fixture_fail BEFORE UPDATE ON players BEGIN SELECT RAISE(ABORT,'fixture-secret-must-not-leak'); END;`);
    const state=s.summary('111');const failed=await f.inject({method:'POST',url:'/api/commands',cookies:{chm_session:session.raw},headers:{origin:config.baseUrl,'x-csrf-token':session.csrf},payload:{key:randomUUID(),revision:state.revision,experiment:state.experiment,action:{type:'level',value:'5'}}});
    assert.equal(failed.statusCode,500);assert.deepEqual(failed.json(),{error:'SERVER_ERROR'});assert.equal(s.summary('111').level,'1');
    s.close();assert.equal((await f.inject('/health')).statusCode,503);
  }finally{await f.close();if(s.db.open)s.close();}
});
