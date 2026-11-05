import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../apps/server/src/store.js';
import {add,choice,command} from './helpers.js';
test('two crafts, repeated undo, worn selection and current level survive SQLite reopen and WAL backup',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-'));let s=new Store(join(dir,'db.sqlite'));
  try {
    const id=add(s);command(s,{type:'level',value:'200'});
    command(s,{type:'equip',items:[{id,quantity:'3'}]});
    const state=s.summary('111'), envelope={key:randomUUID(),revision:state.revision,experiment:state.experiment,action:{type:'craft',items:[choice(id,'3','3')]}};
    const first=s.command('111',envelope); assert.equal(first.spent,'84');assert.deepEqual(first.equipment,[]);
    assert.equal(s.inventory('111','original')[0]!.quantity,'6');
    assert.equal(s.inventory('111','work').find(g=>g.id===id)!.quantity,'3');
    // Discarded HTTP response is modelled by ignoring the first result and replaying its exact envelope.
    assert.deepEqual(s.command('111',envelope),first);assert.equal(s.summary('111').revision,first.revision);
    assert.throws(()=>s.command('111',{...envelope,action:{type:'undo'}}),/KEY_REUSED/);
    const second=command(s,{type:'craft',items:[choice(id)]});assert.equal(second.spent,'168');
    command(s,{type:'level',value:'101'});command(s,{type:'equip',items:[{id:second.createdId,quantity:'1'}]});
    const before=s.summary('111'); await s.db.backup(join(dir,'backup.sqlite'));s.close();
    s=new Store(join(dir,'db.sqlite'));assert.deepEqual(s.summary('111'),before);assert.deepEqual(s.command('111',envelope),first);
    assert.equal(command(s,{type:'undo'}).spent,'84');const undone=command(s,{type:'undo'});
    assert.equal(undone.spent,'0');assert.equal(undone.level,'101');assert.deepEqual(undone.equipment,[{id,quantity:'3'}]);assert.equal(s.inventory('111','work')[0]!.quantity,'6');
    const restored=new Store(join(dir,'backup.sqlite'));
    try {assert.deepEqual(restored.summary('111'),before);assert.equal(command(restored,{type:'undo'}).spent,'84');assert.equal(command(restored,{type:'craft',items:[choice(id)]}).spent,'168');}finally{restored.close();}
  } finally {s.close();rmSync(dir,{recursive:true,force:true});}
});
test('source changes are isolated; reset clears history, equipment and expenses, changes experiment but keeps level',()=>{
  const s=new Store(':memory:');try {
    const id=add(s);command(s,{type:'craft',items:[choice(id)]});command(s,{type:'level',value:'9007199254740993'});
    command(s,{type:'original.put',id,kind:'💚',tier:6,value:'9007199254740993',quantity:'9007199254740993'});
    assert.equal(s.group('111','work',id).quantity,'3');assert.equal(s.group('111','work',id).kind,'🅾');
    const old=s.summary('111'), reset=command(s,{type:'reset'});
    assert.equal(reset.spent,'0');assert.equal(reset.lastCraft,null);assert.deepEqual(reset.equipment,[]);assert.equal(reset.level,'9007199254740993');assert.notEqual(reset.experiment,old.experiment);
    assert.equal(s.group('111','work',id).quantity,'9007199254740993');assert.equal(s.group('111','work',id).value,'9007199254740993');
    assert.throws(()=>s.command('111',{key:randomUUID(),revision:reset.revision,experiment:old.experiment,action:{type:'level',value:'5'}}),/REVISION_CONFLICT/);
    command(s,{type:'original.delete',id});assert.equal(s.inventory('111','work').length,1);command(s,{type:'reset'});
    assert.deepEqual(s.inventory('111','work'),[]);assert.deepEqual(s.summary('111').stats,{damage:'9007199254740993',health:'9007199254740993'});
  }finally{s.close();}
});
test('failed commands and injected write failure roll back every part of craft',()=>{
  let fail=false;const s=new Store(':memory:',()=>{if(fail)throw new Error('injected database failure');});try {
    const id=add(s,'101');command(s,{type:'equip',items:[{id,quantity:'100'}]});const before=s.summary('111'),groups=s.inventory('111','work');
    for(const action of [
      {type:'equip',items:[{id,quantity:'101'}]}, {type:'equip',items:[{id,quantity:'1'},{id,quantity:'1'}]},
      {type:'craft',items:[choice(id,'3','0')]}, {type:'craft',items:[choice(id,'2','2'),choice(id,'1','1')]},
      {type:'craft',items:[choice('other')]}, {type:'original.put',kind:'💚',tier:1,value:'1.5',quantity:'1'},
      {type:'craft',items:[choice(id,'3','4')]}, {type:'craft',items:[choice(id,'2','2')]}
    ]) {assert.throws(()=>command(s,action));assert.deepEqual(s.summary('111'),before);assert.deepEqual(s.inventory('111','work'),groups);}
    fail=true;assert.throws(()=>command(s,{type:'craft',items:[choice(id,'3','3')]}),/injected/);
    assert.deepEqual(s.summary('111'),before);assert.deepEqual(s.inventory('111','work'),groups);
    assert.equal((s.db.prepare('SELECT count(*) AS n FROM history').get() as {n:number}).n,0);
  }finally{s.close();}
});
test('competing connections use exactly one revision; quantities stay aggregated and ownership scopes keys',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-'));const a=new Store(join(dir,'db')),b=new Store(join(dir,'db'));
  try {
    const id=add(a,'1000000'),initial=a.summary('111'),key=randomUUID();
    const replies=await Promise.allSettled(Array.from({length:10},(_,i)=>Promise.resolve().then(()=>(i%2?a:b).command('111',{key:randomUUID(),revision:initial.revision,experiment:initial.experiment,action:{type:'craft',items:[choice(id)]}}))));
    assert.equal(replies.filter(r=>r.status==='fulfilled').length,1);assert.equal(replies.filter(r=>r.status==='rejected'&&/REVISION_CONFLICT/.test(String(r.reason))).length,9);
    assert.equal(a.summary('111').spent,'84');assert.equal(a.group('111','work',id).quantity,'999997');assert.equal(a.inventory('111','work').length,2);
    for (const owner of ['111','222']) {const s=a.summary(owner);a.command(owner,{key,revision:s.revision,experiment:s.experiment,action:{type:'level',value:owner}});}
    assert.equal(a.summary('111').level,'111');assert.equal(a.summary('222').level,'222');assert.throws(()=>b.group('222','work',id));
  }finally{a.close();b.close();rmSync(dir,{recursive:true,force:true});}
});
