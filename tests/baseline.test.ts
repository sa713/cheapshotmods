import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {Store} from '../apps/server/src/store.js';
import {backupToFile} from '../apps/server/src/backup-file.js';
import {add,choice,command} from './helpers.js';
import {seedV5} from './fixtures/legacy-v5.js';
const capture={type:'baseline.capture',replace:false},restore={type:'baseline.restore'};
const envelope=(s:Store,action:Record<string,unknown>,owner='111')=>{const p=s.summary(owner);return {key:randomUUID(),revision:p.revision,experiment:p.experiment,action};};
const all=(s:Store,scope='work',owner='111')=>s.db.prepare("SELECT id,kind,tier,value,quantity,NULLIF(crit,'') AS crit FROM groups WHERE owner=? AND scope=? ORDER BY id").all(owner,scope);
const baseline=(s:Store,owner='111')=>({head:s.db.prepare('SELECT * FROM baselines WHERE owner=?').all(owner),groups:s.db.prepare('SELECT * FROM baseline_groups WHERE owner=? ORDER BY id').all(owner)});
const rows=(db:Database.Database)=>Object.fromEntries((db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {name:string}[]).map(({name})=>[name,db.prepare('SELECT * FROM '+name).all()]));

test('explicit snapshot isolates original from fuses and fully restores original/work, spend, equipment and experiment',()=>{
  const s=new Store(':memory:');try{
    const id=add(s,'20'),original=all(s,'original'),active=s.summary('111');
    const fixed=command(s,capture);assert.equal(fixed.experiment,active.experiment);assert.equal(fixed.started,false);assert.equal(fixed.baseline!.quantity,'20');assert.equal(fixed.baseline!.entries,'1');assert.match(fixed.baseline!.capturedAt,/^\d{4}-\d\d-\d\dT/);
    const point=baseline(s);command(s,{type:'fuse',fuse:{id,targetTier:3,includeWorn:false}});
    assert.equal(s.summary('111').spent,'1008');assert.deepEqual(all(s,'original'),original);assert.deepEqual(baseline(s),point);
    assert.equal(s.group('111','work',id).quantity,'2');assert.equal(s.inventory('111','work').find(g=>g.tier===3)!.quantity,'2');
    command(s,{type:'equip',items:[{id,quantity:'2'}]});command(s,{type:'level',value:'307'});const before=s.summary('111');
    const restored=command(s,restore);assert.deepEqual(all(s,'original'),original);assert.deepEqual(all(s),original);assert.deepEqual(baseline(s),point);assert.equal(restored.spent,'0');assert.deepEqual(restored.equipment,[]);assert.equal(restored.lastCraft,null);assert.equal(restored.level,'307');assert.notEqual(restored.experiment,before.experiment);assert.equal(restored.revision,(BigInt(before.revision)+1n).toString());
    const oldPreview={revision:before.revision,experiment:before.experiment,fuse:{id,targetTier:3,includeWorn:false}};assert.throws(()=>s.preview('111',oldPreview),/REVISION_CONFLICT/);assert.throws(()=>s.command('111',{...envelope(s,{type:'level',value:'9'}),experiment:before.experiment}),/REVISION_CONFLICT/);
    assert.equal(s.preview('111',{...oldPreview,revision:restored.revision,experiment:restored.experiment}).maxCount,'2');
    command(s,{type:'craft',items:[choice(id)]});command(s,restore);assert.deepEqual(all(s),original);assert.deepEqual(baseline(s),point);
  }finally{s.close();}
});

test('ordinary reset uses current editable inventory, full restore discards later additions, edits and deletes',()=>{
  const s=new Store(':memory:');try{
    const id=add(s,'20'),other=add(s,'9','💚',2,'12'),original=all(s,'original');command(s,capture);const point=baseline(s);
    command(s,{type:'fuse',fuse:{id,targetTier:3,includeWorn:false}});add(s,'3','raw-green',0,'10');command(s,{type:'original.put',id,kind:'🅾',tier:1,value:'11',quantity:'8'});command(s,{type:'original.delete',id:other});
    const current=all(s,'original');assert.notDeepEqual(current,original);command(s,{type:'reset'});assert.deepEqual(all(s),current);assert.deepEqual(baseline(s),point);
    command(s,restore);assert.deepEqual(all(s,'original'),original);assert.deepEqual(all(s),original);assert.deepEqual(baseline(s),point);
  }finally{s.close();}
});

test('capture requires explicit replacement and changes only snapshot/revision, never work/lots/equipment/history',()=>{
  const s=new Store(':memory:');try{
    const id=add(s,'20'),a=envelope(s,capture),result=s.command('111',a);command(s,{type:'craft',items:[choice(id)]});command(s,{type:'equip',items:[{id,quantity:'1'}]});add(s,'3','💚',2,'12');
    const before=s.summary('111'),tables=rows(s.db),work=all(s),original=all(s,'original');const bytes=s.db.serialize();assert.throws(()=>command(s,capture),/BASELINE_REPLACE_REQUIRED/);assert.deepEqual(s.db.serialize(),bytes);
    const b=command(s,{...capture,replace:true}),after=rows(s.db);assert.equal(b.baseline!.quantity,'23');assert.deepEqual({...b,baseline:before.baseline,revision:before.revision},before);
    for(const table of ['groups','history','work_lots'])assert.deepEqual(after[table],tables[table]);assert.deepEqual(all(s),work);assert.deepEqual(all(s,'original'),original);
    const pointB=baseline(s),latest=s.db.serialize();assert.deepEqual(s.command('111',a),result);assert.deepEqual(baseline(s),pointB);assert.deepEqual(s.db.serialize(),latest);
  }finally{s.close();}
});

