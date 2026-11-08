"""Isolated immutable predecessor -> TASK008 kit -> image+volume rollback."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

bundle, work, old = map(Path, sys.argv[1:4])
root = work/'install'
m = json.loads((bundle/'manifest.json').read_text())
old_sha = json.loads((old/'manifest.json').read_text())['source_sha']
assert old_sha in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a','feb6a1bf82e70474c482c6a2e1fb0e77c4e20586','d6cb0e9404f07b5573b64131281d29569a010442','f944acb6435a9671cef6db5fc500b79a71d21133'}

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
api=Path('/fixtures/api.mjs').read_text().replace('__OWNER__','888' if old_sha in {'d6cb0e9404f07b5573b64131281d29569a010442','f944acb6435a9671cef6db5fc500b79a71d21133'} else '777')
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

if old_sha=='feb6a1bf82e70474c482c6a2e1fb0e77c4e20586':
    run('docker','cp',str(work/'schema4.json'),container+':/tmp/schema4.json')
if old_sha in {'d6cb0e9404f07b5573b64131281d29569a010442','f944acb6435a9671cef6db5fc500b79a71d21133'}:
    run('docker','cp',str(work/'schema5.json'),container+':/tmp/schema5.json')
previous=json.loads(phase('seed'))
old_assets=assets()
assert old_assets['sites'] == (old_sha in {'6dc8021e58daa9aa16a93a9265315bb810fe9d0a','feb6a1bf82e70474c482c6a2e1fb0e77c4e20586','d6cb0e9404f07b5573b64131281d29569a010442','f944acb6435a9671cef6db5fc500b79a71d21133'})
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
run('docker','exec',container,'node','apps/server/dist/backup.js','/data/cheapshot.sqlite','/tmp/schema6-probe.sqlite')
run('docker','cp',container+':/tmp/schema6-probe.sqlite',str(work/'schema6-probe.sqlite'))
probe="const fs=require('fs');fs.copyFileSync('/restore.sqlite','/tmp/migrated.sqlite');import('./apps/server/dist/store.js').then(({Store})=>{try{new Store('/tmp/migrated.sqlite');process.exit(2);}catch(e){if(e.message!=='UNKNOWN_DATABASE_VERSION')throw e;console.log('old binary rejects schema6 copy');}}).catch(()=>process.exit(3));"
compatibility='rejected_copy6'
run('docker','run','--rm','--user','0','--mount','type=bind,source='+str(work/'schema6-probe.sqlite')+',target=/restore.sqlite,readonly',old_metadata['CHM_APP_IMAGE'],'node','-e',probe)
results=json.loads(phase('migrated',previous))
chm(root/'chm.sh','restart',root)
assert json.loads(phase('restarted'))['schema']==6
chm(root/'chm.sh','rollback',root)
assert metadata()==old_metadata
assert assets()==old_assets
rollback=phase('rollback',previous)
chm(root/'chm.sh','restart',root)
assert phase('rollback',previous)==rollback
assert hashlib.sha256(operator.read_bytes()).hexdigest()==operator_hash
# A second genuine update preserves the predecessor rollback evidence above,
# then separately exercises backup/restore and rollback of the schema6 pair.
chm(bundle/'chm.sh','update',root,bundle)
phase('migrated',previous)
checkpoint=json.loads(phase('snapshot'))
backup_output=chm(root/'chm.sh','backup',root).decode().strip()
backup_path=Path(backup_output.splitlines()[-1])
assert backup_path.is_file() and backup_path.parent==root/'backups'
phase('change-after-backup')
changed_checkpoint=json.loads(phase('snapshot'))
before_restore=metadata()
chm(root/'chm.sh','restore',root,backup_path)
chm(root/'chm.sh','restart',root)
phase('check-checkpoint',checkpoint)
phase('baseline-after-restore',checkpoint)
chm(root/'chm.sh','rollback',root)
assert metadata()==before_restore
phase('check-checkpoint',changed_checkpoint)
assert json.loads(phase('restarted'))['schema']==6
assert hashlib.sha256(operator.read_bytes()).hexdigest()==operator_hash
assert hashlib.sha256((root/'config.env').read_bytes()).hexdigest()==config_hash
proof={'predecessor_sha':old_sha,'incoming_sha':m['source_sha'],'platform':'Debian13-slim/linux-amd64; Docker'+run('docker','version','--format','{{.Server.Version}}').decode().strip()+' '+run('docker','info','--format','{{.Driver}}').decode().strip()+'; Node'+m['node']+'/better-sqlite3','old_assets':old_assets,'new_assets':new_assets,'asset_rollback_exact':True,'old_schema':previous['schema'],'new_schema':6,'separate_new_volume':True,'old_image_schema_compatibility_probe':compatibility,'config_and_separate_operator_unchanged':True,'new_image_restart_backup_restore':'passed','baseline_backup_restore_restart':'passed',**results,'rollback_old_image_and_volume_exact_state':'passed','restart_after_rollback':'passed','test_data':'isolated synthetic signed Mini App; no owner/live Telegram'}
(work/'proof.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps(proof,indent=2))
