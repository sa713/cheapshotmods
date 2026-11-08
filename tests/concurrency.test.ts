import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../apps/server/src/store.js';
import {add,choice,command} from './helpers.js';

for(const mode of ['single','batch','raw-single','raw-batch'])test('two worker threads contend on independent SQLite connections and commit exactly once '+mode,{timeout:20000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-workers-')),path=join(dir,'db.sqlite'),setup=new Store(path),id=mode.startsWith('raw')?command(setup,{type:'original.put',kind:'raw-purple',tier:0,value:'5',crit:'13',quantity:'6'}).createdId!:add(setup),initial=setup.summary('111');setup.close();
  const gate=new SharedArrayBuffer(4),workers:Worker[]=[];
  try {
    const results=await new Promise<{ok:boolean;error?:string}[]>((resolve,reject)=>{
      let ready=0;const results:{ok:boolean;error?:string}[]=[];
      for(let i=0;i<2;i++) {
        const worker=new Worker(new URL('./fixtures/command-worker.mjs',import.meta.url),{workerData:{path,gate,command:{key:randomUUID(),revision:initial.revision,experiment:initial.experiment,action:mode.endsWith('single')?{type:'craft',items:[choice(id)]}:{type:'fuse',fuse:{kind:mode.startsWith('raw')?'🧿':'🅾',targetTier:mode.startsWith('raw')?1:2,count:'1',items:[choice(id,'6')]}}}}});workers.push(worker);
        worker.on('error',reject);
        worker.on('message',(message:{ready?:boolean;done?:boolean;ok?:boolean;error?:string})=>{
          if(message.ready&&++ready===2){Atomics.store(new Int32Array(gate),0,1);Atomics.notify(new Int32Array(gate),0,2);}
          if(message.done){results.push({ok:message.ok===true,error:message.error});if(results.length===2)resolve(results);}
        });
      }
    });
    assert.equal(results.filter(r=>r.ok).length,1);assert.equal(results.filter(r=>r.error==='REVISION_CONFLICT').length,1);
    const restored=new Store(path);try {
      assert.equal(restored.summary('111').revision,(BigInt(initial.revision)+1n).toString());assert.equal(restored.summary('111').spent,mode.startsWith('raw')?'24':'84');
      assert.equal(restored.group('111','work',id).quantity,'3');assert.equal(restored.inventory('111','work').length,2);
      assert.equal((restored.db.prepare('SELECT count(*) AS n FROM history').get() as {n:number}).n,1);
    }finally{restored.close();}
  }finally{await Promise.all(workers.map(w=>w.terminate()));rmSync(dir,{recursive:true,force:true});}
});
