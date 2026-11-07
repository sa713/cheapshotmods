import {test} from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {Store} from '../apps/server/src/store.js';
import {add,choice,command} from './helpers.js';
import {legacy,seedLegacy} from './fixtures/legacy-v2.js';

test('identical crafted mods occupy one work row; each undo removes just one result',()=>{
  const s=new Store(':memory:');
  try {
    const input=add(s,'6','💢',3,'18');
    const first=command(s,{type:'craft',items:[choice(input)]});
    const second=command(s,{type:'craft',items:[choice(input)]});
    const results=s.inventory('111','work');
    assert.equal(results.length,1);
    assert.equal(second.createdId,first.createdId);
    assert.deepEqual({...results[0],id:undefined},{id:undefined,kind:'💢',tier:4,value:'27',quantity:'2'});
    assert.equal(second.spent,'1188');
    assert.equal(s.summary('111').lastCraft!.output.quantity,'1');
    assert.equal(command(s,{type:'undo'}).spent,'594');
    assert.equal(s.group('111','work',first.createdId).quantity,'1');
    assert.equal(command(s,{type:'undo'}).spent,'0');
    assert.equal(s.inventory('111','work').length,1);
    assert.equal(s.group('111','work',input).quantity,'6');
    assert.equal(s.inventory('111','original')[0]!.quantity,'6');
  }finally{s.close();}
});

test('source batch edits adjust work by attributes, even when their IDs no longer identify the same mod',()=>{
  const s=new Store(':memory:');
  try {
    const a=add(s,'2'), b=add(s,'3');
    assert.equal(s.inventory('111','original').length,2);
    assert.equal(s.inventory('111','work').length,1);
    assert.equal(s.group('111','work',a).quantity,'5');
    command(s,{type:'original.put',id:a,kind:'🅾',tier:1,value:'11',quantity:'4'});
    assert.equal(s.group('111','work',a).value,'10');
    assert.equal(s.group('111','work',a).quantity,'3');
    const different=s.inventory('111','work').find(g=>g.value==='11')!;
    assert.notEqual(different.id,a);assert.equal(different.quantity,'4');
    command(s,{type:'original.delete',id:a});
    assert.equal(s.group('111','work',a).quantity,'3');
    assert.equal(s.inventory('111','work').length,1);
    command(s,{type:'original.put',id:b,kind:'🅾',tier:1,value:'10',quantity:'8'});
    assert.equal(s.group('111','work',a).quantity,'8');
    command(s,{type:'equip',items:[{id:a,quantity:'1'}]});
    command(s,{type:'original.put',id:b,kind:'💚',tier:2,value:'100',quantity:'7'});
    assert.equal(s.group('111','work',a).quantity,'8');
    assert.equal(s.group('111','work',a).kind,'🅾');
    command(s,{type:'reset'});
    assert.equal(s.inventory('111','work').length,1);
    assert.equal(s.inventory('111','work')[0]!.kind,'💚');
    assert.equal(s.inventory('111','work')[0]!.quantity,'7');
  }finally{s.close();}
});

test('work totals above 128 digits remain exact without changing editable source batches',()=>{
  const s=new Store(':memory:');
  try {
    const n='9'.repeat(128), a=add(s,n), b=add(s,n);
    assert.equal(s.inventory('111','original').length,2);
    assert.equal(s.group('111','original',a).quantity,n);
    assert.equal(s.group('111','original',b).quantity,n);
    const total=(2n*BigInt(n)).toString(), id=s.inventory('111','work')[0]!.id;
    assert.equal(total.length,129);assert.equal(s.group('111','work',id).quantity,total);
    command(s,{type:'equip',items:[{id,quantity:'1'}]});
    command(s,{type:'craft',items:[choice(id,'3','1')]});
    assert.equal(s.group('111','work',id).quantity,(BigInt(total)-3n).toString());
    command(s,{type:'undo'});assert.equal(s.group('111','work',id).quantity,total);
    command(s,{type:'original.put',id:b,kind:'🅾',tier:1,value:'10',quantity:n});
    command(s,{type:'reset'});assert.equal(s.inventory('111','work')[0]!.quantity,total);
  }finally{s.close();}
});

