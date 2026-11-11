import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compareGroups,kinds,type Group} from '@chm/rules';
import {Store} from '../apps/server/src/store.js';
import {app} from '../apps/server/src/app.js';
import {Auth} from '../apps/server/src/auth.js';
import {command,config} from './helpers.js';

test('shared order is type, descending tier/value/known crit, then stable ID with exact integers',()=>{
  const g=(id:string,tier:number,value:string,crit:string|null=null,kind:Group['kind']='💢'):Group=>({id,kind,tier,value,crit,quantity:'1'});
  const input=[g('unknown',3,'100'),g('zero',3,'100','0'),g('nine',3,'100','9'),g('ten',3,'100','10'),g('big',3,'1'+'0'.repeat(128),'1'),g('tier',6,'8','0'),g('other',6,'100',null,'💚'),g('b',3,'10','0'),g('a',3,'10','0'),g('low',3,'9','100'),g('first',1,'9',null,'🅾')];
  assert.deepEqual(input.sort(compareGroups).map(g=>g.id),['first','tier','big','ten','nine','zero','unknown','a','b','low','other']);
  assert.equal(compareGroups(g('same',3,'100','10'),g('same',3,'100','10')),0);
  assert.deepEqual([...kinds].reverse().map((kind,i)=>g(String(i),kind.startsWith('raw')?0:2,'10',null,kind)).sort(compareGroups).map(g=>g.kind),kinds);
});

test('real SQLite keyset sorts the complete owner/scope before every bounded page, including ties and huge crit',()=>{
  const s=new Store(':memory:');try{
    s.player('111');s.player('222');let seq=0;const groups:Group[]=[];
    for(const kind of kinds)for(const tier of (kind.startsWith('raw')?[0]:[2,6,3]))for(const value of (kind.startsWith('raw')?kind==='raw-green'?['6','7','8','9','10']:['5']:['9','10','100','9'.repeat(128),'1'+'0'.repeat(128)]))for(const crit of (['💢','🧿'].includes(kind)?[null,'0','9','10','1'+'0'.repeat(130)]:['raw-purple','raw-red'].includes(kind)?['13']:[null])){
      for(let tie=0;tie<2;tie++)groups.push({id:String(seq++).padStart(5,'0'),kind,tier,value,crit,quantity:'9007199254740993'});
    }
    for(const g of [...groups].reverse()){s.put('111','original',g);if(BigInt(g.id)%2n===0n)s.put('111','work',g);s.put('222','original',{...g,value:'1'});}
    const expected=[...groups].sort(compareGroups);
    for(const scope of ['original','work'])for(const limit of [1,37,100,200]){
      const found:Group[]=[];let cursor='';
      for(let page=0;page<groups.length+1;page++){const rows=s.inventory('111',scope,cursor,limit);if(!rows.length)break;found.push(...rows);cursor=rows.at(-1)!.id;}
      const scoped=scope==='work'?expected.filter(g=>BigInt(g.id)%2n===0n):expected;
      assert.deepEqual(found,scoped);assert.equal(new Set(found.map(g=>g.id)).size,scoped.length);
    }
    assert.throws(()=>s.inventory('111','work','not-present'),/REVISION_CONFLICT/);
    for(const limit of [0,201,1.2])assert.throws(()=>s.inventory('111','work','',limit),/INVALID_PAGE/);
  }finally{s.close();}
});

test('HTTP pagination checks revision before following a cursor changed by a mutation',async()=>{
  const s=new Store(':memory:');s.player('111');s.put('111','original',{id:'a',kind:'🅾',tier:1,value:'9',quantity:'1',crit:null});s.put('111','original',{id:'z',kind:'🅾',tier:6,value:'100',quantity:'1',crit:null});
  const f=await app(s,config),session=new Auth(s,config).create('111');try{
    const cookies={chm_session:session.raw},first=await f.inject({url:'/api/inventory?scope=original&limit=1',cookies});assert.equal(first.statusCode,200);assert.equal(first.json().items[0].id,'z');
    const cursor='&after=z&revision='+first.json().revision;const second=await f.inject({url:'/api/inventory?scope=original&limit=1'+cursor,cookies});assert.equal(second.json().items[0].id,'a');
    command(s,{type:'level',value:'200'});const before=s.db.serialize();assert.equal((await f.inject({url:'/api/inventory?scope=original&limit=1'+cursor,cookies})).statusCode,409);assert.deepEqual(s.db.serialize(),before);
    assert.equal((await f.inject({url:'/api/inventory?scope=original&limit=1&revision=-1',cookies})).statusCode,400);
  }finally{await f.close();s.close();}
});
