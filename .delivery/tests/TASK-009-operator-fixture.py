"""Real Debian/HTTPS/private-download/update/rollback of the new owner helper."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time
import types

bundle, old, work, helper = map(Path, sys.argv[1:5])
root = work / 'install'
downloads = work / 'downloads'
downloads.mkdir(mode=0o700)
os.umask(0o077)
os.environ['CHM_DOWNLOAD_PARENT'] = str(downloads)
project = 'chm-' + hashlib.sha256(str(root).encode()).hexdigest()[:12]
app = project + '-app-1'
proxy = project + '-operator-proxy'


def run(*args, ok=True):
    result = subprocess.run([str(x) for x in args], capture_output=True, text=True)
    if ok and result.returncode:
        sys.stderr.write(result.stdout + result.stderr)
        raise AssertionError('operator fixture command failed: ' + str(args[0]))
    return result


def meta():
    return dict(line.split('=', 1) for line in (root / 'current.env').read_text().splitlines())


with socket.socket() as endpoint:
    endpoint.bind(('127.0.0.1', 0))
    port = endpoint.getsockname()[1]
origin = 'https://127.0.0.1:' + str(port)
config = work / 'config.env'
config.write_text('CHM_PROXY_MODE=external\nPUBLIC_BASE_URL=' + origin
                  + '\nSESSION_SECRET=private-synthetic-legacy-fixture-secret'
                  + '\nTELEGRAM_BOT_TOKEN=legacy-fixture-bot-token\n')
config.chmod(0o600)
run('bash', old / 'chm.sh', 'install', root, config)
api = Path('/fixtures/api.mjs').read_text().replace('__OWNER__', '888')
api = api.replace("const origin='https://fixture.invalid';", 'const origin=' + json.dumps(origin) + ';')
smoke = r"""
if(mode==='operator-green-smoke'){
 for(const [value,quantity] of [['6','10'],['7','6'],['8','8']])await command({type:'original.put',kind:'raw-green',tier:0,value,quantity});
 const saved=await snapshot();
 for(const [recipe,value] of [['green-667','10'],['green-788','12']]){
  const applied=await command({type:'fuse',fuse:{recipe,includeWorn:false,count:'1'}});
  assert.equal(applied.result.lastCraft.output.kind,'🅾');assert.equal(applied.result.lastCraft.output.tier,1);assert.equal(applied.result.lastCraft.output.value,value);assert.equal(applied.result.lastCraft.price,'28');
  const after=await snapshot();assert.deepEqual(after.original,saved.original);assert.deepEqual(after.baselineGroups,saved.baselineGroups);assert.equal(after.state.level,saved.state.level);
  await command({type:'undo'});assert.deepEqual((await snapshot()).work,saved.work);assert.equal((await state()).spent,saved.state.spent);
 }
 process.stdout.write(JSON.stringify({bothRecipes:'passed',undo:'passed',snapshotAndOriginal:'passed'}));return;
}
"""
api = api.replace('const mode=process.argv[1];', 'const mode=process.argv[1];' + smoke)


def phase(mode):
    return json.loads(run('docker', 'exec', app, 'node', '--input-type=module', '-e', api, mode).stdout)


def game_tables():
    script = r"""