function tuples(s:Store,owner='111') {
  return s.inventory(owner,'work', '',200).map(g=>[g.kind,g.tier,g.value,g.quantity]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
}
function rows(db:Database.Database) {
  return Object.fromEntries(['players','groups','history','commands','sessions','oidc_codes'].map(t=>[t,db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()]));
}

test('real schema2 duplicates/history migrate once; all undo steps, receipts, owners and source data survive',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'chm-stack-v2-')),path=join(directory,'db');seedLegacy(path);
  const before=new Database(path), original=before.prepare("SELECT * FROM groups WHERE scope='original' ORDER BY owner,id").all();
  const receipts=before.prepare('SELECT * FROM commands ORDER BY owner,key').all();
  const players=before.prepare('SELECT owner,revision,level,experiment,started,spent FROM players ORDER BY owner').all() as {owner:string;revision:string;level:string;experiment:string;started:number;spent:string}[];
  before.close();let s=new Store(path);
  try {
    assert.equal(s.db.pragma('user_version',{simple:true}),3);
    assert.deepEqual(s.db.prepare("SELECT * FROM groups WHERE scope='original' ORDER BY owner,id").all(),original);
    assert.deepEqual(s.db.prepare('SELECT * FROM commands ORDER BY owner,key').all(),receipts);
    for (const p of players) {
      const now=s.player(p.owner);assert.equal(now.revision,(BigInt(p.revision)+1n).toString());
      for (const field of ['level','experiment','started','spent'] as const)assert.equal(now[field],p[field]);
    }
    assert.deepEqual(tuples(s),[['💢',4,'27','2'],['💢',5,'41','1']]);
    assert.equal(s.summary('111').spent,'3564');assert.equal(s.summary('111').stats.damage,'254');
    assert.equal(s.inventory('222','work')[0]!.quantity,'2');
    assert.equal(s.inventory('333','work')[0]!.quantity,'18014398509481988');
    assert.equal(s.inventory('555','work')[0]!.kind,'🅾');assert.equal(s.inventory('555','original')[0]!.kind,'💚');
    assert.equal(s.summary('555').equipment[0]!.id,legacy.ids.separate);
    const history=s.db.prepare('SELECT seq,owner,body FROM history ORDER BY seq').all() as {seq:number;owner:string;body:string}[];
    for (const h of history) {
      const body=JSON.parse(h.body) as {output:{quantity:string};consumed:{quantity:string}[]};
      assert.equal(body.output.quantity,'1');assert.equal(body.consumed.reduce((n,g)=>n+BigInt(g.quantity),0n),3n);
    }
    const receipt=legacy.tables.commands!.filter(r=>r.owner==='111').at(-1)!;
    const current=s.summary('111');
    assert.deepEqual(s.command('111',JSON.parse(receipt.payload as string)),JSON.parse(receipt.result as string));
    assert.deepEqual(s.summary('111'),current);
    assert.throws(()=>s.command('111',{...JSON.parse(receipt.payload as string),action:{type:'level',value:'201'}}),/KEY_REUSED/);
    assert.throws(()=>s.command('111',{key:randomUUID(),revision:(BigInt(current.revision)-1n).toString(),experiment:current.experiment,action:{type:'craft',items:[choice(legacy.ids.a!)]}}),/REVISION_CONFLICT/);
    await s.db.backup(join(directory,'backup'));s.close();s=new Store(path);
    assert.deepEqual(s.summary('111'),current); // reopen3 never bumps again
    const expected=[['1782','5','0','3'],['1188','4','3','3'],['594','3','6','2'],['0','2','9','1']];
    for (const [spent,q4,q3,worn] of expected) {
      const state=command(s,{type:'undo'});
      assert.equal(state.spent,spent);assert.equal(state.level,'200');
      const work=s.inventory('111','work');
      assert.equal(work.find(g=>g.tier===4)!.quantity,q4);
      assert.equal(work.find(g=>g.tier===3)?.quantity??'0',q3);
      assert.equal(state.equipment.reduce((n,e)=>n+BigInt(e.quantity),0n).toString(),worn);
    }
    assert.equal(s.summary('111').lastCraft,null);
    assert.equal(command(s,{type:'undo'},'444').spent,'0');
    assert.equal(s.inventory('444','work')[0]!.quantity,'3');
    const restored=new Store(join(directory,'backup'));
    try {assert.deepEqual(restored.summary('111'),current);assert.equal(command(restored,{type:'undo'}).spent,'1782');}finally{restored.close();}
  }finally{s.close();rmSync(directory,{recursive:true,force:true});}
});

