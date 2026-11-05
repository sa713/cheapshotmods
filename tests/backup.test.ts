import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync,writeFileSync,readFileSync,existsSync,symlinkSync,chmodSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../apps/server/src/store.js';
import {backupToFile} from '../apps/server/src/backup-file.js';
import {add,choice,command} from './helpers.js';

test('Online Backup is private from creation under umask 022 and refuses existing paths',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-private-backup-')),s=new Store(join(dir,'source.sqlite')),target=join(dir,'copy.sqlite'),previous=process.umask(0o022);
  try {
    const id=add(s);command(s,{type:'craft',items:[choice(id)]});const before=s.summary('111');let modeAtOpen=-1;
    await backupToFile({async backup(path){modeAtOpen=statSync(path).mode&0o777;return s.db.backup(path);}},target);
    assert.equal(modeAtOpen,0o600);assert.equal(statSync(target).mode&0o777,0o600);
    const restored=new Store(target);try {assert.deepEqual(restored.summary('111'),before);assert.equal(command(restored,{type:'undo'}).spent,'0');}finally{restored.close();}
    const existing=join(dir,'existing');writeFileSync(existing,'must-stay');
    await assert.rejects(()=>backupToFile(s.db,existing),{code:'EEXIST'});assert.equal(readFileSync(existing,'utf8'),'must-stay');
    const link=join(dir,'link');symlinkSync(existing,link);await assert.rejects(()=>backupToFile(s.db,link),{code:'EEXIST'});assert.equal(readFileSync(existing,'utf8'),'must-stay');
    const failed=join(dir,'failed');await assert.rejects(()=>backupToFile({async backup(){throw new Error('fixture failure');}},failed),/fixture failure/);assert.equal(existsSync(failed),false);
  }finally{process.umask(previous);s.close();rmSync(dir,{recursive:true,force:true});}
});

test('backup rejects trimmed path aliases without overwriting existing data or creating a misleading file',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'chm-backup-path-')),sourcePath=join(dir,'source.sqlite'),source=new Store(sourcePath),target=join(dir,'existing.sqlite');
  try {
    source.player('111');const existing=new Store(target);existing.player('222');existing.close();chmodSync(target,0o644);
    const before=readFileSync(target);
    for(const suffix of [' ','\t','\n','\u00a0']) {
      await assert.rejects(()=>backupToFile(source.db,target+suffix),/surrounding whitespace/);
      assert.equal(existsSync(target+suffix),false);assert.deepEqual(readFileSync(target),before);assert.equal(statSync(target).mode&0o777,0o644);
    }
    const cli=fileURLToPath(new URL('../apps/server/dist/backup.js',import.meta.url));
    const result=spawnSync(process.execPath,[cli,sourcePath,' existing.sqlite'],{cwd:dir,encoding:'utf8',timeout:10000});
    assert.equal(result.status,1);assert.match(result.stderr,/surrounding whitespace/);assert.equal(existsSync(join(dir,' existing.sqlite')),false);assert.deepEqual(readFileSync(target),before);
    const valid=join(dir,'copy with spaces.sqlite');await backupToFile(source.db,valid);assert.equal(statSync(valid).mode&0o777,0o600);
    const restored=new Store(valid);try {assert.deepEqual(restored.db.prepare('SELECT owner FROM players').all(),[{owner:'111'}]);}finally{restored.close();}
  }finally{source.close();rmSync(dir,{recursive:true,force:true});}
});
