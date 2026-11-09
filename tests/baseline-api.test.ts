import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {app} from '../apps/server/src/app.js';
import {Store} from '../apps/server/src/store.js';
import {Auth} from '../apps/server/src/auth.js';
import {add,command,config,initData} from './helpers.js';

test('baseline HTTP commands use session owner, CSRF/Origin/account and reject client snapshot rows/foreign IDs',async()=>{
  const s=new Store(':memory:'),f=await app(s,config);try{
    add(s,'20');const login=await f.inject({method:'POST',url:'/auth/mini',headers:{origin:config.baseUrl},payload:{initData:initData()}});
    const cookies={chm_session:login.cookies[0]!.value},headers={origin:config.baseUrl,'x-csrf-token':login.json().csrf};
    const state=s.summary('111'),payload={key:randomUUID(),revision:state.revision,experiment:state.experiment,action:{type:'baseline.capture',replace:false}};
    for(const h of [{},{...headers,origin:'https://other.invalid'},{origin:config.baseUrl}])assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies,headers:h,payload})).statusCode,403);
    assert.equal((await f.inject({method:'POST',url:'/api/commands',headers,payload})).statusCode,401);
    assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies,headers:{...headers,'x-chm-account':'forged'},payload})).statusCode,401);
    for(const action of [{...payload.action,owner:'222'},{...payload.action,items:[]},{...payload.action,id:'foreign'},{...payload.action,replace:'yes'},{type:'baseline.restore',items:[]}]){
      const before=s.db.serialize();assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload:{...payload,action}})).statusCode,400);assert.deepEqual(s.db.serialize(),before);
    }
    const captured=await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload});assert.equal(captured.statusCode,200);assert.equal(captured.json().baseline.quantity,'20');
    assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload})).body,captured.body);
    const site=new Auth(s,config).create('111');assert.deepEqual((await f.inject({url:'/api/state',cookies:{chm_session:site.raw}})).json().baseline,captured.json().baseline);
    const other=new Auth(s,config).create('222');assert.equal((await f.inject({url:'/api/state?owner=111',cookies:{chm_session:other.raw}})).json().baseline,null);
    const p=s.summary('222'),before=s.db.serialize();const denied=await f.inject({method:'POST',url:'/api/commands',cookies:{chm_session:other.raw},headers:{origin:config.baseUrl,'x-csrf-token':other.csrf},payload:{key:randomUUID(),revision:p.revision,experiment:p.experiment,action:{type:'baseline.restore'}}});assert.equal(denied.statusCode,400);assert.equal(denied.json().error,'BASELINE_REQUIRED');assert.deepEqual(s.db.serialize(),before);
  }finally{await f.close();s.close();}
});

for(const type of ['baseline.capture','baseline.restore'])test('real lost HTTP response and restart retry do not repeat '+type,async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm008-http-')),path=join(dir,'db');let s=new Store(path),f=await app(s,config);try{
    add(s,'20');if(type==='baseline.restore'){command(s,{type:'baseline.capture',replace:false});add(s,'3','💚',2,'12');}
    const session=new Auth(s,config).create('111'),state=s.summary('111'),request={key:randomUUID(),revision:state.revision,experiment:state.experiment,action:type==='baseline.capture'?{type,replace:false}:{type}};
    f.addHook('onSend',async(req,reply,payload)=>{if(req.headers['x-drop-fixture']==='yes')reply.raw.destroy();return payload;});
    const address=await f.listen({host:'127.0.0.1',port:0}),headers={origin:config.baseUrl,'x-csrf-token':session.csrf,cookie:'chm_session='+session.raw,'content-type':'application/json'};
    await assert.rejects(()=>fetch(address+'/api/commands',{method:'POST',headers:{...headers,'x-drop-fixture':'yes'},body:JSON.stringify(request)}));
    const receipt=s.db.prepare('SELECT result FROM commands WHERE owner=? AND key=?').get('111',request.key) as {result:string};assert.ok(receipt.result);
    add(s,'5','💚',2,'13');if(type==='baseline.capture')command(s,{type,replace:true});const before=s.summary('111'),original=s.inventory('111','original'),work=s.inventory('111','work');
    await f.close();s.close();s=new Store(path);f=await app(s,config);const retry=await f.inject({method:'POST',url:'/api/commands',headers,payload:request});assert.equal(retry.statusCode,200);assert.equal(retry.body,receipt.result);assert.deepEqual(s.summary('111'),before);assert.deepEqual(s.inventory('111','original'),original);assert.deepEqual(s.inventory('111','work'),work);
  }finally{await f.close();if(s.db.open)s.close();rmSync(dir,{recursive:true,force:true});}
});
