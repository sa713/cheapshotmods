import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {ordinaryKinds,rawKinds,hasCrit,homogeneousFuseRequest,planHomogeneousFuse,craft,modKey,type FuseChoice,type Kind,type Mod} from '@chm/rules';
import {Store} from '../apps/server/src/store.js';
import {add,choice,command} from './helpers.js';
import {seedV5} from './fixtures/legacy-v5.js';
const group=(quantity='20',kind:Kind='🅾',tier=1,value='10',crit:string|null=null,equipped='0'):FuseChoice=>({id:'a',kind,tier,value,crit,quantity,equipped});
const plan=(g=group(),targetTier=3,more:Record<string,unknown>={})=>planHomogeneousFuse(homogeneousFuseRequest({id:g.id,targetTier,includeWorn:false,...more}),g);
const stock=(s:Store,owner='111')=>s.inventory(owner,'work','',200);
const req=(id:string,targetTier=3,more:Record<string,unknown>={})=>({id,targetTier,includeWorn:false,...more});
const rows=(s:Store)=>Object.fromEntries((s.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {name:string}[]).map(({name})=>[name,s.db.prepare('SELECT * FROM '+name).all()]));

test('maximum defaults, floor boundaries, exact prices and leftover source units',()=>{
  const p=plan();assert.equal(p.maxCount,'2');assert.equal(p.count,'2');assert.equal(p.inputPerResult,'9');assert.equal(p.result.value,'23');assert.equal(p.price,'1008');assert.equal(p.selected[0]!.used,'18');assert.equal(p.selected[0]!.remaining,'2');
  const one=plan(group(),3,{count:'1'});assert.equal(one.price,'504');assert.equal(one.selected[0]!.remaining,'11');
  for(const [q,max,left,price] of [['8','0','8','0'],['9','1','0','504'],['100','11','1','5544']]){const p=plan(group(q));assert.equal(p.maxCount,max);assert.equal(p.selected[0]!.remaining,left);assert.equal(p.price,price);}
  assert.equal(plan(group('8')).shortfall,'1');const t2=plan(group('17'),2);assert.equal(t2.maxCount,'5');assert.equal(t2.price,'420');assert.equal(t2.selected[0]!.remaining,'2');
  assert.equal(plan(group(),3,{quantity:'8'}).maxCount,'0');assert.equal(plan(group(),3,{quantity:'9'}).maxCount,'1');
});

test('raw recipes and health keep all intermediate ceilings and six transitions',()=>{
  const purple=plan(group('20','raw-purple',0,'5','13'),2);assert.equal(purple.count,'2');assert.equal(purple.price,'288');assert.equal(purple.result.kind,'🧿');assert.equal(purple.result.value,'12');assert.equal(purple.result.crit,'30');
  const green=plan(group('729','raw-green',0,'10'),6);assert.equal(green.result.value,'120');assert.equal(green.price,'40824');assert.equal(green.steps.length,6);
  assert.equal(plan(group('9','💚',1,'10'),3).result.crit,null);
  assert.equal(plan(group('9','🧿',1,'8','15'),3).result.crit,'35');
  for(const kind of [...ordinaryKinds,...rawKinds])for(let sourceTier=kind.startsWith('raw-')?0:1;sourceTier<=(kind.startsWith('raw-')?0:5);sourceTier++)for(let target=sourceTier+1;target<=6;target++){
    const value=sourceTier===0?(kind==='raw-green'?'10':'5'):sourceTier===1?(kind==='🅾'?'10':'8'):'15',g=group(String(3**(target-sourceTier)),kind,sourceTier,value,hasCrit(kind)?sourceTier===0?'13':'15':null);
    let expected:Mod={kind:g.kind,tier:g.tier,value:g.value,crit:g.crit},pool=3n**BigInt(target-sourceTier),cost=0n;
    for(let t=sourceTier;t<target;t++){const one=craft([expected,expected,expected]);pool/=3n;cost+=pool*BigInt(one.price);expected=one.result;}
    const actual=plan(g,target);assert.equal(modKey(actual.result),modKey(expected));assert.equal(actual.price,cost.toString());
  }
});

test('server count, target, unknown crit and permission bounds refuse before any mutation',()=>{
  const s=new Store(':memory:');try{const id=add(s,'20'),foreign=add(s,'20','🅾',1,'10','222');
    for(const fuse of [req(id,3,{count:'3'}),req(id,3,{count:'0'}),req(id,3,{count:'-1'}),req(id,1),req(id,7),req(id,3,{quantity:'21'}),req(foreign),{...req(id),items:[choice(id)]},{...req(id),kind:'🅾'}]){const before=s.db.serialize();assert.throws(()=>command(s,{type:'fuse',fuse}));assert.deepEqual(s.db.serialize(),before);}
    assert.throws(()=>plan(group('9','🧿',1,'8',null),3),/CRIT_REQUIRED/);
    for(const count of ['','1.1','-1','0','01'])assert.throws(()=>homogeneousFuseRequest(req(id,3,{count})));
    assert.throws(()=>plan(group(),3,{count:'3'}),/FUSE_COUNT_OUT_OF_RANGE/);
    assert.throws(()=>plan(group('100','🅾',6,'80'),6),/INVALID_TARGET/);
  }finally{s.close();}
});

