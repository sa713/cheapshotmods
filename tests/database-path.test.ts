import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readdirSync,existsSync,readFileSync,renameSync,mkdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync,spawn} from 'node:child_process';
import {createServer} from 'node:net';
import Database from 'better-sqlite3';
import {Store} from '../apps/server/src/store.js';

const storeModule=new URL('../apps/server/dist/store.js',import.meta.url).href;
const main=fileURLToPath(new URL('../apps/server/dist/main.js',import.meta.url));
const backup=fileURLToPath(new URL('../apps/server/dist/backup.js',import.meta.url));
const edges=[' ','\t','\u00a0'];
const invalidPaths=['',' \t\u00a0',...edges.flatMap(edge=>[edge+'nested/db.sqlite','nested/db.sqlite'+edge])];
const hash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex');
function rejected(result:ReturnType<typeof spawnSync>) {
  assert.equal(result.error,undefined);
  assert.equal(result.status,1,String(result.stderr));
  assert.match(String(result.stderr),/Database path/);
}
function fixture(path:string,owner:string) {const s=new Store(path);try{s.player(owner);}finally{s.close();}}

test('Store rejects empty and whitespace aliases before mkdir or SQLite, preserving memory and internal spaces',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-store-path-'));
  try {
    for(const path of invalidPaths) {
      const result=spawnSync(process.execPath,['--input-type=module','-e',`import {Store} from ${JSON.stringify(storeModule)};const s=new Store(process.argv[1]);s.close();`,'--',path],{cwd:dir,encoding:'utf8',timeout:5000});
      rejected(result);assert.deepEqual(readdirSync(dir),[]);
    }
    const memory=new Store(':memory:');try{assert.equal((memory.db.pragma('database_list') as {file:string}[])[0]!.file,'');}finally{memory.close();}
    assert.deepEqual(readdirSync(dir),[]);
    const path=join(dir,'internal space','database file.sqlite');fixture(path,'111');
    const db=new Database(path,{readonly:true,fileMustExist:true});try{assert.deepEqual(db.prepare('SELECT owner FROM players').all(),[{owner:'111'}]);}finally{db.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('main rejects invalid DATABASE_PATH before creating any directory or SQLite file',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-main-path-'));
  const env:NodeJS.ProcessEnv={...process.env,PORT:'0',PUBLIC_BASE_URL:'http://localhost:3000',NODE_ENV:'production'};
  delete env.TELEGRAM_BOT_TOKEN;delete env.TELEGRAM_OIDC_CLIENT_ID;delete env.TELEGRAM_OIDC_CLIENT_SECRET;
  try {
    for(const path of invalidPaths) {
      rejected(spawnSync(process.execPath,[main],{cwd:dir,env:{...env,DATABASE_PATH:path},encoding:'utf8',timeout:5000}));
      assert.deepEqual(readdirSync(dir),[]);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('main opens an ordinary DATABASE_PATH with internal spaces and serves HTTP',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-main-valid-')),path=join(dir,'internal space','database file.sqlite');
  const reservation=createServer();await new Promise<void>((resolve,reject)=>{reservation.once('error',reject);reservation.listen(0,'127.0.0.1',resolve);});
  const address=reservation.address();assert.ok(address&&typeof address==='object');const port=address.port;
  await new Promise<void>((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
  const base=`http://127.0.0.1:${port}`,env:NodeJS.ProcessEnv={...process.env,DATABASE_PATH:path,PORT:String(port),PUBLIC_BASE_URL:base,NODE_ENV:'production'};
  delete env.TELEGRAM_BOT_TOKEN;delete env.TELEGRAM_OIDC_CLIENT_ID;delete env.TELEGRAM_OIDC_CLIENT_SECRET;
  const child=spawn(process.execPath,[main],{cwd:process.cwd(),env,stdio:'ignore'});
  const exited=new Promise<void>((resolve,reject)=>{child.once('error',reject);child.once('exit',()=>resolve());});
  try {
    let ready=false;
    for(let i=0;i<100;i++) {
      assert.equal(child.exitCode,null,'main exited before becoming ready');
      try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(500)});if(r.ok){ready=true;break;}}catch{/* wait for startup */}
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    assert.ok(ready,'main startup timed out');assert.ok(existsSync(path));
    assert.equal((await fetch(base+'/api/state')).status,401);
  }finally{child.kill('SIGTERM');await exited;rmSync(dir,{recursive:true,force:true});}
});

test('backup CLI rejects SOURCE aliases when both names exist or only the literal name exists',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-source-alias-'));
  try {
    for(const edge of edges) for(const leading of [false,true]) for(const both of [false,true]) {
      const caseDir=join(dir,String(readdirSync(dir).length));mkdirSync(caseDir);
      const trimmed=join(caseDir,'source.sqlite'),literalName=leading?edge+'source.sqlite':'source.sqlite'+edge,literal=join(caseDir,literalName),target=join(caseDir,'copy.sqlite');
      if(both)fixture(trimmed,'111');
      const stage=join(caseDir,'stage.sqlite');fixture(stage,'222');renameSync(stage,literal);
      const literalHash=hash(literal),trimmedHash=both?hash(trimmed):undefined,names=readdirSync(caseDir).sort();
      rejected(spawnSync(process.execPath,[backup,literalName,target],{cwd:caseDir,encoding:'utf8',timeout:5000}));
      assert.equal(hash(literal),literalHash);if(both)assert.equal(hash(trimmed),trimmedHash);else assert.equal(existsSync(trimmed),false);
      assert.equal(existsSync(target),false);assert.deepEqual(readdirSync(caseDir).sort(),names);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('backup CLI validates both file paths before opening or migrating SOURCE',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-backup-validation-')),source=join(dir,'source.sqlite');
  // Opening this database through Store would enable WAL and migrate it. A bad
  // target must be rejected before either change, including when SOURCE exists.
  const db=new Database(source);db.exec("CREATE TABLE sentinel(value TEXT); INSERT INTO sentinel VALUES ('unchanged')");db.close();
  try {
    const before=hash(source),names=readdirSync(dir).sort();
    const badTargets=['',' \t\u00a0',':memory:',...edges.flatMap(edge=>[edge+'nested/copy.sqlite','nested/copy.sqlite'+edge])];
    for(const target of badTargets) {
      rejected(spawnSync(process.execPath,[backup,source,target],{cwd:dir,encoding:'utf8',timeout:5000}));
      assert.equal(hash(source),before);assert.deepEqual(readdirSync(dir).sort(),names);
    }
    for(const invalid of ['',' \t\u00a0',':memory:']) {
      rejected(spawnSync(process.execPath,[backup,invalid,'copy.sqlite'],{cwd:dir,encoding:'utf8',timeout:5000}));
      assert.equal(hash(source),before);assert.deepEqual(readdirSync(dir).sort(),names);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('backup CLI accepts internal spaces and retains a private exact copy',()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-backup-valid-')),source=join(dir,'source file.sqlite'),target=join(dir,'copy file.sqlite');
  try {
    fixture(source,'333');
    const result=spawnSync(process.execPath,[backup,source,target],{cwd:dir,encoding:'utf8',timeout:5000});
    assert.equal(result.status,0,result.stderr);assert.equal(statSync(target).mode&0o777,0o600);
    const db=new Database(target,{readonly:true,fileMustExist:true});try{assert.deepEqual(db.prepare('SELECT owner FROM players').all(),[{owner:'333'}]);}finally{db.close();}
  }finally{rmSync(dir,{recursive:true,force:true});}
});
