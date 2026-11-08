"""Isolated exact installed fbe kit -> canonical TASK005 kit -> image+volume rollback."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

bundle, work, old = map(Path, sys.argv[1:4])
root = work/'install'
m = json.loads((bundle/'manifest.json').read_text())
old_sha = json.loads((old/'manifest.json').read_text())['source_sha']
assert old_sha in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a'}

def run(*args, **kwargs):
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if r.returncode:
        sys.stderr.buffer.write(r.stdout+r.stderr)
        raise AssertionError('migration fixture command failed: '+args[0])
    return r.stdout

def chm(script, *args):
    return run('bash', str(script), *map(str,args))

def metadata():
    return dict(line.split('=',1) for line in (root/'current.env').read_text().splitlines())

config = work/'config.env'
config.write_text('CHM_PROXY_MODE=external\nPUBLIC_BASE_URL=https://fixture.invalid\nSESSION_SECRET=private-synthetic-legacy-fixture-secret\nTELEGRAM_BOT_TOKEN=legacy-fixture-bot-token\n')
config.chmod(0o600)
chm(old/'chm.sh','install',root,config)
project='chm-'+hashlib.sha256(str(root).encode()).hexdigest()[:12]
container=project+'-app-1'
api=Path('/fixtures/api.mjs').read_text()
def phase(mode, previous=None):
    args=['docker','exec',container,'node','--input-type=module','-e',api,mode]
    if previous is not None:args.append(json.dumps(previous))
    return run(*args).decode()

def assets():
    script = r"""
const crypto=require('crypto');
(async()=>{
 const html=await (await fetch('http://localhost:3000/')).text();
 const css=html.match(/href="(\/assets\/[^"]+\.css)"/)[1],js=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
 const sheet=await(await fetch('http://localhost:3000'+css)).text();
 const code=await(await fetch('http://localhost:3000'+js)).text();
 process.stdout.write(JSON.stringify({css_sha256:crypto.createHash('sha256').update(sheet).digest('hex'),js_sha256:crypto.createHash('sha256').update(code).digest('hex'),sites:sheet.includes('--bg:#111312')&&sheet.includes('--lime:#c5f469')&&code.includes('Мастерская')}));
})().catch(e=>{console.error('Asset probe failed:',e.message);process.exit(1);});
"""
    return json.loads(run('docker','exec',container,'node','-e',script))

previous=json.loads(phase('seed'))
old_assets=assets()
assert old_assets['sites'] == (old_sha=='6dc8021e58daa9aa16a93a9265315bb810fe9d0a')
old_metadata=metadata()
# The already-installed separately versioned operator must survive app updates.
operator=root/'ingress-b008807.py'
operator.write_bytes((bundle/'ingress.py').read_bytes());operator.chmod(0o600)
operator_hash=hashlib.sha256(operator.read_bytes()).hexdigest()
config_hash=hashlib.sha256((root/'config.env').read_bytes()).hexdigest()
chm(bundle/'chm.sh','update',root,bundle)
new_metadata=metadata()
new_assets=assets()
assert new_assets['sites'] and new_assets['css_sha256']!=old_assets['css_sha256'] and new_assets['js_sha256']!=old_assets['js_sha256']
assert new_metadata['CHM_VERSION']==m['source_sha']
assert new_metadata['CHM_DATA_VOLUME']!=old_metadata['CHM_DATA_VOLUME']
assert hashlib.sha256((root/'config.env').read_bytes()).hexdigest()==config_hash
assert hashlib.sha256(operator.read_bytes()).hexdigest()==operator_hash
# Old image rejects a migrated COPY; it never touches the active data mount.
run('docker','exec',container,'node','apps/server/dist/backup.js','/data/cheapshot.sqlite','/tmp/schema4-probe.sqlite')
run('docker','cp',container+':/tmp/schema4-probe.sqlite',str(work/'schema4-probe.sqlite'))
probe='''const fs=require('fs');fs.copyFileSync('/restore.sqlite','/tmp/migrated.sqlite');import('./apps/server/dist/store.js').then(({Store})=>{try{new Store('/tmp/migrated.sqlite');process.exit(2);}catch(e){if(e.message!=='UNKNOWN_DATABASE_VERSION')throw e;console.log('old binary rejects schema4 copy');}}).catch(()=>process.exit(3));'''
run('docker','run','--rm','--user','0','--mount','type=bind,source='+str(work/'schema4-probe.sqlite')+',target=/restore.sqlite,readonly',old_metadata['CHM_APP_IMAGE'],'node','-e',probe)
results=json.loads(phase('migrated',previous))
chm(root/'chm.sh','restart',root)
assert json.loads(phase('restarted'))['schema']==4
chm(root/'chm.sh','rollback',root)
assert metadata()==old_metadata
assert assets()==old_assets
rollback=phase('rollback',previous)
chm(root/'chm.sh','restart',root)
assert phase('rollback',previous)==rollback
assert hashlib.sha256(operator.read_bytes()).hexdigest()==operator_hash
# A second genuine update preserves the predecessor rollback evidence above,
# then separately exercises backup/restore and rollback of the schema4 pair.
chm(bundle/'chm.sh','update',root,bundle)
phase('migrated',previous)
checkpoint=json.loads(phase('snapshot'))
backup_output=chm(root/'chm.sh','backup',root).decode().strip()
backup_path=Path(backup_output.splitlines()[-1])
assert backup_path.is_file() and backup_path.parent==root/'backups'
phase('change-after-backup')
before_restore=metadata()
chm(root/'chm.sh','restore',root,backup_path)
phase('check-checkpoint',checkpoint)
chm(root/'chm.sh','rollback',root)
assert metadata()==before_restore
assert hashlib.sha256(operator.read_bytes()).hexdigest()==operator_hash
assert hashlib.sha256((root/'config.env').read_bytes()).hexdigest()==config_hash
proof={'predecessor_sha':old_sha,'incoming_sha':m['source_sha'],'platform':'Debian13-slim/linux-amd64; cloud Docker29.9.2 vfs; real pinned Node/better-sqlite3','old_assets':old_assets,'new_assets':new_assets,'asset_rollback_exact':True,'old_schema':previous['schema'],'new_schema':4,'separate_new_volume':True,'old_image_schema_compatibility_probe':'rejected_copy4','config_and_separate_operator_unchanged':True,'new_image_restart_backup_restore':'passed',**results,'rollback_old_image_and_volume_exact_state':'passed','restart_after_rollback':'passed','test_data':'isolated synthetic signed Mini App; no owner/live Telegram'}
(work/'proof.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof,indent=2))