test('absent and explicitly empty snapshots differ; restore is repeatable without duplicate stock',()=>{
  const s=new Store(':memory:');try{
    assert.equal(s.summary('111').baseline,null);const bytes=s.db.serialize();assert.throws(()=>command(s,restore),/BASELINE_REQUIRED/);assert.deepEqual(s.db.serialize(),bytes);
    const fixed=command(s,capture);assert.equal(fixed.baseline!.quantity,'0');assert.equal(fixed.baseline!.entries,'0');const point=baseline(s);
    for(let i=0;i<2;i++){const id=add(s,'20');command(s,{type:'craft',items:[choice(id)]});command(s,restore);assert.deepEqual(all(s),[]);assert.deepEqual(all(s,'original'),[]);assert.equal(s.summary('111').spent,'0');assert.equal(s.summary('111').lastCraft,null);assert.deepEqual(baseline(s),point);}
  }finally{s.close();}
});

test('capture copies every page and separate original ID with all ordinary/raw types, huge TEXT and unknown versus zero crit',()=>{
  const s=new Store(':memory:');try{
    const big='9'.repeat(128);for(let i=0;i<115;i++)add(s,'2','💚',2,String(i+1));
    add(s,big,'💚',6,big);add(s,'3');add(s,'4');
    for(const [kind,value,crit] of [['raw-purple','5','13'],['raw-red','5','13'],['raw-green','10',null],['🧿','8','0'],['💢','8','15'],['🌸','8',null]])command(s,{type:'original.put',kind,tier:kind!.startsWith('raw')?0:1,value,crit,quantity:'3'});
    for(let tier=2;tier<=6;tier++)add(s,'1','🅾',tier,'20');
    s.put('111','original',{id:'legacy-unknown',kind:'🧿',tier:2,value:'77',crit:null,quantity:'5'});command(s,{type:'reset'});
    const original=all(s,'original'),quantity=(original as {quantity:string}[]).reduce((q,g)=>q+BigInt(g.quantity),0n).toString();assert.ok(original.length>100);assert.equal(s.inventory('111','original').length,100);
    command(s,capture);assert.equal(s.summary('111').baseline!.quantity,quantity);assert.equal(s.summary('111').baseline!.entries,String(original.length));
    const point=baseline(s);assert.equal(point.groups.length,original.length);command(s,{type:'original.delete',id:'legacy-unknown'});command(s,restore);assert.deepEqual(all(s,'original'),original);
    assert.equal(s.inventory('111','work','',200).filter(g=>g.kind==='🅾'&&g.tier===1).length,1);assert.equal(s.inventory('111','work','',200).find(g=>g.kind==='🅾'&&g.tier===1)!.quantity,'7');
    assert.equal(s.group('111','work','legacy-unknown').crit,null);assert.equal(s.inventory('111','work','',200).find(g=>g.kind==='🧿'&&g.tier===1)!.crit,'0');assert.deepEqual(baseline(s),point);
  }finally{s.close();}
});

test('snapshot never follows single/batch/undo/reset, added stock, refinement, level or equipment',()=>{
  const s=new Store(':memory:');try{
    const id=add(s,'30');s.put('111','original',{id:'unknown',kind:'🧿',tier:1,value:'8',crit:null,quantity:'8'});command(s,{type:'reset'});command(s,capture);const point=baseline(s);
    const actions=[{type:'equip',items:[{id,quantity:'1'}]},{type:'level',value:'307'},{type:'craft',items:[choice(id)]},{type:'undo'},{type:'fuse',fuse:{id,targetTier:3,includeWorn:false}},{type:'original.put',id,kind:'🅾',tier:1,value:'10',quantity:'35'},{type:'undo'},{type:'work.crit',id:'unknown',quantity:'3',worn:'0',crit:'15'},{type:'original.crit',id:'unknown',quantity:'8',crit:'0'},{type:'reset'}];
    for(const action of actions){command(s,action);assert.deepEqual(baseline(s),point,action.type);}
    command(s,restore);assert.equal(s.group('111','original','unknown').crit,null);assert.equal(s.group('111','work','unknown').quantity,'8');assert.equal(s.group('111','work',id).quantity,'30');
  }finally{s.close();}
});