test('one work group alone determines maximum; new legacy mixed requests are refused, single stays mixed',()=>{
  const s=new Store(':memory:');try{const id=add(s,'20');add(s,'100','🅾',2,'15');add(s,'100','🅾',1,'11');add(s,'100','💚',1,'10');
    const a=command(s,{type:'original.put',kind:'🧿',tier:1,value:'8',crit:'15',quantity:'20'}).createdId!,b=command(s,{type:'original.put',kind:'🧿',tier:1,value:'8',crit:'16',quantity:'20'}).createdId!;
    const before=s.summary('111'),p=s.preview('111',{revision:before.revision,experiment:before.experiment,fuse:req(id)});assert.equal(p.maxCount,'2');assert.equal(p.selected.length,1);
    const bytes=s.db.serialize();assert.throws(()=>command(s,{type:'fuse',fuse:{kind:'🧿',targetTier:2,count:'1',items:[choice(a,'2'),choice(b,'1')]}}),/HOMOGENEOUS_GROUP_REQUIRED/);assert.deepEqual(s.db.serialize(),bytes);
    const mixed=stock(s).find(g=>g.kind==='🅾'&&g.value==='11')!,twelve=add(s,'1','🅾',1,'12');command(s,{type:'craft',items:[choice(id,'1'),choice(mixed.id,'1'),choice(twelve,'1')]});assert.equal(s.summary('111').lastCraft!.output.value,'17');
  }finally{s.close();}
});

test('explicit worn permission and input cap determine maximum; free first and undo keeps current level',()=>{
  const s=new Store(':memory:');try{const id=add(s,'20');command(s,{type:'equip',items:[{id,quantity:'3'}]});let p=s.summary('111');
    assert.equal(s.preview('111',{revision:p.revision,experiment:p.experiment,fuse:req(id)}).maxCount,'1');
    assert.equal(s.preview('111',{revision:p.revision,experiment:p.experiment,fuse:req(id,3,{includeWorn:true})}).maxCount,'2');
    assert.equal(s.preview('111',{revision:p.revision,experiment:p.experiment,fuse:req(id,3,{includeWorn:true,quantity:'17'})}).maxCount,'1');
    const out=command(s,{type:'fuse',fuse:req(id,3,{includeWorn:true,count:'2'})});assert.equal(out.spent,'1008');assert.equal(out.equipment[0]!.quantity,'2');assert.equal(stock(s).find(g=>g.id===id)!.quantity,'2');
    command(s,{type:'level',value:'307'});p=command(s,{type:'undo'});assert.equal(p.level,'307');assert.equal(p.equipment[0]!.quantity,'3');assert.equal(p.spent,'0');assert.equal(s.group('111','work',id).quantity,'20');
  }finally{s.close();}
});

test('preview is read-only, max-zero commit fails; retries and stale revision/experiment remain exact',()=>{
  const s=new Store(':memory:');try{const id=add(s,'20'),p=s.summary('111'),initial=s.db.serialize(),body={revision:p.revision,experiment:p.experiment,fuse:req(id)};assert.equal(s.preview('111',body).count,'2');assert.deepEqual(s.db.serialize(),initial);
    const payload={key:randomUUID(),revision:p.revision,experiment:p.experiment,action:{type:'fuse',fuse:req(id)}};const result=s.command('111',payload);assert.equal(result.spent,'1008');assert.deepEqual(s.command('111',payload),result);
    assert.throws(()=>s.command('111',{...payload,key:randomUUID()}),/REVISION_CONFLICT/);assert.throws(()=>s.command('111',{...payload,action:{type:'level',value:'2'}}),/KEY_REUSED/);
    const bytes=s.db.serialize();assert.throws(()=>command(s,{type:'fuse',fuse:req(id)}),/INSUFFICIENT_MODS/);assert.deepEqual(s.db.serialize(),bytes);
    command(s,{type:'reset'});assert.throws(()=>s.preview('111',body),/REVISION_CONFLICT/);assert.deepEqual(s.command('111',payload),result);
    s.db.prepare('UPDATE commands SET created=1 WHERE key=?').run(payload.key);s.maintain();assert.throws(()=>s.command('111',payload),/COMMAND_EXPIRED/);
  }finally{s.close();}
});

