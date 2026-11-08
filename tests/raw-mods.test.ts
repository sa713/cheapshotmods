import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {craft,familyKind,fuseRequest,mod,modKey,planFuse,rawKinds,stats,type FuseChoice,type Kind,type Mod} from '@chm/rules';
import {Store} from '../apps/server/src/store.js';
import {choice,command} from './helpers.js';
const raw=(kind:Kind='raw-purple',value=kind==='raw-green'?'8':'5'):Mod=>({kind,tier:0,value,crit:kind==='raw-green'?null:'13'});
const add=(s:Store,quantity='9',m=raw(),owner='111')=>command(s,{type:'original.put',...m,quantity},owner).createdId!;
const stock=(s:Store)=>s.inventory('111','work','',200);
const request=(s:Store,id:string,targetTier=2,count='1',worn='0')=>fuseRequest({kind:familyKind(s.group('111','work',id).kind),targetTier,count,items:[choice(id,s.group('111','work',id).quantity,worn)]});
const batch=(s:Store,id:string,t=2,n='1',w='0')=>command(s,{type:'fuse',fuse:request(s,id,t,n,w)});
const triple=(s:Store,id:string,w='0')=>command(s,{type:'craft',items:[choice(id,'3',w)]});
const snapshot=(s:Store)=>s.db.serialize();

test('raw recipes, every reachable green value and fixed fields match the supplied contract',()=>{
  for(const [kind,price,output] of [['raw-purple','24','🧿'],['raw-red','22','💢'],['raw-green','28','🅾']] as const){
    const m=raw(kind),result=craft([m,m,m]);assert.equal(result.price,price);assert.deepEqual(result.result,{kind:output,tier:1,value:kind==='raw-green'?'12':'8',crit:kind==='raw-green'?null:'20'});assert.deepEqual(mod(result.result),result.result);
  }
  for(const [v,expected] of [['6','9'],['7','11'],['8','12'],['9','14'],['10','15']])assert.equal(craft(Array(3).fill(raw('raw-green',v))).result.value,expected);
  assert.equal(craft(['6','7','8'].map(v=>raw('raw-green',v))).result.value,'11');
  const reached=new Set<string>();for(let a=6;a<=10;a++)for(let b=6;b<=10;b++)for(let c=6;c<=10;c++){
    const r=craft([a,b,c].map(v=>raw('raw-green',String(v)))).result;assert.equal(r.value,String(Math.ceil((a+b+c)/2)));mod(r);reached.add(r.value);
  }assert.deepEqual([...reached],['9','10','11','12','13','14','15']);
  for(const kind of rawKinds){for(const tier of [1,2,3,6,-1,0.1,'0'])assert.throws(()=>mod({...raw(kind),tier}));}
  for(const m of [{...raw(),value:'6'},{...raw(),crit:'14'},{...raw(),crit:null},raw('raw-green','5'),raw('raw-green','11'),raw('raw-green','6.5'),{...raw('raw-green'),crit:'0'}])assert.throws(()=>mod(m));
  assert.throws(()=>craft([raw(),raw('raw-red'),raw()]));assert.throws(()=>craft([raw(),raw(),{kind:'🧿',tier:1,value:'8',crit:'20'}]));
});

test('raw equipment shares the cap, sums before rounding and keeps ordinary unknown crit',()=>{
  for(const kind of rawKinds){const m=raw(kind);const p=stats('200',[{...m,quantity:'1'}]);assert.equal(p.damage,kind==='raw-green'?'216':'210');assert.equal(p.health,'200');assert.equal(p.crit,kind==='raw-green'?'0':'39');}
  assert.deepEqual(stats('200',[{...raw(),quantity:'100'}]),{damage:'1200',health:'200',crit:'3900',critIncomplete:false});
  assert.equal(stats('101',[{...raw(),quantity:'1'},{...raw('raw-red'),quantity:'1'},{kind:'🅾',value:'9',quantity:'1'}]).damage,'121');
  assert.equal(stats('200',[{...raw(),quantity:'1'},{kind:'🧿',value:'8',quantity:'1',crit:null}]).crit,null);
  const s=new Store(':memory:');try{const id=add(s,'1000'),ordinary=add(s,'1',{kind:'🅾',tier:1,value:'9'});command(s,{type:'equip',items:[{id,quantity:'100'}]});const before=snapshot(s);assert.throws(()=>command(s,{type:'equip',items:[{id,quantity:'100'},{id:ordinary,quantity:'1'}]}),/EQUIPMENT_LIMIT/);assert.deepEqual(snapshot(s),before);}finally{s.close();}
});

