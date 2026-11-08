import {Store} from '../apps/server/src/store.js';
import {app} from '../apps/server/src/app.js';
import {Auth} from '../apps/server/src/auth.js';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync,statSync,existsSync} from 'node:fs';
import {tmpdir,cpus,totalmem} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'chm-measure-')),path=join(dir,'db.sqlite'),store=new Store(path);
const config={baseUrl:'http://localhost:3000',sessionSecret:randomUUID(),botToken:'synthetic-measurement-token',version:'measurement'};
const server=await app(store,config),auth=new Auth(store,config),session=auth.create('111');
const command=(action:Record<string,unknown>)=>{const s=store.summary('111');return store.command('111',{key:randomUUID(),revision:s.revision,experiment:s.experiment,action});};
const compactStore=new Store(':memory:');
const compactCommand=(action:Record<string,unknown>)=>{const s=compactStore.summary('999');return compactStore.command('999',{key:randomUUID(),revision:s.revision,experiment:s.experiment,action});};
const resultCount=10n**24n,compactId=compactCommand({type:'original.put',kind:'🅾',tier:1,value:'10',quantity:(9n*resultCount).toString()}).createdId!;
const compactBefore=compactStore.summary('999'),heapBefore=process.memoryUsage().heapUsed,compactStart=performance.now();
const compactRequest={kind:'🅾',targetTier:3,count:resultCount.toString(),items:[{id:compactId,quantity:(9n*resultCount).toString(),worn:'0'}]};
const compactPlan=compactStore.preview('999',{revision:compactBefore.revision,experiment:compactBefore.experiment,fuse:compactRequest});
const previewMs=performance.now()-compactStart,commitStart=performance.now();compactCommand({type:'fuse',fuse:compactRequest});const commitMs=performance.now()-commitStart;
assert.equal(compactStore.summary('999').spent,(504n*resultCount).toString());
const physicalWorkLots=(compactStore.db.prepare('SELECT count(*) AS n FROM work_lots').get() as {n:number}).n;
const historyRows=(compactStore.db.prepare('SELECT count(*) AS n FROM history').get() as {n:number}).n;
const undoStart=performance.now();compactCommand({type:'undo'});const undoMs=performance.now()-undoStart;
assert.equal(compactStore.inventory('999','work')[0]!.quantity,(9n*resultCount).toString());
const compactHugeBatch={inputUnits:(9n*resultCount).toString(),resultCount:resultCount.toString(),price:compactPlan.price,previewMs,commitMs,undoMs,heapDeltaBytes:process.memoryUsage().heapUsed-heapBefore,physicalWorkLots,historyRows,planJsonBytes:Buffer.byteLength(JSON.stringify(compactPlan))};compactStore.close();
try {
  command({type:'reset'});const start=performance.now();
  store.db.transaction(()=>{for(let i=1;i<=10000;i++)command({type:'original.put',kind:'💚',tier:2,value:String(i),quantity:'1'});}).immediate();
  const batchSetupMs=performance.now()-start;
  const million=command({type:'original.put',kind:'🅾',tier:1,value:'10',quantity:'1000000'}).createdId!;
  const huge=command({type:'original.put',kind:'💚',tier:6,value:'9007199254740993',quantity:'9007199254740993'}).createdId!;
  const resetStart=performance.now();command({type:'reset'});const resetMs=performance.now()-resetStart;
  const loadStart=performance.now();let cursor='',count=0;
  while(true){const page=store.inventory('111','work',cursor,200);count+=page.length;if(page.length===0)break;cursor=page.at(-1)!.id;}
  const loadMs=performance.now()-loadStart;assert.equal(count,10002);
  assert.equal(store.group('111','work',million).quantity,'1000000');assert.equal(store.group('111','work',huge).quantity,'9007199254740993');
  const state=store.summary('111'), concurrentStart=performance.now();
  const results=await Promise.all(Array.from({length:10},()=>server.inject({method:'POST',url:'/api/commands',headers:{origin:config.baseUrl,'x-csrf-token':session.csrf},cookies:{chm_session:session.raw},payload:{key:randomUUID(),revision:state.revision,experiment:state.experiment,action:{type:'craft',items:[{id:million,quantity:'3',worn:'0'}]}}})));
  const concurrentMs=performance.now()-concurrentStart;
  assert.equal(results.filter(r=>r.statusCode===200).length,1);assert.equal(results.filter(r=>r.statusCode===409).length,9);
  const address=await server.listen({host:'127.0.0.1',port:0}),headers={origin:config.baseUrl,'x-csrf-token':session.csrf,cookie:'chm_session='+session.raw,'content-type':'application/json'};
  const sampleSize=100,durations:number[]=[];let latest=store.summary('111');
  for(let i=0;i<sampleSize;i++) {
    const began=performance.now();
    const r=await fetch(address+'/api/commands',{method:'POST',headers,body:JSON.stringify({key:randomUUID(),revision:latest.revision,experiment:latest.experiment,action:{type:'level',value:String(i+1)}})});
    assert.equal(r.status,200);latest=await r.json() as ReturnType<Store['summary']>;durations.push(performance.now()-began);
  }
  const oversizedStart=performance.now(),oversized=await fetch(address+'/api/commands',{method:'POST',headers,body:JSON.stringify({key:randomUUID(),revision:latest.revision,experiment:latest.experiment,action:{type:'level',value:'9'.repeat(1000000)}})});
  assert.equal(oversized.status,400);assert.equal((await oversized.json() as {error:string}).error,'INTEGER_TOO_LONG');const oversizedRejectMs=performance.now()-oversizedStart;
  const bytes=statSync(path).size+(existsSync(path+'-wal')?statSync(path+'-wal').size:0);
  console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,cpu:cpus()[0]?.model,logicalCpus:cpus().length,hostMemoryMiB:Math.round(totalmem()/1048576),compactHugeBatch,dataset:{distinctGroups:10000,millionGroup:'1000000',exactQuantity:'9007199254740993'},batchSetup:{groups:10000,outerTransaction:true,elapsedMs:batchSetupMs},sequentialHttp:{sampleSize,commitPerRequest:true,totalMs:durations.reduce((a,b)=>a+b,0),p95Ms:[...durations].sort((a,b)=>a-b)[Math.ceil(sampleSize*0.95)-1]},oversizedInteger:{digits:1000000,rejectMs:oversizedRejectMs},resetMs,paginatedLoadMs:loadMs,tenSameRevisionInjectedRequestsMs:concurrentMs,dbAndWalBytes:bytes,rssMiB:process.memoryUsage().rss/1048576,peakRssMiB:process.resourceUsage().maxRSS/1024},null,2));
}finally{await server.close();store.close();rmSync(dir,{recursive:true,force:true});}
