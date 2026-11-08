import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../apps/server/src/store.js';
import {app} from '../apps/server/src/app.js';
import {Auth} from '../apps/server/src/auth.js';
import {add,choice,command,config} from './helpers.js';
test('fuse preview/commit enforce session, Origin, CSRF, account, owner, revision and server-calculated plan',async()=>{
  const s=new Store(':memory:'),id=add(s,'27'),foreign=add(s,'27','🅾',1,'10','222'),f=await app(s,config),auth=new Auth(s,config),session=auth.create('111');
  try{const cookies={chm_session:session.raw},headers={origin:config.baseUrl,'x-csrf-token':session.csrf,'x-chm-account':auth.hash('account:111')},initial=s.summary('111');
    const fuse={kind:'🅾️',targetTier:3,count:'2',items:[choice(id,'27')]},body={revision:initial.revision,experiment:initial.experiment,fuse};
    for(const [request,status] of [[{cookies:{},headers},401],[{cookies,headers:{...headers,origin:'https://evil.invalid'}},403],[{cookies,headers:{...headers,'x-csrf-token':'bad'}},403],[{cookies,headers:{...headers,'x-chm-account':auth.hash('account:222')}},401]] as const){const r=await f.inject({method:'POST',url:'/api/fuse-preview',payload:body,...request});assert.equal(r.statusCode,status);}
    const before=s.db.serialize(),p=await f.inject({method:'POST',url:'/api/fuse-preview',cookies,headers,payload:body});assert.equal(p.statusCode,200);assert.equal(p.json().price,'1008');assert.deepEqual(s.db.serialize(),before);
    const invalid=[{...fuse,items:[choice(foreign,'27')]},{...fuse,targetTier:7},{...fuse,items:[choice(id,'27'),choice(id,'1')]},{...fuse,count:'4'},{...fuse,price:'0'},{...fuse,items:[choice(id,'27','1')]}];
    for(const request of invalid){const r=await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload:{key:randomUUID(),revision:initial.revision,experiment:initial.experiment,action:{type:'fuse',fuse:request}}});assert.ok(r.statusCode>=400&&r.statusCode<500);assert.deepEqual(s.summary('111'),initial);}
    command(s,{type:'level',value:'200'});assert.equal((await f.inject({method:'POST',url:'/api/fuse-preview',cookies,headers,payload:body})).statusCode,409);
    const current=s.summary('111'),raw={key:randomUUID(),revision:current.revision,experiment:current.experiment,action:{type:'fuse',fuse}};
    const result=await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload:raw});assert.equal(result.statusCode,200);assert.equal(result.json().spent,'1008');
    assert.deepEqual((await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload:raw})).json(),result.json());assert.equal(s.summary('222').spent,'0');
  }finally{await f.close();s.close();}
});

test('single-group HTTP preview computes max without count and rejects forged fields/counts read-only',async()=>{
  const s=new Store(':memory:'),id=add(s,'20'),foreign=add(s,'20','🅾',1,'10','222'),f=await app(s,config),session=new Auth(s,config).create('111');
  try{const headers={origin:config.baseUrl,'x-csrf-token':session.csrf},cookies={chm_session:session.raw},p=s.summary('111'),fuse={id,targetTier:3,includeWorn:false},payload={revision:p.revision,experiment:p.experiment,fuse},before=s.db.serialize();
    const r=await f.inject({method:'POST',url:'/api/fuse-preview',headers,cookies,payload});assert.equal(r.statusCode,200);assert.equal(r.json().maxCount,'2');assert.equal(r.json().count,'2');assert.equal(r.json().price,'1008');assert.deepEqual(s.db.serialize(),before);
    for(const bad of [{...fuse,count:'3'},{...fuse,id:foreign},{...fuse,items:[choice(id)]},{...fuse,value:'1'},{...fuse,crit:'0'},{...fuse,quantity:'21'}]){const failed=await f.inject({method:'POST',url:'/api/commands',headers,cookies,payload:{key:randomUUID(),revision:p.revision,experiment:p.experiment,action:{type:'fuse',fuse:bad}}});assert.ok(failed.statusCode>=400&&failed.statusCode<500);assert.deepEqual(s.db.serialize(),before);}
    const result=await f.inject({method:'POST',url:'/api/commands',headers,cookies,payload:{key:randomUUID(),revision:p.revision,experiment:p.experiment,action:{type:'fuse',fuse:{...fuse,count:'2'}}}});assert.equal(result.statusCode,200);assert.equal(result.json().spent,'1008');
  }finally{await f.close();s.close();}
});