const D=require('better-sqlite3'),crypto=require('crypto'),d=new D('/data/cheapshot.sqlite',{readonly:true,fileMustExist:true});
const result={};for(const table of ['players','groups','history','commands','work_lots','baselines','baseline_groups']){
 const rows=d.prepare('SELECT * FROM '+table).all().map(row=>JSON.stringify(row)).sort();
 result[table]={rows:rows.length,sha256:crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
}d.close();console.log(JSON.stringify(result));
"""
    return json.loads(run('docker', 'exec', app, 'node', '-e', script).stdout)


run('docker', 'cp', work / 'schema5.json', app + ':/tmp/schema5.json')
previous = phase('seed')
before = {key: previous[key] for key in ['state', 'original', 'work', 'baselineGroups']}
tables_before = game_tables()
operator = root / 'ingress-b008807.py'
operator.write_bytes((bundle / 'ingress.py').read_bytes())
operator.chmod(0o600)
preserved = {str(path): hashlib.sha256(path.read_bytes()).hexdigest()
             for path in [root / 'config.env', operator]}

# A real private fixture CA and IP SAN: no -k and no auth/TLS bypass.
certs = work / 'certs'
certs.mkdir()
run('openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj',
    '/CN=Cheapshot operator fixture CA', '-keyout', certs / 'ca.key', '-out', certs / 'ca.crt')
run('openssl', 'req', '-new', '-newkey', 'rsa:2048', '-nodes', '-subj', '/CN=127.0.0.1',
    '-keyout', certs / 'server.key', '-out', certs / 'server.csr')
(certs / 'extensions').write_text('subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n')
run('openssl', 'x509', '-req', '-in', certs / 'server.csr', '-CA', certs / 'ca.crt',
    '-CAkey', certs / 'ca.key', '-CAcreateserial', '-days', '1', '-extfile', certs / 'extensions',
    '-out', certs / 'server.crt')
Path('/usr/local/share/ca-certificates/operator-fixture.crt').write_bytes((certs / 'ca.crt').read_bytes())
run('update-ca-certificates')
caddy = work / 'Caddyfile'
caddy.write_text('{\n auto_https off\n admin off\n default_sni 127.0.0.1\n}\nhttps://127.0.0.1:443 {\n tls /certs/server.crt /certs/server.key\n reverse_proxy '
                 + meta()['CHM_APP_ALIAS'] + ':3000\n}\n')
run('docker', 'run', '--rm', '-d', '--name', proxy, '--network', meta()['CHM_EXTERNAL_NETWORK'],
    '--label', 'cheapshotmods.task=TASK-009-operator', '--publish', '127.0.0.1:' + str(port) + ':443',
    '--mount', 'type=bind,source=' + str(caddy) + ',target=/etc/caddy/Caddyfile,readonly',
    '--mount', 'type=bind,source=' + str(certs) + ',target=/certs,readonly',
    'caddy:2.11.4-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b')
for _ in range(30):
    if run('curl', '--fail', '--silent', '--show-error', '--max-time', '2', origin + '/health', ok=False).returncode == 0:
        break
    time.sleep(1)
run('bash', root / 'chm.sh', 'check', root)
proxy_before = json.loads(run('docker', 'inspect', proxy).stdout)[0]
credential = Path('/root/.config/cheapshotmods/github.curl')
credential.parent.mkdir(parents=True, mode=0o700)
# No owner PAT in fixtures: the managed Cloud connection authenticates this
# exact private-repo request at its normal proxy. Test file contains only Accept.
credential.write_text('header = "Accept: application/vnd.github+json"\n')
credential.chmod(0o600)
spec = importlib.util.spec_from_file_location('operator_helper', helper)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
old_container = run('docker', 'ps', '-q', '--filter', 'name=^/' + app + '$').stdout.strip()
original_metadata = (root / 'current.env').read_bytes()
try:
    changed = original_metadata.decode().replace(meta()['CHM_VERSION'], 'a' * 40)
    (root / 'current.env').write_text(changed)
    assert run('python3', '-I', helper, 'update', root, ok=False).returncode != 0
finally:
    (root / 'current.env').write_bytes(original_metadata)
credential.chmod(0o644)
try:
    assert run('python3', '-I', helper, 'update', root, ok=False).returncode != 0
finally:
    credential.chmod(0o600)
real_usage = module.shutil.disk_usage
module.shutil.disk_usage = lambda path: types.SimpleNamespace(free=0)
try:
    try:
        module.prepare(root, downloads)
        raise AssertionError('Low-space response accepted')
    except RuntimeError as error:
        assert 'Insufficient free space' in str(error)
finally:
    module.shutil.disk_usage = real_usage
assert not list(downloads.iterdir())
assert run('docker', 'ps', '-q', '--filter', 'name=^/' + app + '$').stdout.strip() == old_container
assert phase('snapshot') == before

run('python3', '-I', helper, 'update', root)
assert meta()['CHM_VERSION'] == module.SOURCE
assert phase('snapshot') == before
assert game_tables() == tables_before
receipts = list(downloads.glob('*/receipt.json'))
assert len(receipts) == 1
receipt = json.loads(receipts[0].read_text())
assert receipt['database_check']['integrity'] == 'ok' and receipt['database_check']['schema'] == 6
assert receipt['config_and_separate_helper_unchanged'] and receipt['paired_rollback_available']
assert Path(receipt['backup']).is_file()
active = run('docker', 'ps', '-q', '--filter', 'name=^/' + app + '$').stdout.strip()
assert run('python3', '-I', helper, 'update', root, ok=False).returncode != 0
assert run('docker', 'ps', '-q', '--filter', 'name=^/' + app + '$').stdout.strip() == active
green = phase('operator-green-smoke')
run('python3', '-I', helper, 'rollback', root)
assert meta()['CHM_VERSION'] == receipt['previous_runtime']
assert phase('snapshot') == before
assert game_tables() == tables_before

# A new operator guard needs a real post-apply recovery test. Reuse the already
# downloaded/verified kit; no second network transfer or app rebuild.
kit = receipts[0].parent / 'verified' / ('cheapshotmods-' + module.SOURCE + '-linux-amd64')
fault_work = downloads / 'postcheck-fault'
fault_work.mkdir(mode=0o700)
module.prepare = lambda root, parent: (module.installed(root, module.SUPPORTED), [], fault_work, kit)
module.check = lambda root: (_ for _ in ()).throw(RuntimeError('injected operator post-check failure'))
try:
    module.update(root, downloads)
    raise AssertionError('Post-check failure accepted')
except RuntimeError as error:
    assert 'injected operator post-check failure' in str(error)
assert meta()['CHM_VERSION'] == receipt['previous_runtime']
assert phase('snapshot') == before
assert game_tables() == tables_before
proxy_after = json.loads(run('docker', 'inspect', proxy).stdout)[0]
assert all(proxy_after[key] == proxy_before[key] for key in ['Id', 'Image', 'Mounts'])
assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest() == value for path, value in preserved.items())
proof = {'source_sha': module.SOURCE, 'delivery_commit': module.DELIVERY,
         'archive_sha256': module.ARCHIVE_SHA, 'operator_sha256': hashlib.sha256(helper.read_bytes()).hexdigest(),
         'platform': 'isolated Debian13/linux-amd64; managed Docker29.9.2/rootless/vfs',
         'private_GitHub_download_and_reassembly': 'passed', 'real_HTTPS_CA_IP_SAN': 'passed',
         'unknown_version_bad_credential_low_space_refuse_before_download_stop_or_backup': 'passed',
         'canonical_TASK008_to_TASK009_via_new_owner_helper': 'passed',
         'complete_seeded_original_work_history_equipment_spent_level_baseline_preserved': 'passed',
         'all_seven_game_tables_SQL_rows_and_hashes_equal_after_update_and_both_rollbacks': tables_before,
         'backup_before_update_and_separate_volume': 'passed', 'already_installed_repeat_refused': 'passed',
         'green_recipes_and_undo': green, 'paired_rollback_exact_state': 'passed',
         'injected_postcheck_failure_auto_rollback_exact_state': 'passed',
         'config_separate_b008_helper_and_proxy_ID_image_mounts_unchanged': 'passed',
         'test_data': 'synthetic isolated account/secret/CA; no owner data or server access',
         'independent_review': 'not performed by developer'}
(work / 'proof.json').write_text(json.dumps(proof, indent=2) + '\n')
print(json.dumps(proof, indent=2))
