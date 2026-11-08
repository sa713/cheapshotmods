import {parentPort,workerData} from 'node:worker_threads';
import {Store} from '../../apps/server/dist/store.js';

const store=new Store(workerData.path),gate=new Int32Array(workerData.gate);
try {
  parentPort.postMessage({ready:true});
  if(Atomics.wait(gate,0,0,10000)==='timed-out')throw new Error('fixture barrier timeout');
  try {store.command('111',workerData.command);parentPort.postMessage({done:true,ok:true});}
  catch(e){parentPort.postMessage({done:true,ok:false,error:e.code??e.message});}
}finally{store.close();}
