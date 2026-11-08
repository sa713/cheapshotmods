import {test} from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {fuseRequest,planFuse,parseCrit,formatCrit,displayKind,modKey,craft,stats,type FuseChoice,type Kind} from '@chm/rules';
function g(id:string,tier:number,value:string,quantity:string,kind:Kind='🅾',crit:string|null=null,equipped='0'):FuseChoice{return {id,tier,value,quantity,kind,crit,equipped};}
function plan(groups:FuseChoice[],targetTier=2,count='1',items=groups.map(g=>({id:g.id,quantity:g.quantity,worn:'0'}))){return planFuse(fuseRequest({kind:groups[0]!.kind,targetTier,count,items}),groups);}
test('legacy planner arithmetic for historical mixed fixtures: examples, exact prices and sequential triples; ready selected stock precedes generated stock',()=>{
  assert.deepEqual(plan([g('a',1,'10','6')],2,'2').outputs.map(o=>[o.value,o.quantity]),[['15','2']]);
  for(const [q,tier,price,value] of [['9',3,'504','23'],['27',4,'2268','35']] as const){const p=plan([g('a',1,'10',q)],tier);assert.equal(p.price,price);assert.equal(p.outputs[0]!.value,value);}
  const ready=plan([g('a',1,'10','3'),g('b',2,'15','2')],3);assert.equal(ready.price,'336');assert.equal(ready.outputs[0]!.value,'23');
  assert.equal(plan([g('a',1,'10','2'),g('b',1,'11','1')]).outputs[0]!.value,'16');
  assert.equal(plan([g('a',1,'10','1'),g('b',1,'11','1'),g('c',1,'12','1')]).outputs[0]!.value,'17');
  const ordering=plan([g('a',2,'15','1'),g('b',2,'16','1'),g('c',1,'10','3'),g('d',1,'12','3')],3);
  assert.equal(ordering.outputs[0]!.value,'23');assert.equal(ordering.price,'336');assert.equal(ordering.selected[3]!.used,'0');
  assert.equal(plan([g('h',3,'1','3','💚')],4).price,'486');
});
test('pool is an upper permission bound; free stock first even when worn is allowed',()=>{
  const p=plan([g('a',1,'10','10','🅾',null,'3')],2,'2',[{id:'a',quantity:'6',worn:'2'}]);
  assert.equal(p.selected[0]!.worn,'0');assert.equal(p.selected[0]!.remaining,'4');
  const q=plan([g('a',1,'10','5','🅾',null,'3')],2,'1',[{id:'a',quantity:'4',worn:'2'}]);assert.equal(q.selected[0]!.worn,'1');assert.equal(q.selected[0]!.unused,'1');
  assert.throws(()=>plan([g('a',1,'10','5','🅾',null,'3')],2,'1',[{id:'a',quantity:'3',worn:'0'}]),/INSUFFICIENT_MODS/);
  for(const groups of [[g('a',2,'15','3')],[g('a',1,'10','2')],[g('a',1,'10','2'),g('b',1,'8','1','💢')]])assert.throws(()=>plan(groups));
});
test('crit uses integer thousandths and every intermediate ceiling; unknown is never zero',()=>{
  for(const [raw,normalized] of [['0','0'],['0.0441','45'],['0,015','15'],['123,4560','123456'],['0.0001','1']])assert.equal(parseCrit(raw),normalized);
  for(const bad of ['-1','1e3','1,2.3','01',' 1','.1','1.', '0.'.padEnd(133,'0')])assert.throws(()=>parseCrit(bad));
  assert.equal(formatCrit('0'),'0,000');assert.equal(formatCrit('15'),'0,015');assert.equal(formatCrit(null),'неизвестен');
  const p=plan([g('a',1,'8','9','🧿','15')],3);assert.equal(p.outputs[0]!.crit,'35');assert.equal(p.steps[0]!.outputs[0]!.crit,'23');
  const single=craft(Array(3).fill(g('a',1,'8','1','💢','15'))).result;assert.equal(single.crit,'23');
  assert.equal(stats('1',[{...single,quantity:'1'}]).crit,'69');
  assert.equal(stats('999',[{kind:'💢',value:'8',crit:'44',quantity:'2'}]).crit,'264');
  assert.equal(stats('1',[g('a',1,'8','1','🧿')]).crit,null);
  assert.notEqual(modKey(g('a',1,'8','1','🧿')),modKey(g('b',1,'8','1','🧿','0')));
  assert.equal(displayKind('🅾'),'🅾️');assert.equal(displayKind('💚'),'🌸');
});
test('10^24 tier-3 outputs stay compact; derived values may exceed 128 input digits',()=>{
  const n=10n**24n,start=performance.now(),p=plan([g('a',1,'10',(9n*n).toString())],3,n.toString());
  assert.equal(p.price,(504n*n).toString());assert.equal(p.outputs[0]!.quantity,n.toString());assert.equal(p.steps.length,2);assert.equal(p.steps.flatMap(s=>s.inputs).length,2);
  assert.ok(performance.now()-start<1000);
  const huge='9'.repeat(128),h=plan([g('a',5,huge,'3')],6);assert.equal(h.outputs[0]!.value.length,129);
  assert.throws(()=>fuseRequest({kind:'🅾',targetTier:3,count:'1'.repeat(129),items:[{id:'a',quantity:'9',worn:'0'}]}),/INTEGER_TOO_LONG/);
});
test('technical pool and plan input bounds reject before heavy conversion without becoming game quantity caps',()=>{
  assert.throws(()=>fuseRequest({kind:'🅾',targetTier:2,count:'1',items:Array.from({length:1001},(_,i)=>({id:String(i),quantity:'1',worn:'0'}))}),/FUSE_POOL_TOO_LARGE/);
  assert.throws(()=>fuseRequest({kind:'🅾',targetTier:2,count:'1',items:[{id:'a',quantity:'9'.repeat(257),worn:'0'}]}),/POOL_INTEGER_TOO_LONG/);
  const q='9'.repeat(129),p=plan([g('a',1,'10',q)],2,'1');assert.equal(p.selected[0]!.remaining,(BigInt(q)-3n).toString());
});
