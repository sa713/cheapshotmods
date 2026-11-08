// Run from the current repository after compiling a disposable canonical source tree:
// node scripts/task007-upgrade/generate-schema5.mjs OLD_APP_ROOT NEW_SQLITE OUTPUT_JSON
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import Database from 'better-sqlite3';
const source='d6cb0e9404f07b5573b64131281d29569a010442';
const [root,path,out]=process.argv.slice(2);assert.ok(root&&path&&out);assert.ok(!existsSync(path),'Use a new database');
for(const file of execFileSync('git',['ls-tree','-r','--name-only',source,'--','apps/server/src','packages/rules/src'],{encoding:'utf8'}).trim().split('\n'))assert.deepEqual(readFileSync(join(root,file)),execFileSync('git',['show',source+':'+file]));
const {Store}=await import(pathToFileURL(resolve(root,'apps/server/dist/store.js')).href);
const f=JSON.parse(readFileSync('tests/fixtures/v4-raw-history.json','utf8')),db=new Database(path);db.pragma('foreign_keys=OFF');db.exec(f.ddl.join(';'));
for(const [name,rows] of Object.entries(f.tables))for(const row of rows){const cols=Object.keys(row);db.prepare(`INSERT INTO ${name} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...cols.map(c=>row[c]));}
db.pragma('user_version=4');db.close();const s=new Store(path);assert.equal(s.db.pragma('user_version',{simple:true}),5);
const cmd=(action,owner='888')=>{const p=s.summary(owner),payload={key:randomUUID(),revision:p.revision,experiment:p.experiment,action};return {payload,result:s.command(owner,payload)};};
const raw={kind:'raw-purple',tier:0,value:'5',crit:'13'},normal={kind:'🧿',tier:1,value:'8',crit:'20'};
const level=cmd({type:'level',value:'200'}),id=cmd({type:'original.put',...raw,quantity:'27'}).result.createdId,ready=cmd({type:'original.put',...normal,quantity:'2'}).result.createdId;
cmd({type:'equip',items:[{id,quantity:'3'}]});cmd({type:'craft',items:[{id,quantity:'3',worn:'1'}]});
const mixed=cmd({type:'fuse',fuse:{kind:'🧿',targetTier:3,count:'1',items:[{id:ready,quantity:'3',worn:'0'},{id,quantity:'24',worn:'2'}]}});
assert.equal(mixed.result.lastCraft.type,'batch');assert.equal(mixed.result.lastCraft.consumed.length,2);
const output=s.inventory('888','work').find(g=>g.tier===3);cmd({type:'original.put',kind:'🧿',tier:3,value:output.value,crit:output.crit,quantity:'2'});
cmd({type:'original.put',id,...raw,quantity:'29'});cmd({type:'equip',items:[{id:output.id,quantity:'1'}]});
// Old unknown-crit mixed receipt must replay even though new operations reject it.
const oldUnknown=s.inventory('666','work').find(g=>g.tier===1&&g.crit==null),oldKnown=s.inventory('666','work').find(g=>g.tier===1&&g.crit==='44');
const unknownReceipt=cmd({type:'fuse',fuse:{kind:'🧿',targetTier:2,count:'1',items:[{id:oldUnknown.id,quantity:'1',worn:'0'},{id:oldKnown.id,quantity:'2',worn:'0'}]}},'666');assert.equal(unknownReceipt.result.lastCraft.output.crit,null);
// An expired permanent receipt is part of the real old schema5 state as well.
s.db.prepare('UPDATE commands SET created=1 WHERE owner=? AND key=?').run('888',level.payload.key);s.maintain();
const tables=Object.fromEntries(s.db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(({name})=>[name,s.db.prepare('SELECT * FROM '+name).all()]));
const ddl=s.db.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type='index',name").all().map(r=>r.sql);
writeFileSync(out,JSON.stringify({source,description:'Unchanged canonical TASK-006 Store: schema5 mixed raw/ordinary batch, single, worn lots, unknown/refined crit owners, late stock and merged output, exact mixed and expired receipts.',ddl,tables,owner:'888',receipt:mixed,unknownReceipt,expired:level.payload,state:s.summary('888'),rawId:id,readyId:ready},null,2)+'\n');s.close();
console.log(JSON.stringify({source,out,sha256:createHash('sha256').update(readFileSync(out)).digest('hex')}));
