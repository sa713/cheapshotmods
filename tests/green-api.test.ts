import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Worker} from 'node:worker_threads';
import {app} from '../apps/server/src/app.js';
import {Store} from '../apps/server/src/store.js';
import {Auth} from '../apps/server/src/auth.js';
import {command,config} from './helpers.js';
const add=(s:Store,value='6',quantity='10',owner='111')=>command(s,{type:'original.put',kind:'raw-green',tier:0,value,quantity},owner);
const fuse={recipe:'green-667',includeWorn:false};

test('green HTTP preview and commit enforce authenticated owner, Origin/CSRF/account and server-only stock/output',async()=>{
  const s=new Store(':memory:');add(s);add(s,'7','6');add(s,'6','999','222');add(s,'7','999','222');const f=await app(s,config),auth=new Auth(s,config),session=auth.create('111');try{
    const cookies={chm_session:session.raw},headers={origin:config.baseUrl,'x-csrf-token':session.csrf,'x-chm-account':auth.hash('account:111')},state=s.summary('111'),payload={revision:state.revision,experiment:state.experiment,fuse};
    for(const [options,status] of [[{cookies:{},headers},401],[{cookies,headers:{...headers,origin:'https://foreign.invalid'}},403],[{cookies,headers:{...headers,'x-csrf-token':'forged'}},403],[{cookies,headers:{...headers,'x-chm-account':auth.hash('account:222')}},401]] as const){const bytes=s.db.serialize();assert.equal((await f.inject({method:'POST',url:'/api/fuse-preview',payload,...options})).statusCode,status);assert.deepEqual(s.db.serialize(),bytes);}
    const before=s.db.serialize(),p=await f.inject({method:'POST',url:'/api/fuse-preview',payload,cookies,headers});assert.equal(p.statusCode,200);assert.equal(p.json().maxCount,'5');assert.equal(p.json().price,'140');assert.deepEqual(s.db.serialize(),before);
    for(const extra of [{owner:'222'},{items:[]},{price:'1'},{result:{kind:'raw-red'}},{count:'6'},{recipe:'green-678'}]){assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload:{key:randomUUID(),revision:state.revision,experiment:state.experiment,action:{type:'fuse',fuse:{...fuse,...extra}}}})).statusCode,400);assert.deepEqual(s.db.serialize(),before);}
    const body={key:randomUUID(),revision:state.revision,experiment:state.experiment,action:{type:'fuse',fuse:{...fuse,count:'5'}}},r=await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload:body});assert.equal(r.statusCode,200);assert.equal(r.json().spent,'140');assert.equal(s.summary('222').spent,'0');assert.equal((await f.inject({method:'POST',url:'/api/commands',cookies,headers,payload:body})).body,r.body);
    assert.equal((await f.inject({method:'POST',url:'/api/fuse-preview',payload,cookies,headers})).statusCode,409);
  }finally{await f.close();s.close();}
});

test('green commit with an actually lost TCP response survives restart, stock change and exact retry',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm009-http-')),path=join(dir,'db');let s=new Store(path),f=await app(s,config);try{
    add(s);add(s,'7','6');command(s,{type:'baseline.capture',replace:false});const original=s.inventory('111','original'),baseline=s.summary('111').baseline,session=new Auth(s,config).create('111'),state=s.summary('111');
    const body={key:randomUUID(),revision:state.revision,experiment:state.experiment,action:{type:'fuse',fuse}},headers={origin:config.baseUrl,'x-csrf-token':session.csrf,cookie:'chm_session='+session.raw,'content-type':'application/json'};
    f.addHook('onSend',async(req,reply,payload)=>{if(req.headers['x-drop-fixture']==='yes')reply.raw.destroy();return payload;});const address=await f.listen({host:'127.0.0.1',port:0});
    await assert.rejects(()=>fetch(address+'/api/commands',{method:'POST',headers:{...headers,'x-drop-fixture':'yes'},body:JSON.stringify(body)}));
    const receipt=s.db.prepare('SELECT result FROM commands WHERE key=?').get(body.key) as {result:string};assert.ok(receipt.result);assert.equal(s.summary('111').spent,'140');assert.deepEqual(s.inventory('111','original'),original);assert.deepEqual(s.summary('111').baseline,baseline);
    add(s,'8','8');const current=s.summary('111');await f.close();s.close();s=new Store(path);f=await app(s,config);const retry=await f.inject({method:'POST',url:'/api/commands',headers,payload:body});assert.equal(retry.statusCode,200);assert.equal(retry.body,receipt.result);assert.deepEqual(s.summary('111'),current);
    command(s,{type:'undo'});assert.equal(s.summary('111').spent,'0');assert.equal(s.inventory('111','work').find(g=>g.value==='8')!.quantity,'8');command(s,{type:'baseline.restore'});assert.deepEqual(s.inventory('111','original'),original);assert.deepEqual(s.inventory('111','work'),original);
  }finally{await f.close();if(s.db.open)s.close();rmSync(dir,{recursive:true,force:true});}
});

for(const sameKey of [false,true])test('independent SQLite connections serialize a shared green seven-stock; same key='+sameKey,{timeout:20000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm009-workers-')),path=join(dir,'db'),s=new Store(path);add(s);add(s,'7','6');add(s,'8','8');const initial=s.summary('111');s.close();const key=randomUUID(),gate=new SharedArrayBuffer(4),workers:Worker[]=[];
  try{
    const results=await new Promise<{ok:boolean;error?:string}[]>((resolve,reject)=>{let ready=0;const results:{ok:boolean;error?:string}[]=[];
      for(let i=0;i<2;i++){const worker=new Worker(new URL('./fixtures/command-worker.mjs',import.meta.url),{workerData:{path,gate,command:{key:sameKey?key:randomUUID(),revision:initial.revision,experiment:initial.experiment,action:{type:'fuse',fuse:{recipe:i&&!sameKey?'green-788':'green-667',includeWorn:false}}}}});workers.push(worker);worker.on('error',reject);worker.on('message',m=>{if(m.ready&&++ready===2){Atomics.store(new Int32Array(gate),0,1);Atomics.notify(new Int32Array(gate),0,2);}if(m.done){results.push(m);if(results.length===2)resolve(results);}});}
    });
    const db=new Store(path);try{assert.equal(results.filter(r=>r.ok).length,sameKey?2:1);if(!sameKey)assert.equal(results.filter(r=>r.error==='REVISION_CONFLICT').length,1);assert.equal(db.summary('111').revision,(BigInt(initial.revision)+1n).toString());assert.ok(['140','112'].includes(db.summary('111').spent));assert.equal((db.db.prepare('SELECT count(*) n FROM history').get() as {n:number}).n,1);command(db,{type:'undo'});assert.equal(db.summary('111').spent,'0');assert.equal(db.inventory('111','work').find(g=>g.value==='7')!.quantity,'6');}finally{db.close();}
  }finally{await Promise.all(workers.map(w=>w.terminate()));rmSync(dir,{recursive:true,force:true});}
});
