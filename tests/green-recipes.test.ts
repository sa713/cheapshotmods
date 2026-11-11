import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {greenFuseRequest,planGreenFuse,type FuseChoice,type GreenRecipe} from '@chm/rules';
import {Store} from '../apps/server/src/store.js';
import {command} from './helpers.js';
const add=(s:Store,value:string,quantity:string,owner='111')=>command(s,{type:'original.put',kind:'raw-green',tier:0,value,quantity},owner).createdId!;
const req=(recipe:GreenRecipe='green-667',includeWorn=false,count?:string)=>({recipe,includeWorn,...(count!==undefined?{count}:{})});
const preview=(s:Store,recipe:GreenRecipe='green-667',includeWorn=false,count?:string)=>{const p=s.summary('111'),result=s.preview('111',{revision:p.revision,experiment:p.experiment,fuse:req(recipe,includeWorn,count)});assert.ok('recipe' in result);return result;};
const apply=(s:Store,recipe:GreenRecipe='green-667',includeWorn=false,count?:string)=>command(s,{type:'fuse',fuse:req(recipe,includeWorn,count)});
const stock=(s:Store)=>s.inventory('111','work','',200);
const baseline=(s:Store)=>s.db.prepare('SELECT * FROM baseline_groups ORDER BY owner,id').all();

test('fixed recipes match independently calculated maxima, units, output and price for small complete pools',()=>{
  for(let q6=0;q6<9;q6++)for(let q7=0;q7<9;q7++)for(let q8=0;q8<9;q8++)for(const recipe of ['green-667','green-788'] as const){
    const choices=['6','7','8'].map((value,i)=>({id:value,kind:'raw-green',tier:0,value,quantity:String([q6,q7,q8][i]),equipped:'0',crit:null})) as FuseChoice[];
    const p=planGreenFuse(greenFuseRequest(req(recipe)),choices),n=recipe==='green-667'?Math.min(Math.floor(q6/2),q7):Math.min(q7,Math.floor(q8/2));
    assert.equal(p.count,String(n));assert.equal(p.price,String(n*28));assert.deepEqual(p.result,{kind:'🅾',tier:1,value:recipe==='green-667'?'10':'12',crit:null});assert.equal(p.outputs.length,n?1:0);
    assert.equal(p.selected.reduce((n,s)=>n+BigInt(s.used),0n),3n*BigInt(n));assert.equal(p.steps.length,n?1:0);
  }
});

test('both documented batches share seven-stock; originals, baseline, ledger and atomic undo are preserved',()=>{
  const s=new Store(':memory:');try{
    add(s,'6','10');add(s,'7','6');add(s,'8','8');command(s,{type:'baseline.capture',replace:false});const original=s.inventory('111','original'),point=baseline(s),metadata=s.summary('111').baseline;
    const before=s.db.serialize();assert.deepEqual(preview(s).maxima,{'green-667':'5','green-788':'4'});assert.deepEqual(s.db.serialize(),before);
    const a=apply(s);assert.equal(a.spent,'140');assert.equal(a.lastCraft!.outputs![0]!.quantity,'5');assert.equal(a.lastCraft!.output.value,'10');assert.equal((s.db.prepare('SELECT count(*) n FROM history').get() as {n:number}).n,1);
    assert.deepEqual(preview(s,'green-788').maxima,{'green-667':'0','green-788':'1'});assert.deepEqual(s.inventory('111','original'),original);assert.deepEqual(baseline(s),point);assert.deepEqual(a.baseline,metadata);assert.equal(a.level,'1');
    command(s,{type:'undo'});assert.equal(s.summary('111').spent,'0');assert.deepEqual(stock(s),original);
    const b=apply(s,'green-788');assert.equal(b.spent,'112');assert.equal(b.lastCraft!.output.value,'12');assert.equal(b.lastCraft!.output.kind,'🅾');assert.equal(b.lastCraft!.output.crit,null);assert.equal(b.lastCraft!.output.quantity,'4');assert.equal(stock(s).find(g=>g.value==='6')!.quantity,'10');assert.equal(stock(s).find(g=>g.value==='7')!.quantity,'2');assert.equal(stock(s).filter(g=>g.kind==='raw-green'&&g.value==='8').length,0);
    command(s,{type:'undo'});assert.deepEqual(stock(s),original);
  }finally{s.close();}
});

test('part count, zero shortage and explicit worn permission consume free units first and restore equipment',()=>{
  const s=new Store(':memory:');try{
    add(s,'6','4');const seven=add(s,'7','3');command(s,{type:'equip',items:[{id:seven,quantity:'2'}]});
    assert.equal(preview(s).maxCount,'1');assert.equal(preview(s,'green-667',true).maxCount,'2');const out=apply(s,'green-667',true,'2');assert.equal(out.equipment[0]!.quantity,'1');assert.equal(out.equippedMods[0]!.kind,'raw-green');assert.equal(out.spent,'56');
    command(s,{type:'level',value:'307'});command(s,{type:'undo'});assert.equal(s.summary('111').equipment[0]!.quantity,'2');assert.equal(s.summary('111').level,'307');assert.equal(s.summary('111').spent,'0');
    apply(s,'green-667',false,'1');assert.equal(stock(s).find(g=>g.value==='6')!.quantity,'2');assert.equal(stock(s).find(g=>g.value==='7')!.quantity,'2');assert.equal(preview(s).maxCount,'0');assert.equal(preview(s).ingredients.find(i=>i.value==='7')!.shortfall,'1');
    const bytes=s.db.serialize();assert.throws(()=>apply(s),/INSUFFICIENT_MODS/);assert.deepEqual(s.db.serialize(),bytes);
  }finally{s.close();}
});

