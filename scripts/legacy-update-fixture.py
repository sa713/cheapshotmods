"""Actual format-1 installer -> incoming format-2 update -> old pair rollback.

The predecessor image/version is explicitly synthetic; the old installer is an
exact Git blob from cf0. No accepted archive or expected old IDs are edited.
"""
import gzip
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import uuid

bundle, work = map(Path, sys.argv[1:3])
root = work/'install'
m = json.loads((bundle/'manifest.json').read_text())
old_sha = uuid.uuid4().hex+uuid.uuid4().hex[:8]
old_image = 'cheapshotmods:'+old_sha
(work/'legacy-image').write_text(old_image)


def run(*args, **kwargs):
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if r.returncode:
        sys.stderr.buffer.write(r.stdout+r.stderr)
        raise AssertionError('legacy fixture command failed: '+args[0])
    return r.stdout


def chm(script, *args):
    return run('bash', str(script), *map(str, args))


run('docker', 'build', '-q', '-t', old_image, '-', input=f'FROM {m["app_image"]}\nENV BUILD_SHA={old_sha}\nLABEL org.opencontainers.image.revision={old_sha}\n'.encode())
old = work/'legacy-bundle'
old.mkdir()
names = ['chm.sh', 'compose.yml', 'compose.external.yml', 'ingress.py', 'Caddyfile', 'Caddyfile.internal', 'env.example', 'env.external.example', 'README.md', 'EXTERNAL-PROXY.md']
for name in names:
    shutil.copyfile(work/'legacy-chm.sh' if name == 'chm.sh' else bundle/name, old/name)
app = json.loads(run('docker', 'image', 'inspect', old_image))[0]
proxy = json.loads(run('docker', 'image', 'inspect', m['proxy_image']))[0]
legacy = {**m, 'format': 1, 'source_sha': old_sha, 'app_image': old_image, 'app_image_id': app['Id'], 'proxy_image_id': proxy['Id'], 'test_fixture': 'synthetic predecessor, exact cf0 installer'}
legacy.pop('image_proofs')
legacy.pop('builder_observations')
(old/'manifest.json').write_text(json.dumps(legacy))
(old/'images.tar.gz').write_bytes(gzip.compress(run('docker', 'image', 'save', old_image, m['proxy_image']), compresslevel=1))
names += ['manifest.json', 'images.tar.gz']
(old/'SHA256SUMS').write_text(''.join(hashlib.sha256((old/name).read_bytes()).hexdigest()+'  '+name+'\n' for name in names))
config = work/'config.env'
config.write_text('CHM_PROXY_MODE=external\nPUBLIC_BASE_URL=https://94.228.170.13:9443\nSESSION_SECRET=private-synthetic-legacy-fixture-secret\nTELEGRAM_BOT_TOKEN=legacy-fixture-bot-token\n')
config.chmod(0o600)
chm(old/'chm.sh', 'install', root, config)
project = 'chm-'+hashlib.sha256(str(root).encode()).hexdigest()[:12]
container = project+'-app-1'
node = '''
const crypto=require('node:crypto'); const origin='https://94.228.170.13:9443';
const fields={auth_date:String(Math.floor(Date.now()/1000)),user:JSON.stringify({id:444,first_name:'Legacy fixture'})};
const secret=crypto.createHmac('sha256','WebAppData').update('legacy-fixture-bot-token').digest();
fields.hash=crypto.createHmac('sha256',secret).update(Object.keys(fields).sort().map(k=>k+'='+fields[k]).join(String.fromCharCode(10))).digest('hex');
(async()=>{let r=await fetch('http://localhost:3000/auth/mini',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({initData:new URLSearchParams(fields).toString()})});if(r.status!==200)throw Error('auth');
const cookie=r.headers.get('set-cookie').split(';')[0],csrf=(await r.json()).csrf;const headers={origin,cookie,'x-csrf-token':csrf,'content-type':'application/json'};
r=await fetch('http://localhost:3000/api/state',{headers});const s=await r.json();
if(process.argv[1]==='read'){process.stdout.write(s.level);return;}
r=await fetch('http://localhost:3000/api/commands',{method:'POST',headers,body:JSON.stringify({key:crypto.randomUUID(),revision:s.revision,experiment:s.experiment,action:{type:'level',value:process.argv[1]}})});if(r.status!==200)throw Error('write');
})().catch(()=>process.exit(1));
'''


def level(value):
    return run('docker', 'exec', container, 'node', '-e', node, value).decode()


level('300')
chm(bundle/'chm.sh', 'update', root, bundle)
assert level('read') == '300'
assert dict(line.split('=', 1) for line in (root/'current.env').read_text().splitlines())['CHM_VERSION'] == m['source_sha']
level('400')
chm(root/'chm.sh', 'rollback', root)
assert level('read') == '300'
assert dict(line.split('=', 1) for line in (root/'current.env').read_text().splitlines())['CHM_VERSION'] == old_sha
assert (root/'chm.sh').read_bytes() == (work/'legacy-chm.sh').read_bytes()
chm(root/'chm.sh', 'restart', root)
assert level('read') == '300'
print('Legacy compatibility passed: exact cf0 format-1 installer with synthetic predecessor -> incoming format-2 update -> retained old image+volume rollback/restart, level300 preserved.')