test('corrupt legacy references fail atomically without partially migrating earlier players',()=>{
  for (const fault of ['json','missing','conflicting','quantity','price']) {
    const directory=mkdtempSync(join(tmpdir(),'chm-stack-invalid-')),path=join(directory,'db');seedLegacy(path);
    const db=new Database(path);
    if (fault==='json')db.prepare('UPDATE history SET body=? WHERE owner=?').run('{','444');
    else {
      const row=db.prepare('SELECT seq,body FROM history WHERE owner=?').get('444') as {seq:number;body:string};
      const u=JSON.parse(row.body);
      if(fault==='missing')u.equipment=[{id:'missing-descriptor',quantity:'1'}];
      if(fault==='conflicting')u.consumed[0]={...u.consumed[0],id:u.output.id};
      if(fault==='quantity')u.output.quantity='2';
      if(fault==='price')u.price='999999';
      db.prepare('UPDATE history SET body=? WHERE seq=?').run(JSON.stringify(u),row.seq);
    }
    const snapshot=rows(db);db.close();
    assert.throws(()=>new Store(path),/INCONSISTENT_MOD_HISTORY/,fault);
    const after=new Database(path);
    try {
      assert.equal(after.pragma('user_version',{simple:true}),2);
      assert.deepEqual(rows(after),snapshot,fault);
      assert.equal((after.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='groups_work_stack'").get() as {n:number}).n,0);
    }finally{after.close();rmSync(directory,{recursive:true,force:true});}
  }
});

test('craft into an existing worn stack and undo preserve its previous count and equipment',()=>{
  const s=new Store(':memory:');
  try {
    const existing=add(s,'7','💢',4,'27'),input=add(s,'3','💢',3,'18');
    command(s,{type:'equip',items:[{id:existing,quantity:'2'}]});
    const result=command(s,{type:'craft',items:[choice(input)]});
    assert.equal(result.createdId,existing);
    assert.equal(s.group('111','work',existing).quantity,'8');
    assert.deepEqual(result.equipment,[{id:existing,quantity:'2'}]);
    command(s,{type:'equip',items:[{id:existing,quantity:'8'}]});
    const undone=command(s,{type:'undo'});
    assert.equal(s.group('111','work',existing).quantity,'7');
    assert.equal(s.group('111','work',input).quantity,'3');
    assert.deepEqual(undone.equipment,[{id:existing,quantity:'2'}]);
    assert.equal(undone.spent,'0');
  }finally{s.close();}
});

test('migration crosses bounded history batches with exact SQLite sequence IDs',()=>{
  const directory=mkdtempSync(join(tmpdir(),'chm-stack-history-')),path=join(directory,'db');seedLegacy(path);
  const db=new Database(path),base=legacy.ids.only!;
  const row=db.prepare('SELECT body FROM history WHERE owner=?').get('444') as {body:string};
  const u=JSON.parse(row.body),first=9007199254740993n;
  db.transaction(()=>{
    db.prepare('DELETE FROM history WHERE owner=?').run('444');
    db.prepare("DELETE FROM groups WHERE owner=? AND scope='work'").run('444');
    db.prepare("UPDATE groups SET quantity='615' WHERE owner=? AND scope='original'").run('444');
    db.prepare("UPDATE players SET spent=?,equipment='[]' WHERE owner=?").run((205n*BigInt(u.price)).toString(),'444');
    for(let i=0;i<205;i++){
      const output={...u.output,id:'bulk-output-'+String(i).padStart(3,'0')};
      db.prepare("INSERT INTO groups VALUES (?,'work',?,?,?,?,?)").run('444',output.id,output.kind,output.tier,output.value,'1');
      db.prepare('INSERT INTO history VALUES (?,?,?)').run(first+BigInt(i),'444',JSON.stringify({...u,output}));
    }
  }).immediate();db.close();
  const s=new Store(path);
  try {
    assert.equal(s.inventory('444','work').length,1);assert.equal(s.inventory('444','work')[0]!.quantity,'205');
    const sequences=s.db.prepare('SELECT seq FROM history WHERE owner=? ORDER BY seq').safeIntegers().all('444') as {seq:bigint}[];
    assert.equal(sequences[0]!.seq,first);assert.equal(sequences.at(-1)!.seq,first+204n);
    for(let i=0;i<205;i++)command(s,{type:'undo'},'444');
    assert.equal(s.summary('444').spent,'0');assert.equal(s.summary('444').lastCraft,null);
    assert.equal(s.group('444','work',base).quantity,'615');assert.equal(s.inventory('444','work').length,1);
  }finally{s.close();rmSync(directory,{recursive:true,force:true});}
});

test('stack identity includes owner, kind, tier and value',()=>{
  const s=new Store(':memory:');
  try {
    add(s,'2','💢',3,'18');add(s,'3','💢',3,'18');
    add(s,'4','💢',3,'19');add(s,'5','💢',4,'18');add(s,'6','🅾',3,'18');
    command(s,{type:'original.put',kind:'💢',tier:3,value:'18',quantity:'7'},'222');
    assert.equal(s.inventory('111','work').length,4);
    assert.equal(s.inventory('111','work').find(g=>g.kind==='💢'&&g.tier===3&&g.value==='18')!.quantity,'5');
    assert.equal(s.inventory('222','work')[0]!.quantity,'7');
    const duplicate=s.inventory('111','work')[0]!;
    assert.throws(()=>s.put('111','work',{...duplicate,id:randomUUID()}),/UNIQUE/);
  }finally{s.close();}
});