test('raw to tiers 1/2/6 prices; mixed creation rejected and explicit homogeneous steps preserve prices',()=>{
  for(const [kind,price,value,crit] of [['raw-purple','144','12','30'],['raw-red','132','12','30'],['raw-green','168','18',null]] as const){const s=new Store(':memory:');try{const id=add(s,'9',raw(kind)),p=s.summary('111'),before=snapshot(s);const plan=s.preview('111',{revision:p.revision,experiment:p.experiment,fuse:request(s,id)});assert.deepEqual(snapshot(s),before);assert.equal(plan.price,price);batch(s,id);assert.equal(stock(s)[0]!.value,value);assert.equal(stock(s)[0]!.crit,crit);assert.equal(s.inventory('111','original')[0]!.quantity,'9');command(s,{type:'undo'});assert.equal(stock(s)[0]!.quantity,'9');}finally{s.close();}}
  const s=new Store(':memory:');try{const id=add(s,'3'),ready=add(s,'2',{kind:'🧿',tier:1,value:'8',crit:'20'});const before=snapshot(s);assert.throws(()=>command(s,{type:'fuse',fuse:{kind:'🧿',targetTier:2,count:'1',items:[choice(id),choice(ready,'2')]}}),/HOMOGENEOUS_GROUP_REQUIRED/);assert.deepEqual(snapshot(s),before);batch(s,id,1);batch(s,stock(s).find(g=>g.tier===1)!.id,2);assert.equal(s.summary('111').spent,'96');assert.equal(stock(s)[0]!.value,'12');assert.equal(stock(s)[0]!.crit,'30');}finally{s.close();}
  for(const t of [1,6]){const s=new Store(':memory:');try{const id=add(s,t===6?'729':'3',raw('raw-green','10'));const r=batch(s,id,t);assert.equal(r.spent,t===6?'40824':'28');assert.equal(stock(s)[0]!.value,t===6?'120':'15');assert.equal((r.lastCraft!.plan as {steps:unknown[]}).steps.length,t);}finally{s.close();}}
  assert.throws(()=>fuseRequest({kind:'💚',targetTier:1,count:'1',items:[choice('x')]}),/INVALID_TARGET/);
  assert.throws(()=>fuseRequest({kind:'raw-purple',targetTier:2,count:'1',items:[choice('x')]}),/INVALID_TARGET/);
});

test('compact batch equals an independent ordered single-recipe sequence including every crit ceiling',()=>{
  for(const kind of rawKinds){for(const targetTier of [1,2,3]){
    const units:Mod[]=Array.from({length:3**targetTier},(_,i)=>raw(kind,kind==='raw-green'?String(6+i%5):'5'));
    // Tiny reference expands only this bounded test pool, using the published arithmetic.
    let expected=units,price=0n;
    for(let t=0;t<targetTier;t++){const next:Mod[]=[];for(let i=0;i<expected.length;i+=3){const triple=expected.slice(i,i+3);next.push({kind:familyKind(kind),tier:t+1,value:((triple.reduce((n,m)=>n+BigInt(m.value),0n)+1n)/2n).toString(),crit:kind==='raw-green'?null:((triple.reduce((n,m)=>n+BigInt(m.crit!),0n)+1n)/2n).toString()});price+=BigInt(t===0?kind==='raw-purple'?24:kind==='raw-red'?22:28:(kind==='raw-purple'?72:kind==='raw-red'?66:84)*3**(t-1));}expected=next;}
    const groups:FuseChoice[]=units.map((m,i)=>({...m,id:String(i),quantity:'1',equipped:'0'}));
    const plan=planFuse(fuseRequest({kind:familyKind(kind),targetTier,count:'1',items:groups.map(g=>choice(g.id,'1'))}),groups);
    assert.equal(modKey(plan.outputs[0]!),modKey(expected[0]!));assert.equal(plan.price,price.toString());
  }}
});

test('worn raw single consumes only explicit part, output is unworn, undo restores outfit and current level',()=>{
  const s=new Store(':memory:');try{const id=add(s,'3');command(s,{type:'level',value:'200'});command(s,{type:'equip',items:[{id,quantity:'3'}]});assert.equal(s.summary('111').stats.damage,'230');assert.equal(s.summary('111').stats.crit,'117');const before=snapshot(s);assert.throws(()=>triple(s,id),/INSUFFICIENT_MODS/);assert.deepEqual(snapshot(s),before);
    const r=triple(s,id,'3');assert.equal(r.stats.damage,'200');assert.equal(r.stats.crit,'0');assert.deepEqual(r.equipment,[]);command(s,{type:'equip',items:[{id:r.createdId,quantity:'1'}]});assert.equal(s.summary('111').stats.damage,'216');assert.equal(s.summary('111').stats.crit,'60');command(s,{type:'level',value:'201'});command(s,{type:'undo'});assert.equal(s.summary('111').equipment[0]!.quantity,'3');assert.equal(s.summary('111').level,'201');assert.equal(s.summary('111').spent,'0');
  }finally{s.close();}
});

