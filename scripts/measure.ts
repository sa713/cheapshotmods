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
try {
  command({type:'reset'});const start=performance.now();
  store.db.transaction(()=>{for(let i=1;i<=10000;i++)command({type:'original.put',kind:'💚',tier:2,value:String(i),quantity:'1'});}).immediate();
  const insertMs=performance.now()-start;
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
  const bytes=statSync(path).size+(existsSync(path+'-wal')?statSync(path+'-wal').size:0);
  console.log(JSON.stringify({node:process.version,platform:process.platform,arch:process.arch,cpu:cpus()[0]?.model,logicalCpus:cpus().length,hostMemoryMiB:Math.round(totalmem()/1048576),dataset:{distinctGroups:10000,millionGroup:'1000000',exactQuantity:'9007199254740993'},insertMs,resetMs,paginatedLoadMs:loadMs,tenConcurrentHttpMs:concurrentMs,dbAndWalBytes:bytes,rssMiB:process.memoryUsage().rss/1048576,peakRssMiB:process.resourceUsage().maxRSS/1024},null,2));
}finally{await server.close();store.close();rmSync(dir,{recursive:true,force:true});}
