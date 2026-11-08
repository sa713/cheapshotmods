import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../apps/server/src/store.js';
import {add,command} from './helpers.js';
for(const mode of ['capture-edit','restore-edit','capture-same-key'])test('independent SQLite connections serialize baseline operations '+mode,{timeout:20000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm008-workers-')),path=join(dir,'db'),setup=new Store(path),id=add(setup,'20');
  if(mode==='restore-edit'){command(setup,{type:'baseline.capture',replace:false});command(setup,{type:'original.put',id,kind:'🅾',tier:1,value:'10',quantity:'35'});command(setup,{type:'reset'});}
  const initial=setup.summary('111'),key=randomUUID();setup.close();const gate=new SharedArrayBuffer(4),workers:Worker[]=[];
  try{
    const results=await new Promise<{index:number;ok:boolean;error?:string}[]>((resolve,reject)=>{
      let ready=0;const results:{index:number;ok:boolean;error?:string}[]=[];
      for(let index=0;index<2;index++){
        const action=index===0||mode==='capture-same-key'?{type:mode==='restore-edit'?'baseline.restore':'baseline.capture',...(mode==='restore-edit'?{}:{replace:false})}:{type:'original.put',id,kind:'🅾',tier:1,value:'11',quantity:'29'};
        const worker=new Worker(new URL('./fixtures/command-worker.mjs',import.meta.url),{workerData:{path,gate,command:{key:mode==='capture-same-key'?key:randomUUID(),revision:initial.revision,experiment:initial.experiment,action}}});workers.push(worker);worker.on('error',reject);
        worker.on('message',(m:{ready?:boolean;done?:boolean;ok?:boolean;error?:string})=>{if(m.ready&&++ready===2){Atomics.store(new Int32Array(gate),0,1);Atomics.notify(new Int32Array(gate),0,2);}if(m.done){results.push({index,ok:m.ok===true,error:m.error});if(results.length===2)resolve(results);}});
      }
    });
    const s=new Store(path);try{
      assert.equal(s.summary('111').revision,(BigInt(initial.revision)+1n).toString());assert.equal(results.filter(r=>r.ok).length,mode==='capture-same-key'?2:1);
      if(mode==='capture-same-key'){assert.equal(s.summary('111').baseline!.quantity,'20');assert.equal((s.db.prepare('SELECT count(*) AS n FROM commands WHERE key=?').get(key) as {n:number}).n,1);}
      else{
        assert.equal(results.filter(r=>r.error==='REVISION_CONFLICT').length,1);const baselineWon=results.find(r=>r.index===0)!.ok;
        assert.equal(s.group('111','original',id).quantity,baselineWon?'20':'29');assert.equal(s.group('111','original',id).value,baselineWon?'10':'11');
        if(mode==='capture-edit'){assert.equal(s.summary('111').baseline?.quantity??null,baselineWon?'20':null);if(!baselineWon)command(s,{type:'baseline.capture',replace:false});}
        else assert.equal(s.group('111','work',id).quantity,baselineWon?'20':'35');
        const head=s.summary('111').baseline!,rows=s.db.prepare('SELECT quantity FROM baseline_groups WHERE owner=?').all('111') as {quantity:string}[];assert.equal(head.quantity,rows.reduce((n,g)=>n+BigInt(g.quantity),0n).toString());
      }
    }finally{s.close();}
  }finally{await Promise.all(workers.map(w=>w.terminate()));rmSync(dir,{recursive:true,force:true});}
});