test('raw single → homogeneous batch → single, merges/splits/additions preserve later lots once across all undo',()=>{
  const s=new Store(':memory:');try{const id=add(s,'27');triple(s,id);command(s,{type:'equip',items:[{id,quantity:'20'}]});
    command(s,{type:'fuse',fuse:{kind:'🧿',targetTier:2,count:'1',items:[choice(id,'24','20')]}});const out=stock(s).find(g=>g.tier===2)!;assert.equal(s.summary('111').equipment[0]!.quantity,'15');
    add(s,'2',{kind:'🧿',tier:2,value:'12',crit:'30'});triple(s,out.id);add(s,'2');command(s,{type:'original.put',id,...raw(),quantity:'29'});command(s,{type:'level',value:'333'});
    for(let i=0;i<3;i++)command(s,{type:'undo'});assert.equal(stock(s).find(g=>g.tier===0)!.quantity,'31');assert.equal(stock(s).find(g=>g.tier===2)!.quantity,'2');assert.equal(s.summary('111').equipment.length,0);assert.equal(s.summary('111').level,'333');assert.equal(s.summary('111').spent,'0');
    // Source edits do not rewrite active work; reset uses current source.
    const before=stock(s);command(s,{type:'original.put',id,...raw('raw-red'),quantity:'1'});command(s,{type:'original.delete',id});assert.deepEqual(stock(s),before);command(s,{type:'reset'});assert.equal(stock(s).find(g=>g.tier===0)!.quantity,'2');
  }finally{s.close();}
});

test('invalid raw commands, owners and forbidden worn fail atomically; retries/conflicts/expired receipts retain guarantees',()=>{
  const s=new Store(':memory:');try{const id=add(s,'9'),foreign=add(s,'3',raw(),'222');
    const actions=[{type:'original.put',...raw(),value:'6',quantity:'1'},{type:'original.put',...raw('raw-green'),value:'6.5',quantity:'1'},
      {type:'craft',items:[choice(foreign)]},{type:'craft',items:[choice(id,'1'),choice(id,'2')]},
      {type:'fuse',fuse:{...request(s,id),items:[choice(id,'10')]}},{type:'fuse',fuse:{...request(s,id),items:[choice(id,'9','1')]}}];
    for(const action of actions){const before=snapshot(s);assert.throws(()=>command(s,action));assert.deepEqual(snapshot(s),before);}
    for(const type of ['craft','fuse','original.put']){const p=s.summary('111'),payload={key:randomUUID(),revision:p.revision,experiment:p.experiment,action:type==='craft'?{type,items:[choice(id)]}:type==='fuse'?{type,fuse:request(s,id,1)}:{type,...raw(),quantity:'3'}};const result=s.command('111',payload);assert.deepEqual(s.command('111',payload),result);assert.throws(()=>s.command('111',{...payload,action:{type:'level',value:'2'}}),/KEY_REUSED/);assert.throws(()=>s.command('111',{...payload,key:randomUUID()}),/REVISION_CONFLICT/);
      s.db.prepare('UPDATE commands SET created=1 WHERE key=?').run(payload.key);s.maintain();assert.throws(()=>s.command('111',payload),/COMMAND_EXPIRED/);
    }
  }finally{s.close();}
});

test('raw batch fault injection rolls back plan/lots/history/receipt and huge six-step counts stay compact',()=>{
  for(const phase of ['plan','intermediate','history','receipt']){let armed=false;const s=new Store(':memory:',p=>{if(armed&&p===phase)throw Error('fault');});try{const id=add(s,'729',raw('raw-green','10')),before=snapshot(s);armed=true;assert.throws(()=>batch(s,id,6),/fault/);assert.deepEqual(snapshot(s),before);}finally{s.close();}}
  const s=new Store(':memory:');try{const n=10n**24n,id=add(s,(729n*n).toString(),raw('raw-green','10')),p=s.summary('111'),start=performance.now();const plan=s.preview('111',{revision:p.revision,experiment:p.experiment,fuse:request(s,id,6,n.toString())});batch(s,id,6,n.toString());assert.equal(s.summary('111').spent,(40824n*n).toString());assert.equal(stock(s)[0]!.quantity,n.toString());assert.equal(plan.steps.length,6);assert.ok(JSON.stringify(plan).length<10000);command(s,{type:'undo'});assert.equal(stock(s)[0]!.quantity,(729n*n).toString());assert.ok(performance.now()-start<2000);}finally{s.close();}
});
