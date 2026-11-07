"""Full isolated fbe-app/b008-operator compatibility; NEVER run on a shared host.

Uses immutable accepted kits and the pinned b008 full external fixture. Kits,
expected image proofs, production helper and disk guard are never patched.
Ordinary app lifecycle changes run only inside the disposable test installation.
Requires a dedicated local Docker socket, buildx/Compose and network for Debian
fixture packages. Test resources use unique project names and normal cleanup.
"""
from pathlib import Path
import subprocess
import json
import shlex
import sys

if len(sys.argv) != 4:
    raise SystemExit('Usage: test-operator-compat.py OLD_FBE_KIT NEW_B008_KIT NEW_EVIDENCE_DIR')
repo = Path(__file__).resolve().parents[1]
old, new, work = (Path(arg).resolve() for arg in sys.argv[1:])
assert json.loads((old/'manifest.json').read_text())['source_sha'] == 'fbe82aef6008d292515c0efce2fde601c221f3d2'
assert json.loads((new/'manifest.json').read_text())['source_sha'] == 'b008807fa1873de4fd6d926be42bc6bf515d6a66'
for kit in (old, new):
    subprocess.run(['sha256sum', '--check', '--status', 'SHA256SUMS'], cwd=kit, check=True)
for path in (old, new, work, repo):
    assert ',' not in str(path), 'Docker bind path must not contain commas'
work.mkdir(mode=0o700, parents=True, exist_ok=False)
source = subprocess.check_output(['git','-C',str(repo),'show','b008807fa1873de4fd6d926be42bc6bf515d6a66:scripts/external-fixture.py'],text=True)
source = source.replace("root = work/'install'", "root = work/'install'\noperator = root/'ingress-b008807.py'\noperator_hash = '884aad4f03bc774add681c228e6e7345641c6c074bb07b2f1b604d4f0b4d8011'")
assert source.count("str(bundle/'ingress.py')") == 1
source = source.replace("str(bundle/'ingress.py')", 'str(operator)')
install_call = "chm('install', root, config)"
assert source.count(install_call) == 1
source = source.replace(install_call, install_call+'''
assert version == 'fbe82aef6008d292515c0efce2fde601c221f3d2'
incoming = Path('/operator-source/ingress.py')
assert hashlib.sha256(incoming.read_bytes()).hexdigest() == operator_hash
# Same atomic, separate-file installation offered to the owner; managed helper,
# metadata, release files, app image and data volume remain the original fbe.
temporary = root/'operator-install.tmp'
shutil.copyfile(incoming, temporary)
temporary.chmod(0o600)
assert hashlib.sha256(temporary.read_bytes()).hexdigest() == operator_hash
temporary.replace(operator)
managed_helper = (root/'ingress.py').read_bytes()
assert managed_helper == (bundle/'ingress.py').read_bytes()
metadata_before_ingress = (root/'current.env').read_bytes()
''')
needle = "ingress('apply')\nproxy_id ="
assert source.count(needle) == 1
source = source.replace(needle, '''ingress('apply')
assert (root/'current.env').read_bytes() == metadata_before_ingress
assert (root/'ingress.py').read_bytes() == managed_helper
assert hashlib.sha256(operator.read_bytes()).hexdigest() == operator_hash
assert operator.stat().st_mode & 0o777 == 0o600
app_after_ingress = json.loads(docker('inspect', project+'-app-1'))[0]
for key in ('Id', 'Image', 'Mounts'):
    assert app_after_ingress[key] == app[key]
print('Operator-only initial stage/apply preserved fbe app container/image/data mount/current.env/managed helper.')
proxy_id =''')
old_inline = 'import sys,json; from pathlib import Path; sys.path.insert(0,sys.argv[1]); from ingress import Ingress; i=Ingress(Path(sys.argv[2])); i.rollback(json.loads(i.plan_file.read_text()),automatic=True)'
new_inline = 'import sys,json,importlib.util; from pathlib import Path; spec=importlib.util.spec_from_file_location("reviewed_ingress",sys.argv[1]); module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module); i=module.Ingress(Path(sys.argv[2])); i.rollback(json.loads(i.plan_file.read_text()),automatic=True)'
assert source.count(old_inline) == 2
source = source.replace(old_inline,new_inline).replace('str(bundle), str(root), ok=False', 'str(operator), str(root), ok=False')
source += '''
assert hashlib.sha256(operator.read_bytes()).hexdigest() == operator_hash
assert operator.stat().st_mode & 0o777 == 0o600
assert (root/'ingress.py').read_bytes() == managed_helper
meta_after = dict(line.split('=', 1) for line in (root/'current.env').read_text().splitlines())
assert meta_after['CHM_VERSION'] == version
assert (root/'releases'/version/'ingress.py').read_bytes() == managed_helper
assert json.loads(docker('inspect', project+'-app-1'))[0]['Config']['Image'] == app_image
proof = {'app_source_sha': version, 'operator_source_sha': 'b008807fa1873de4fd6d926be42bc6bf515d6a66', 'operator_sha256': operator_hash, 'operator_mode': '0600', 'initial_stage_apply_app_container_image_mounts_metadata_unchanged': True, 'managed_helper_and_release_unchanged': True, 'full_external_lifecycle_negatives_and_recovery': 'passed', 'separate_helper_survives_restart_restore_update_rollback': True, 'final_app_version': meta_after['CHM_VERSION'], 'data': 'isolated signed Telegram fixtures and real SQLite', 'real_host_or_acme_or_telegram_contacted': False}
(work/'operator-compat-proof.json').write_text(json.dumps(proof, indent=2)+'\\n')
print('Exact fbe app + separate b008 operator compatibility: passed full external lifecycle/negative/recovery.')
'''
compile(source, '<operator fixture>', 'exec')
(work/'external-fixture.py').write_text(source)
harness = subprocess.check_output(['git','-C',str(repo),'show','b008807fa1873de4fd6d926be42bc6bf515d6a66:scripts/test-external.sh'],text=True)
harness = harness.replace('source_dir="$(cd "$(dirname "$0")" && pwd)"', 'source_dir='+shlex.quote(str(repo/'scripts')))
harness = harness.replace('if [[ -n "${CODEX_PROXY_CERT:-}" ]]', 'mounts+=(--mount '+shlex.quote('type=bind,source='+str(work/'external-fixture.py')+',target=/fixtures/external-fixture.py,readonly')+' --mount '+shlex.quote('type=bind,source='+str(new)+',target=/operator-source,readonly')+')\nif [[ -n "${CODEX_PROXY_CERT:-}" ]]')
harness = harness.replace('  rm -rf "$work"', '  if [[ -f "$work/operator-compat-proof.json" ]]; then cp "$work/operator-compat-proof.json" '+shlex.quote(str(work/'proof.json'))+'; fi\n  rm -rf "$work"')
(work/'run.sh').write_text(harness)
print('Prepared exact fbe + separate exact b008 helper full external compatibility fixture.')

subprocess.run(['bash', '-n', str(work/'run.sh')], check=True)
with (work/'run.log').open('wb') as log:
    subprocess.run(['bash', str(work/'run.sh'), str(old)], check=True, stdout=log, stderr=subprocess.STDOUT)
print((work/'proof.json').read_text())