test('full server stock includes merged batches and off-page groups; unrelated/foreign mods are never consumed',()=>{
  const s=new Store(':memory:');try{
    for(let i=0;i<110;i++)command(s,{type:'original.put',kind:'💚',tier:2,value:String(i+1),quantity:'1'});
    add(s,'6','3');add(s,'6','7');add(s,'7','6');add(s,'8','8');add(s,'9','100');add(s,'10','100');add(s,'6','900','222');add(s,'7','900','222');
    assert.ok(!s.inventory('111','work').some(g=>g.kind==='raw-green'));assert.deepEqual(preview(s).maxima,{'green-667':'5','green-788':'4'});
    apply(s);assert.equal(stock(s).find(g=>g.kind==='raw-green'&&g.value==='9')!.quantity,'100');assert.equal(stock(s).find(g=>g.kind==='raw-green'&&g.value==='10')!.quantity,'100');assert.equal(s.summary('222').spent,'0');assert.equal(s.inventory('222','work').find(g=>g.value==='6')!.quantity,'900');
  }finally{s.close();}
});

test('recipe grammar refuses forged fields/counts and keeps every SQL table unchanged',()=>{
  const s=new Store(':memory:');try{add(s,'6','3');add(s,'7','1');add(s,'8','3');assert.equal(preview(s).maxCount,'1');assert.equal(preview(s,'green-788').maxCount,'1');
    for(const fuse of [{...req(),count:'0'},{...req(),count:'-1'},{...req(),count:'1.1'},{...req(),count:'2'},{...req(),count:'01'},{...req(),recipe:'green-678'},{...req(),recipe:'toString'},{...req(),includeWorn:'true'},{...req(),output:{}},{...req(),cost:'0'},{...req(),items:[]},{...req(),owner:'222'},{...req(),targetTier:6},{...req(),kind:'raw-red'}]){const bytes=s.db.serialize();assert.throws(()=>command(s,{type:'fuse',fuse}));assert.deepEqual(s.db.serialize(),bytes);}
  }finally{s.close();}
});

test('permanent receipts, KEY_REUSED and stale experiment/revision do not reapply recipes',()=>{
  const s=new Store(':memory:');try{add(s,'6','10');add(s,'7','6');const p=s.summary('111'),payload={key:randomUUID(),revision:p.revision,experiment:p.experiment,action:{type:'fuse',fuse:req()}};const result=s.command('111',payload);
    add(s,'8','8');const current=s.summary('111'),bytes=s.db.serialize();assert.deepEqual(s.command('111',payload),result);assert.deepEqual(s.db.serialize(),bytes);assert.throws(()=>s.command('111',{...payload,action:{type:'fuse',fuse:req('green-788')}}),/KEY_REUSED/);assert.throws(()=>s.command('111',{...payload,key:randomUUID()}),/REVISION_CONFLICT/);
    command(s,{type:'reset'});assert.deepEqual(s.command('111',payload),result);assert.equal(s.summary('111').spent,'0');assert.notEqual(s.summary('111').experiment,current.experiment);
    s.db.prepare('UPDATE commands SET created=1 WHERE key=?').run(payload.key);s.maintain();assert.throws(()=>s.command('111',payload),/COMMAND_EXPIRED/);
  }finally{s.close();}
});

test('partial consumption and late SQL/history/receipt failures roll back the entire recipe',()=>{
  for(const phase of ['consumed','intermediate','history','receipt']){let armed=false;const s=new Store(':memory:',p=>{if(armed&&p===phase)throw Error('recipe-fault');});try{add(s,'6','10');add(s,'7','6');command(s,{type:'baseline.capture',replace:false});const bytes=s.db.serialize();armed=true;assert.throws(()=>apply(s),/recipe-fault/);assert.deepEqual(s.db.serialize(),bytes);}finally{s.close();}}
  for(const table of ['groups','work_lots','history','commands']){const s=new Store(':memory:');try{add(s,'6','10');add(s,'7','6');s.db.exec(`CREATE TRIGGER recipe_failure BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'recipe-sql-fault'); END`);const bytes=s.db.serialize();assert.throws(()=>apply(s),/recipe-sql-fault/);assert.deepEqual(s.db.serialize(),bytes);}finally{s.close();}}
});

test('huge quantities use compact exact arithmetic; late additions and refinement-safe generic undo remain intact',()=>{
  const s=new Store(':memory:');try{const n='9'.repeat(128);command(s,{type:'reset'});for(let i=0;i<4;i++){add(s,'6',n);add(s,'7',n);add(s,'8',n);}const before=s.summary('111'),p=preview(s);assert.equal(p.maxCount,(BigInt(n)*2n).toString());assert.ok(p.maxCount.length>128);assert.equal(p.price,(BigInt(p.maxCount)*28n).toString());assert.ok(JSON.stringify(p).length<15000);
    apply(s);assert.equal((s.db.prepare('SELECT count(*) n FROM history').get() as {n:number}).n,1);assert.ok((s.db.prepare('SELECT count(*) n FROM work_lots').get() as {n:number}).n<20);
    add(s,'6','3');command(s,{type:'undo'});assert.equal(stock(s).find(g=>g.kind==='raw-green'&&g.value==='6')!.quantity,(BigInt(n)*4n+3n).toString());assert.equal(s.summary('111').spent,before.spent);
    const split=planGreenFuse(req('green-667',true),[{id:'a',kind:'raw-green',tier:0,value:'6',quantity:'2',equipped:'2'},{id:'b',kind:'raw-green',tier:0,value:'6',quantity:'2',equipped:'0'},{id:'c',kind:'raw-green',tier:0,value:'7',quantity:'1',equipped:'0'}]);assert.equal(split.selected.find(g=>g.id==='a')!.used,'0');assert.equal(split.selected.find(g=>g.id==='b')!.used,'2');
  }finally{s.close();}
});
