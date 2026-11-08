import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {Store} from '../apps/server/src/store.js';
import {add,choice,command} from './helpers.js';
const stock=(s:Store,owner='111')=>s.inventory(owner,'work','',200);
const known=(s:Store,q='9',kind='🧿',tier=1,value='8',crit='15')=>command(s,{type:'original.put',kind,tier,value,quantity:q,crit}).createdId!;
const fuse=(s:Store,id:string,q='9',targetTier=3,count='1',worn='0')=>command(s,{type:'fuse',fuse:{kind:s.group('111','work',id).kind,targetTier,count,items:[choice(id,q,worn)]}});
test('batch is one undo/revision/receipt; preview is read-only and replay remains exact',()=>{
  const s=new Store(':memory:'),id=add(s,'27'),before=s.summary('111'),request={kind:'🅾',targetTier:3,count:'2',items:[choice(id,'27')]};
  const dump=()=>JSON.stringify(s.db.prepare('SELECT * FROM players').all())+JSON.stringify(s.db.prepare('SELECT * FROM commands').all());const initial=dump();
  const p=s.preview('111',{revision:before.revision,experiment:before.experiment,fuse:request});assert.equal(p.price,'1008');assert.equal(dump(),initial);
  const raw={key:'same-batch-key-001',revision:before.revision,experiment:before.experiment,action:{type:'fuse',fuse:request}},result=s.command('111',raw);
  assert.equal(BigInt(result.revision),BigInt(before.revision)+1n);assert.equal((s.db.prepare('SELECT count(*) AS n FROM history').get() as {n:number}).n,1);
  assert.deepEqual(s.command('111',raw),result);assert.throws(()=>s.command('111',{...raw,action:{type:'level',value:'2'}}),/KEY_REUSED/);
  command(s,{type:'level',value:'200'});command(s,{type:'undo'});assert.equal(stock(s)[0]!.quantity,'27');assert.equal(s.summary('111').level,'200');assert.equal(s.summary('111').spent,'0');s.close();
});
test('active additions and quantity delta preserve history, equipment and later stock across undo',()=>{
  const s=new Store(':memory:'),id=add(s,'6');command(s,{type:'equip',items:[{id,quantity:'1'}]});
  command(s,{type:'craft',items:[choice(id,'3','1')]});
  command(s,{type:'original.put',id,kind:'🅾',tier:1,value:'10',quantity:'8'});
  add(s,'2','🅾',2,'15');command(s,{type:'level',value:'200'});command(s,{type:'undo'});
  assert.equal(stock(s).find(g=>g.tier===1)!.quantity,'8');assert.equal(stock(s).find(g=>g.tier===2)!.quantity,'2');assert.equal(s.summary('111').equipment[0]!.quantity,'1');
  command(s,{type:'original.put',id,kind:'💚',tier:2,value:'100',quantity:'10'});command(s,{type:'original.delete',id});
  assert.equal(stock(s).find(g=>g.tier===1)!.quantity,'8');command(s,{type:'reset'});assert.equal(stock(s).length,1);assert.equal(stock(s)[0]!.tier,2);s.close();
});
test('critical work is grouped by all attributes; partial refinement preserves worn and output lineage',()=>{
  const s=new Store(':memory:'),id=known(s,'9');fuse(s,id);const out=stock(s).find(g=>g.tier===3)!;assert.equal(out.crit,'35');
  known(s,'2','🧿',3,'18','35');assert.equal(stock(s).find(g=>g.tier===3)!.quantity,'3');
  command(s,{type:'undo'});assert.equal(stock(s).find(g=>g.tier===3)!.quantity,'2');assert.equal(stock(s).find(g=>g.tier===1)!.quantity,'9');
  known(s,'1','🧿',1,'8','0');assert.equal(stock(s).filter(g=>g.tier===1).length,2);s.close();
});
function seedV3(path:string){const fixture=JSON.parse(readFileSync(new URL('./fixtures/v3-crit-history.json',import.meta.url),'utf8'));const db=new Database(path);db.exec(fixture.ddl.join(';'));for(const [name,rows] of Object.entries(fixture.tables) as [string,Record<string,unknown>[]][]){for(const row of rows){const columns=Object.keys(row);db.prepare(`INSERT INTO ${name} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...columns.map(c=>row[c] as never));}}db.pragma('user_version=3');db.close();return fixture;}
test('real schema-3 history migration: unknown distinct from zero, split/refine crafted output then undo after reopen',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-crit-')),path=join(dir,'db');try{seedV3(path);let s=new Store(path);
    assert.equal(s.db.pragma('user_version',{simple:true}),6);const before=s.summary('666'),unknown=stock(s,'666').find(g=>g.tier===2)!;
    assert.equal(unknown.crit,null);assert.equal(before.stats.critIncomplete,true);
    command(s,{type:'work.crit',id:unknown.id,quantity:'1',worn:'1',crit:'44'},'666');
    command(s,{type:'original.put',kind:'🧿',tier:2,value:'12',quantity:'2',crit:'44'},'666');
    const source=stock(s,'666').find(g=>g.tier===1)!;command(s,{type:'work.crit',id:source.id,quantity:'2',worn:'0',crit:'0'},'666');
    s.close();s=new Store(path);command(s,{type:'undo'},'666');const items=stock(s,'666');
    assert.equal(items.find(g=>g.tier===2&&g.crit==='44')!.quantity,'2');assert.equal(items.find(g=>g.tier===1&&g.crit===null)!.quantity,'7');assert.equal(items.find(g=>g.tier===1&&g.crit==='0')!.quantity,'2');
    assert.equal(s.summary('666').spent,'0');assert.equal(s.summary('666').equipment.reduce((n,e)=>n+BigInt(e.quantity),0n),1n);
    const revision=s.summary('666').revision;s.close();s=new Store(path);assert.equal(s.summary('666').revision,revision);s.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('failures at batch intermediate/history/receipt roll back all data; preview stale conflicts',()=>{
  for(const phase of ['plan','intermediate','history','receipt']){let armed=false;const s=new Store(':memory:',p=>{if(armed&&p===phase)throw new Error('injected');}),id=add(s,'27');
    const before=s.db.serialize();armed=true;assert.throws(()=>fuse(s,id,'27',4),/injected/);assert.deepEqual(s.db.serialize(),before);s.close();}
  const s=new Store(':memory:'),id=add(s,'9'),p=s.summary('111');command(s,{type:'level',value:'2'});assert.throws(()=>s.preview('111',{revision:p.revision,experiment:p.experiment,fuse:{kind:'🅾',targetTier:3,count:'1',items:[choice(id,'9')]}}),/REVISION_CONFLICT/);s.close();
});
test('original partial crit fill never replenishes a started experiment; known work merge keeps its worn count',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-refine-')),path=join(dir,'db');try{seedV3(path);const s=new Store(path),source=s.inventory('666','original').find(g=>g.kind==='🧿')!;const workSource=stock(s,'666').find(g=>g.tier===1)!;command(s,{type:'equip',items:[{id:workSource.id,quantity:'1'}]},'666');const before=stock(s,'666');
    command(s,{type:'original.crit',id:source.id,quantity:'2',crit:'44'},'666');assert.deepEqual(stock(s,'666'),before);
    const rows=s.inventory('666','original');assert.equal(rows.filter(g=>g.crit==='44').reduce((n,g)=>n+BigInt(g.quantity),0n),2n);
    const unknown=stock(s,'666').find(g=>g.tier===1)!,n=BigInt(unknown.quantity);command(s,{type:'work.crit',id:unknown.id,quantity:'2',worn:'1',crit:'44'},'666');
    let known=stock(s,'666').find(g=>g.tier===1&&g.crit==='44')!;assert.equal(s.summary('666').equipment.find(e=>e.id===known.id)!.quantity,'1');
    command(s,{type:'work.crit',id:unknown.id,quantity:(n-2n).toString(),worn:'0',crit:'44'},'666');known=stock(s,'666').find(g=>g.tier===1&&g.crit==='44')!;
    assert.equal(known.quantity,n.toString());assert.equal(stock(s,'666').filter(g=>g.tier===1).length,1);assert.equal(s.summary('666').spent,'72');s.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('schema-3 migration failure rolls back schema, all owners, history and receipt bytes',()=>{
  for(const injected of [false,true]){const dir=mkdtempSync(join(tmpdir(),'chm-migrate-fault-')),path=join(dir,'db');try{seedV3(path);let db=new Database(path);
    if(!injected){const row=db.prepare('SELECT seq,body FROM history WHERE owner=?').get('666') as {seq:number;body:string};const u=JSON.parse(row.body);u.price='1';db.prepare('UPDATE history SET body=? WHERE seq=?').run(JSON.stringify(u),row.seq);}
    const snapshot=(db:Database.Database)=>({version:db.pragma('user_version',{simple:true}),schema:db.prepare('SELECT name,sql FROM sqlite_master ORDER BY name').all(),tables:Object.fromEntries((db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {name:string}[]).map(({name})=>[name,db.prepare('SELECT * FROM '+name).safeIntegers().all()]))});const before=snapshot(db);db.close();assert.throws(()=>new Store(path,phase=>{if(injected&&phase==='migration')throw new Error('fault');}));db=new Database(path);assert.equal(db.pragma('user_version',{simple:true}),3);assert.deepEqual(snapshot(db),before);db.close();
  }finally{rmSync(dir,{recursive:true,force:true});}}
});
test('single → homogeneous batch → single undo survives restart and preserves later replenishment exactly once',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-mixed-')),path=join(dir,'db');let s=new Store(path);try{const id=add(s,'27');command(s,{type:'craft',items:[choice(id)]});
    command(s,{type:'fuse',fuse:{kind:'🅾',targetTier:3,count:'1',items:[choice(id,'24')]}});
    const second=s.inventory('111','work').find(g=>g.tier===3)!;add(s,'2','🅾',3,'23');command(s,{type:'craft',items:[choice(second.id)]});
    const state=s.summary('111'),raw={key:'later-input-add-key-001',revision:state.revision,experiment:state.experiment,action:{type:'original.put',kind:'🅾',tier:1,value:'10',quantity:'2'}};
    const result=s.command('111',raw);assert.deepEqual(s.command('111',raw),result);s.close();s=new Store(path);
    for(let i=0;i<3;i++)command(s,{type:'undo'});
    assert.equal(stock(s).find(g=>g.tier===1)!.quantity,'29');assert.equal(stock(s).find(g=>g.tier===3)!.quantity,'2');assert.equal(s.summary('111').spent,'0');assert.equal(s.summary('111').lastCraft,null);
  }finally{s.close();rmSync(dir,{recursive:true,force:true});}
});
test('huge batch commit and undo use bounded SQLite rows and retain exact counts',()=>{
  const s=new Store(':memory:'),n=10n**24n,id=add(s,(9n*n).toString()),before=s.summary('111');fuse(s,id,(9n*n).toString(),3,n.toString());
  assert.equal(s.summary('111').spent,(504n*n).toString());assert.equal(stock(s)[0]!.quantity,n.toString());
  assert.equal((s.db.prepare('SELECT count(*) AS n FROM history').get() as {n:number}).n,1);
  assert.equal((s.db.prepare('SELECT count(*) AS n FROM work_lots').get() as {n:number}).n,1);
  command(s,{type:'undo'});assert.equal(stock(s)[0]!.quantity,(9n*n).toString());assert.equal(s.summary('111').spent,before.spent);s.close();
});
test('refinement/addition exact retry, expired receipts and reset keep permanent key protections',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-retry-')),path=join(dir,'db');try{seedV3(path);const s=new Store(path),unknown=stock(s,'666').find(g=>g.tier===1)!,state=s.summary('666');
    const raw={key:'crit-refine-retry-0001',revision:state.revision,experiment:state.experiment,action:{type:'work.crit',id:unknown.id,quantity:'2',worn:'0',crit:'0'}};
    const result=s.command('666',raw);assert.deepEqual(s.command('666',raw),result);assert.equal(stock(s,'666').find(g=>g.crit==='0')!.quantity,'2');
    command(s,{type:'reset'},'666');assert.deepEqual(s.command('666',raw),result);
    s.db.prepare('UPDATE commands SET created=1 WHERE owner=? AND key=?').run('666',raw.key);s.maintain();
    assert.throws(()=>s.command('666',raw),/COMMAND_EXPIRED/);assert.throws(()=>s.command('666',{...raw,action:{type:'undo'}}),/KEY_REUSED/);s.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
