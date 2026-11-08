import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {Store} from '../apps/server/src/store.js';
import {command} from './helpers.js';
function seed(path:string){const f=JSON.parse(readFileSync(new URL('./fixtures/v4-raw-history.json',import.meta.url),'utf8'));const db=new Database(path);db.pragma('foreign_keys=OFF');db.exec(f.ddl.join(';'));for(const [name,rows] of Object.entries(f.tables) as [string,Record<string,unknown>[]][]){for(const row of rows){const cols=Object.keys(row);db.prepare(`INSERT INTO ${name} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...cols.map(c=>row[c] as never));}}assert.deepEqual(db.pragma('foreign_key_check'),[]);db.pragma('user_version=4');db.close();return f;}
const rows=(db:Database.Database)=>Object.fromEntries((db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {name:string}[]).map(({name})=>[name,db.prepare('SELECT * FROM '+name).all()]));
test('canonical TASK-005 schema4 rows, ledgers, receipt payloads and hashes migrate byte-for-byte and once',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-raw-migrate-')),path=join(dir,'db');let s:Store|undefined;try{const f=seed(path);s=new Store(path);assert.equal(s.db.pragma('user_version',{simple:true}),5);assert.deepEqual(rows(s.db),f.tables);assert.deepEqual(s.summary('777'),f.state);assert.deepEqual(s.command('777',f.receipt.payload),f.receipt.result);assert.deepEqual(rows(s.db),f.tables);
    s.close();s=new Store(path);assert.deepEqual(rows(s.db),f.tables);
    // Refined/merged outputs and later source increments survive both historical undo.
    command(s,{type:'undo'},'777');command(s,{type:'undo'},'777');const work=s.inventory('777','work');assert.equal(work.find(g=>g.tier===1)!.quantity,'29');assert.equal(work.find(g=>g.tier===3)!.quantity,'2');assert.equal(s.summary('777').spent,'0');assert.equal(s.summary('777').equipment[0]!.quantity,'2');
    assert.equal(s.summary('666').stats.crit,null);command(s,{type:'reset'},'777');assert.equal(s.summary('777').lastCraft,null);assert.equal(s.inventory('777','work').find(g=>g.tier===1)!.quantity,'29');
  }finally{s?.close();rmSync(dir,{recursive:true,force:true});}
});
test('schema4 marker fault rolls back every table and old schema marker',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-raw-migrate-fault-')),path=join(dir,'db');try{const f=seed(path);assert.throws(()=>new Store(path,p=>{if(p==='raw-migration')throw Error('fault');}),/fault/);const db=new Database(path);assert.equal(db.pragma('user_version',{simple:true}),4);assert.deepEqual(rows(db),f.tables);db.close();const s=new Store(path);assert.equal(s.db.pragma('user_version',{simple:true}),5);s.close();}finally{rmSync(dir,{recursive:true,force:true});}
});
