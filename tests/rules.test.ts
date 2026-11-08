import {test} from 'node:test';
import assert from 'node:assert/strict';
import {craft,integer,mod,stats,ordinaryKinds as kinds,type Kind,type OrdinaryKind} from '@chm/rules';
test('all 20 prices and every tier transition match PRODUCT constants',()=>{
  const expected={ '🅾':['84','252','756','2268','6804'], '💢':['66','198','594','1782','5346'], '💚':['54','162','486','1458','4374'], '🧿':['72','216','648','1944','5832'] };
  const chains: [OrdinaryKind,string[]][]=[['🅾',['10','15','23','35','53','80']],['🅾',['11','17','26','39','59','89']],['🅾',['12','18','27','41','62','93']],['💢',['8','12','18','27','41','62']],['🧿',['8','12','18','27','41','62']],['💚',['1','2','3','5','8','12']]];
  for (const [kind,values] of chains) for(let tier=1;tier<=5;tier++) {
    const input={kind,tier,value:values[tier-1]!};
    assert.deepEqual(craft([input,input,input]),{result:{kind,tier:tier+1,value:values[tier],crit:null},price:expected[kind][tier-1]});
  }
  assert.equal(craft(['10','11','12'].map(value=>({kind:'🅾',tier:1,value}))).result.value,'17');
  assert.equal(craft(['10','10','11'].map(value=>({kind:'🅾',tier:1,value}))).result.value,'16');
});
test('stats round once after adding percentages and enforce 100 equipped',()=>{
  assert.deepEqual(stats('200',[]),{damage:'200',health:'200',crit:'0',critIncomplete:false});
  assert.deepEqual(stats('200',(['🅾','💢','🧿'] as Kind[]).map(kind=>({kind,value:kind==='🅾'?'10':'8',quantity:'1'}))),{damage:'252',health:'200',crit:null,critIncomplete:true});
  assert.equal(stats('101',[{kind:'💢',value:'8',quantity:'1'}]).damage,'110');
  assert.equal(stats('101',[{kind:'💢',value:'8',quantity:'2'}]).damage,'118');
  assert.equal(stats('200',[{kind:'🅾',value:'10',quantity:'100'}]).damage,'2200');
  assert.equal(stats('200',[{kind:'💚',value:'10',quantity:'1'}]).health,'220');
  assert.throws(()=>stats('200',[{kind:'🅾',value:'10',quantity:'101'}]));
  const big='9007199254740993';
  assert.deepEqual(stats(big,[{kind:'💚',value:big,quantity:'1'}]),{damage:big,health:'811296384146076004301129887254',crit:'0',critIncomplete:false});
});
test('strict decimal validation and invalid craft combinations',()=>{
  for (const bad of [0,1,1.5,null,{},'-1','0','1.2','1e3','+1','01',' 1','NaN']) assert.throws(()=>integer(bad));
  for (const kind of kinds) for (const tier of [0,7,1.1,'1']) assert.throws(()=>mod({kind,tier,value:'10'}));
  for (const [kind,value] of [['🅾','16'],['💢','9'],['🧿','10'],['💚','0'],['bad','1']]) assert.throws(()=>mod({kind,tier:1,value}));
  for (const kind of kinds) for(let tier=2;tier<=6;tier++) assert.equal(mod({kind,tier,value:'9007199254740993'}).value,'9007199254740993');
  const a={kind:'🅾' as const,tier:1,value:'10'};
  assert.throws(()=>craft([a,a]));assert.throws(()=>craft([a,a,{...a,kind:'💢',value:'8'}]));
  assert.throws(()=>craft([a,a,{...a,tier:2}])); assert.throws(()=>craft([a,a,a].map(m=>({...m,tier:6}))));
});