test('real canonical schema5 mixed receipts and every old/new undo survive restart and late additions',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm007-legacy-')),path=join(dir,'db');let s:Store|undefined;try{const f=seedV5(path);s=new Store(path);assert.deepEqual(rows(s),f.tables);assert.deepEqual(s.command('888',f.receipt.payload),f.receipt.result);assert.deepEqual(rows(s),f.tables);assert.throws(()=>s!.command('888',f.expired),/COMMAND_EXPIRED/);
    const p=s.summary('888'),bytes=s.db.serialize();assert.throws(()=>s!.command('888',{...f.receipt.payload,key:randomUUID(),revision:p.revision,experiment:p.experiment}),/HOMOGENEOUS_GROUP_REQUIRED/);assert.deepEqual(s.db.serialize(),bytes);
    command(s,{type:'level',value:'307'},'888');const input=stock(s,'888').find(g=>g.kind==='raw-purple')!;command(s,{type:'fuse',fuse:req(input.id,1)},'888');command(s,{type:'original.put',kind:'raw-purple',tier:0,value:'5',crit:'13',quantity:'2'},'888');
    s.close();s=new Store(path);for(let i=0;i<3;i++)command(s,{type:'undo'},'888');const current=stock(s,'888');assert.equal(current.find(g=>g.tier===0)!.quantity,'31');assert.equal(current.find(g=>g.tier===1)!.quantity,'2');assert.equal(current.find(g=>g.tier===3)!.quantity,'2');assert.equal(s.summary('888').spent,'0');assert.equal(s.summary('888').level,'307');assert.equal(s.summary('888').equipment[0]!.quantity,'3');
    command(s,{type:'reset'},'888');assert.equal(stock(s,'888').find(g=>g.tier===0)!.quantity,'31');assert.equal(s.db.pragma('user_version',{simple:true}),5);
  }finally{s?.close();rmSync(dir,{recursive:true,force:true});}
});

test('homogeneous faults roll back lots/history/receipt; derived maximum above128digits is not truncated',()=>{
  for(const phase of ['plan','intermediate','history','receipt']){let armed=false;const s=new Store(':memory:',p=>{if(armed&&phase===p)throw Error('fault');});try{const id=add(s,'20'),before=s.db.serialize();armed=true;assert.throws(()=>command(s,{type:'fuse',fuse:req(id)}),/fault/);assert.deepEqual(s.db.serialize(),before);}finally{s.close();}}
  const s=new Store(':memory:');try{const q='9'.repeat(128);command(s,{type:'reset'});for(let i=0;i<4;i++)add(s,q);const g=stock(s)[0]!,state=s.summary('111'),start=performance.now(),p=s.preview('111',{revision:state.revision,experiment:state.experiment,fuse:req(g.id,2)});
    assert.ok(p.maxCount.length>128);assert.equal(p.maxCount,(BigInt(q)*4n/3n).toString());assert.ok(JSON.stringify(p).length<20000);assert.equal(p.steps.length,1);
    command(s,{type:'fuse',fuse:req(g.id,2,{count:p.maxCount})});assert.equal(s.summary('111').spent,(BigInt(p.maxCount)*84n).toString());command(s,{type:'undo'});assert.equal(stock(s)[0]!.quantity,(BigInt(q)*4n).toString());assert.ok(performance.now()-start<2000);
  }finally{s.close();}
});

test('old unknown-crit mixed receipt replays with consumed IDs absent, then expires safely; refinement preserves old undo',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm007-unknown-')),path=join(dir,'db');let s:Store|undefined;try{const f=seedV5(path);s=new Store(path);const bytes=s.db.serialize();assert.deepEqual(s.command('666',f.unknownReceipt.payload),f.unknownReceipt.result);assert.deepEqual(s.db.serialize(),bytes);
    const unknown=stock(s,'666').find(g=>g.tier===1&&g.crit==null)!;
    for(const fuse of [req(unknown.id,2),{kind:'🧿',targetTier:2,count:'1',items:[choice(unknown.id)]}])assert.throws(()=>command(s!,{type:'fuse',fuse},'666'),/CRIT_REQUIRED/);
    command(s,{type:'work.crit',id:unknown.id,quantity:'3',worn:'0',crit:'15'},'666');command(s,{type:'level',value:'307'},'666');command(s,{type:'undo'},'666');command(s,{type:'undo'},'666');assert.equal(s.summary('666').spent,'0');assert.equal(s.summary('666').level,'307');assert.equal(stock(s,'666').find(g=>g.tier===1&&g.crit==='15')!.quantity,'3');
    s.db.prepare('UPDATE commands SET created=1 WHERE owner=? AND key=?').run('666',f.unknownReceipt.payload.key);s.maintain();assert.throws(()=>s!.command('666',f.unknownReceipt.payload),/COMMAND_EXPIRED/);
  }finally{s?.close();rmSync(dir,{recursive:true,force:true});}
});