test('restore receipts retry before new semantics, preserve later actions and keep KEY_REUSED/expired/owner guarantees',()=>{
  const s=new Store(':memory:');try{
    add(s,'20');command(s,capture);add(s,'3','💚',2,'11');const request=envelope(s,restore),result=s.command('111',request);add(s,'5','💚',2,'12');const before=s.db.serialize();assert.deepEqual(s.command('111',request),result);assert.deepEqual(s.db.serialize(),before);
    assert.throws(()=>s.command('111',{...request,action:capture}),/KEY_REUSED/);assert.throws(()=>s.command('111',{...request,key:randomUUID()}),/REVISION_CONFLICT/);
    assert.equal(s.summary('222').baseline,null);const foreign=s.db.serialize();assert.throws(()=>command(s,restore,'222'),/BASELINE_REQUIRED/);assert.deepEqual(s.db.serialize(),foreign);command(s,capture,'222');assert.equal(s.summary('222').baseline!.quantity,'0');assert.equal(s.summary('111').baseline!.quantity,'20');
    s.db.prepare('UPDATE commands SET created=1 WHERE owner=? AND key=?').run('111',request.key);s.maintain();const expired=s.db.serialize();assert.throws(()=>s.command('111',request),/COMMAND_EXPIRED/);assert.deepEqual(s.db.serialize(),expired);
  }finally{s.close();}
});

test('capture and full restoration fault points roll back the entire transaction including receipt',()=>{
  for(const [action,phases] of [[{...capture,replace:true},['baseline-capture-cleared','baseline-captured','receipt']],[restore,['baseline-original-cleared','baseline-original-restored','baseline-work-cleared','baseline-history-cleared','baseline-work-restored','receipt']]] as const)for(const phase of phases){
    let armed=false;const s=new Store(':memory:',p=>{if(armed&&p===phase)throw Error('injected baseline fault');});try{
      const id=add(s,'20');command(s,capture);command(s,{type:'craft',items:[choice(id)]});add(s,'3','💚',2,'12');command(s,{type:'equip',items:[{id,quantity:'1'}]});const before=s.db.serialize();armed=true;
      assert.throws(()=>command(s,action),/injected baseline fault/);assert.deepEqual(s.db.serialize(),before,phase);
    }finally{s.close();}
  }
});

test('schema5 real mixed history migrates intact to6 with no implicit snapshot; migration and future-version refusal are atomic',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm008-migrate-')),path=join(dir,'db');let s:Store|undefined;try{
    const f=seedV5(path),old=new Database(path),oldRows=rows(old);old.close();
    assert.throws(()=>new Store(path,phase=>{if(phase==='baseline-migration')throw Error('migration fault');}),/migration fault/);
    const failed=new Database(path);assert.equal(failed.pragma('user_version',{simple:true}),5);assert.deepEqual(rows(failed),oldRows);failed.close();
    s=new Store(path);assert.equal(s.db.pragma('user_version',{simple:true}),6);assert.deepEqual(rows(s.db),{...f.tables,baselines:[],baseline_groups:[]});assert.equal(s.summary('888').baseline,null);assert.equal(s.summary('666').baseline,null);assert.deepEqual(s.command('888',f.receipt.payload),f.receipt.result);assert.deepEqual(s.command('666',f.unknownReceipt.payload),f.unknownReceipt.result);assert.throws(()=>s!.command('888',f.expired),/COMMAND_EXPIRED/);
    s.close();s=new Store(path);assert.deepEqual(rows(s.db),{...f.tables,baselines:[],baseline_groups:[]});command(s,{type:'undo'},'888');assert.equal(s.summary('888').spent,'24');
    command(s,capture,'666');const point=baseline(s,'666');s.close();s=new Store(path);assert.deepEqual(baseline(s,'666'),point);command(s,{type:'undo'},'666');assert.equal(s.summary('666').baseline!.entries,String(point.groups.length));
    s.close();s=undefined;const db=new Database(path);db.pragma('user_version=7');const before=rows(db);db.close();assert.throws(()=>new Store(path),/UNKNOWN_DATABASE_VERSION/);const next=new Database(path);assert.equal(next.pragma('user_version',{simple:true}),7);assert.deepEqual(rows(next),before);next.close();
  }finally{if(s?.db.open)s.close();rmSync(dir,{recursive:true,force:true});}
});

test('online backup includes snapshot A and its active undo state; restore/restart replaces later snapshot B',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm008-backup-')),path=join(dir,'db'),copy=join(dir,'backup');let s=new Store(path);try{
    const id=add(s,'20');command(s,capture);command(s,{type:'craft',items:[choice(id)]});command(s,{type:'equip',items:[{id,quantity:'1'}]});const state=s.summary('111'),point=baseline(s),tables=rows(s.db);
    await backupToFile(s.db,copy);add(s,'3','💚',2,'12');command(s,{...capture,replace:true});command(s,restore);assert.notDeepEqual(baseline(s),point);s.close();s=new Store(copy);assert.deepEqual(rows(s.db),tables);assert.deepEqual(s.summary('111'),state);assert.deepEqual(baseline(s),point);command(s,{type:'undo'});assert.equal(s.summary('111').spent,'0');s.close();s=new Store(copy);command(s,restore);assert.deepEqual(all(s),all(s,'original'));assert.equal(s.group('111','original',id).quantity,'20');assert.deepEqual(baseline(s),point);
  }finally{if(s.db.open)s.close();rmSync(dir,{recursive:true,force:true});}
});
