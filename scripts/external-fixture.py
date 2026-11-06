"""Isolated shared ingress model; never connect to the real public IP.

HTTPS always connects to 127.0.0.1, verifies the fixture CA and IP SAN, and
sends the real selected Host/Origin. No production endpoint or auth bypass.
"""
import hashlib
import hmac
import http.client
import json
import os
from pathlib import Path
import shutil
import socket
import ssl
import subprocess
import sys
import time
import urllib.parse
import uuid

bundle, work = map(Path, sys.argv[1:3])
shared = sys.argv[3]
root = work/'install'
os.umask(0o077)
origin = 'https://94.228.170.13:9443'
proxy_name = shared+'-proxy'
neighbour_name = shared+'-neighbour'
app_image = json.loads((bundle/'manifest.json').read_text())['app_image']
version = json.loads((bundle/'manifest.json').read_text())['source_sha']
project = 'chm-'+hashlib.sha256(str(root).encode()).hexdigest()[:12]
fixture_caddy = 'caddy:2.11.4-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b'


def run(*args, ok=True, env=None, input=None):
    r = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, input=input)
    if ok and r.returncode:
        sys.stderr.buffer.write(r.stdout+r.stderr)
        raise AssertionError('fixture command failed: '+args[0])
    return r


def docker(*args):
    return run('docker', *args).stdout


def chm(*args, ok=True):
    return run('bash', str(bundle/'chm.sh'), *map(str, args), ok=ok)


def ingress(action, ok=True, env=None):
    return run('python3', str(bundle/'ingress.py'), action, str(root), '--container', proxy_name, '--internal-tls', ok=ok, env=env)


def write(path, value):
    path.write_text(json.dumps(value) if isinstance(value, dict) else value)


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


with socket.socket() as s:
    s.bind(('127.0.0.1', 9443))  # fail rather than disturb another service
ports = [free_port() for _ in range(5)]
config = work/'config.env'
write(config, f'CHM_PROXY_MODE=external\nPUBLIC_BASE_URL={origin}\nSESSION_SECRET=isolated-external-fixture-session-secret\n')
config.chmod(0o600)
chm('install', root, config)
meta = dict(line.split('=', 1) for line in (root/'current.env').read_text().splitlines())
app = json.loads(docker('inspect', project+'-app-1'))[0]
assert not app['HostConfig'].get('PortBindings')
assert set(app['NetworkSettings']['Networks']) == {meta['CHM_EXTERNAL_NETWORK']}
assert app['Mounts'][0]['Destination'] == '/data' and len(app['Mounts']) == 1
assert docker('ps', '-q', '--filter', 'label=com.docker.compose.project='+project).decode().count('\n') == 1

base = work/'uek-radar'
(base/'deploy').mkdir(parents=True)
(base/'neighbour').mkdir()
write(base/'neighbour'/'sentinel', 'neighbour-data-unchanged')
for name in ('portfolio', 'anjie', 'gtd'):
    (base/name).mkdir()
    write(base/name/'sentinel', name+'-private-fixture')
caddy = base/'deploy'/'Caddyfile.ip'
addresses = ', '.join('https://94.228.170.13:'+str(p) for p in (8443, 444, 713, 888))
write(caddy, '{\n default_sni 94.228.170.13\n}\nhttp://:80 {\n respond /.well-known/acme-challenge/* "challenge-kept"\n}\n'+addresses+' {\n tls internal\n reverse_proxy neighbour:3000\n}\n')
write(base/'front.Caddyfile', ':80 {\n reverse_proxy ip-proxy:80\n}\n')
files = [base/'compose.yaml']+[base/'deploy'/('compose.'+x+'.yaml') for x in ('ip', 'portfolio', 'anjie', 'gtd')]
write(files[0], {'services': {
    'neighbour': {'image': app_image, 'user': '0', 'container_name': neighbour_name, 'command': ['node', '-e', 'require("http").createServer((q,r)=>r.end(require("fs").readFileSync("/neighbour/sentinel"))).listen(3000,"0.0.0.0")'], 'volumes': [str(base/'neighbour')+':/neighbour:ro']},
    'front': {'image': fixture_caddy, 'ports': ['127.0.0.1:'+str(ports[4])+':80'], 'volumes': [str(base/'front.Caddyfile')+':/etc/caddy/Caddyfile:ro']},
    'ip-proxy': {'image': fixture_caddy, 'container_name': proxy_name, 'ports': ['127.0.0.1:'+str(ports[0])+':8443'], 'volumes': [str(caddy)+':/etc/caddy/Caddyfile:ro', 'ip_caddy_data:/data', 'ip_caddy_config:/config'], 'environment': {'PRIVATE_LITERAL': 'fixture-$$-literal'}}}, 'volumes': {'ip_caddy_data': {}, 'ip_caddy_config': {}}})
write(files[1], {'services': {'ip-proxy': {'ports': ['127.0.0.1:'+str(ports[1])+':444'], 'networks': {'default': {}, 'other': {}}}}, 'networks': {'other': {}}})
write(files[2], {'services': {'ip-proxy': {'ports': ['127.0.0.1:'+str(ports[2])+':713'], 'volumes': [str(base/'portfolio')+':/srv/anjie-portfolio:ro']}}})
write(files[3], {'services': {'ip-proxy': {'volumes': [str(base/'anjie')+':/var/www/shewashere:ro']}}})
write(files[4], {'services': {'ip-proxy': {'ports': ['127.0.0.1:'+str(ports[3])+':888'], 'volumes': [str(base/'gtd')+':/run/anjie-portfolio:ro']}}})
cmd = ['docker', 'compose', '--project-directory', str(base), '-p', shared]
for path in files:
    cmd += ['-f', str(path)]
run(*cmd, 'up', '-d', '--pull', 'never')
ca = work/'ca.crt'
for _ in range(40):
    r = run('docker', 'cp', proxy_name+':/data/caddy/pki/authorities/local/root.crt', str(ca), ok=False)
    if not r.returncode:
        break
    time.sleep(1)
else:
    raise AssertionError('fixture CA not created')
context = ssl.create_default_context(cafile=str(ca))


class LocalHTTPS(http.client.HTTPSConnection):
    def connect(self):
        self.sock = context.wrap_socket(socket.create_connection(('127.0.0.1', self.port), timeout=10), server_hostname='94.228.170.13')


def request(path, method='GET', data=None, headers=None, port=9443):
    c = LocalHTTPS('94.228.170.13', port, context=context, timeout=10)
    h = {'Host': '94.228.170.13:'+str(9443 if port == 9443 else 8443), **(headers or {})}
    if data is not None:
        h['Content-Type'] = 'application/json'
    c.request(method, path, json.dumps(data).encode() if data is not None else None, h)
    r = c.getresponse()
    result = r.status, r.read(), dict(r.getheaders())
    c.close()
    return result


def neighbours():
    for p in ports[:4]:
        assert request('/', port=p)[:2] == (200, b'neighbour-data-unchanged')
    c = http.client.HTTPConnection('127.0.0.1', ports[4], timeout=10)
    c.request('GET', '/.well-known/acme-challenge/fixture')
    r = c.getresponse()
    assert r.status == 200 and r.read() == b'challenge-kept'
    c.close()
    assert (base/'neighbour'/'sentinel').read_text() == 'neighbour-data-unchanged'


neighbours()
neighbour_id = json.loads(docker('inspect', neighbour_name))[0]['Id']
original = caddy.read_bytes()
# Deliberately omit one RUNNING compose override in the discovery response.
fake = work/'bin'
fake.mkdir()
wrapper = fake/'docker'
real_docker = '/usr/local/bin/docker'
write(wrapper, '#!/usr/bin/env python3\nimport subprocess,sys,json,os\na=sys.argv[1:]\nr=subprocess.run(["'+real_docker+'"]+a,stdout=subprocess.PIPE)\nif os.environ.get("DROP_OVERRIDE") and a[:1]==["inspect"]:\n x=json.loads(r.stdout); k="com.docker.compose.project.config_files"; x[0]["Config"]["Labels"][k]=",".join(x[0]["Config"]["Labels"][k].split(",")[:-1]); print(json.dumps(x))\nelif not r.returncode: sys.stdout.buffer.write(r.stdout)\nsys.exit(r.returncode)\n')
wrapper.chmod(0o700)
env = {**os.environ, 'PATH': str(fake)+':'+os.environ['PATH'], 'DROP_OVERRIDE': '1'}
assert ingress('stage', ok=False, env=env).returncode != 0
assert caddy.read_bytes() == original and not (caddy.parent/'compose.cheapshotmods.yaml').exists()
ingress('stage')
plan = json.loads((root/'ingress'/'plan.json').read_text())
assert plan['files'] == list(map(str, files))
assert (root/'ingress'/'changes.diff').stat().st_mode & 0o777 == 0o600
ingress('apply')
proxy_id = json.loads(docker('inspect', proxy_name))[0]['Id']
ingress('apply')
ingress('stage')
assert caddy.read_bytes().count(b'# BEGIN CHEAPSHOT MODS') == 1
assert json.loads(docker('inspect', proxy_name))[0]['Id'] == proxy_id
neighbours()
# Lifecycle update uses a separately labelled synthetic version of the real app.
update = work/'update-bundle'
update.mkdir()
for path in bundle.iterdir():
    if path.is_file() and path.name not in ('images.tar.gz', 'manifest.json', 'SHA256SUMS'):
        shutil.copyfile(path, update/path.name)
new_sha = hashlib.sha1(str(work).encode()).hexdigest()
new_image = 'cheapshotmods:'+new_sha
write(work/'update-image', new_image)
run('docker', 'build', '-q', '-t', new_image, '-', input=f'FROM {app_image}\nENV BUILD_SHA={new_sha}\nLABEL org.opencontainers.image.revision={new_sha}\n'.encode())
manifest = json.loads((bundle/'manifest.json').read_text())
manifest.update(source_sha=new_sha, app_image=new_image, app_image_id=json.loads(docker('image', 'inspect', new_image))[0]['Id'])
write(update/'manifest.json', manifest)
saved_tar = run('docker', 'image', 'save', new_image, manifest['proxy_image']).stdout
import gzip
(update/'images.tar.gz').write_bytes(gzip.compress(saved_tar, compresslevel=1))
write(update/'SHA256SUMS', ''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.name+'\n' for p in sorted(update.iterdir()) if p.is_file() and p.name != 'SHA256SUMS'))
before_update = state()
chm('update', root, update)
assert state() == before_update
assert json.loads(request('/version')[1])['version'] == new_sha
new_meta = dict(line.split('=', 1) for line in (root/'current.env').read_text().splitlines())
for k in ('CHM_PROXY_MODE', 'CHM_ORIGIN', 'CHM_EXTERNAL_NETWORK', 'CHM_APP_ALIAS'):
    assert new_meta[k] == meta[k]
chm('rollback', root)
assert state() == before_update and json.loads(request('/version')[1])['version'] == version
assert json.loads(docker('inspect', proxy_name))[0]['Id'] == proxy_id
neighbours()
# Origin/mode drift, missing network and disk pressure fail before transitions.
installed_config = root/'config.env'
config_before = installed_config.read_bytes()
for modified in [config_before.replace(b'94.228.170.13', b'94.228.170.14'), config_before.replace(b'CHM_PROXY_MODE=external', b'CHM_PROXY_MODE=standalone').replace(origin.encode(), b'https://example.com')+b'CADDY_EMAIL=fixture@example.com\n']:
    installed_config.write_bytes(modified)
    assert chm('restart', root, ok=False).returncode != 0
    assert json.loads(docker('inspect', proxy_name))[0]['Id'] == proxy_id
installed_config.write_bytes(config_before)
metadata_path = root/'current.env'
metadata_before = metadata_path.read_bytes()
metadata_path.write_bytes(metadata_before.replace(meta['CHM_EXTERNAL_NETWORK'].encode(), b'nonexistent-chm-fixture-network'))
assert chm('restart', root, ok=False).returncode != 0
metadata_path.write_bytes(metadata_before)
write(fake/'df', '#!/bin/sh\nprintf "Filesystem 1024-blocks Used Available Capacity Mounted\\nfixture 9999999 9999998 1 100%% /\\n"\n')
(fake/'df').chmod(0o700)
assert run('bash', str(bundle/'chm.sh'), 'restore', str(root), str(backup), ok=False, env={**os.environ, 'PATH': str(fake)+':'+os.environ['PATH']}).returncode != 0
(fake/'df').unlink()
assert json.loads(docker('inspect', proxy_name))[0]['Id'] == proxy_id
assert request('/health')[:2] == (200, b'{"status":"ok"}')
assert json.loads(request('/version')[1])['version'] == version
assert request('/api/state')[0] == 401
assert json.loads(request('/api/config')[1]) == {'oidc': False, 'mini': False}
assert b'<div id="root">' in request('/')[1]
# Enable only synthetic Telegram data, by normal private config/restart.
with config.open('a') as f:
    f.write('TELEGRAM_BOT_TOKEN=fixture-external-bot-token\n')
run('cp', str(config), str(root/'config.env'))
chm('restart', root)


def init_data():
    fields = {'auth_date': str(int(time.time())), 'user': json.dumps({'id': 333, 'first_name': 'Isolated fixture'})}
    secret = hmac.new(b'WebAppData', b'fixture-external-bot-token', hashlib.sha256).digest()
    fields['hash'] = hmac.new(secret, '\n'.join(k+'='+fields[k] for k in sorted(fields)).encode(), hashlib.sha256).hexdigest()
    return urllib.parse.urlencode(fields)


status, body, headers = request('/auth/mini', 'POST', {'initData': init_data()}, {'Origin': origin, 'X-Forwarded-Proto': 'http', 'X-Forwarded-For': '203.0.113.55'})
assert status == 200 and 'Secure' in headers['set-cookie'] and 'HttpOnly' in headers['set-cookie']
auth = {'Origin': origin, 'Cookie': headers['set-cookie'].split(';')[0], 'X-CSRF-Token': json.loads(body)['csrf']}


def state():
    r = request('/api/state', headers=auth)
    assert r[0] == 200
    return json.loads(r[1])


def command(action):
    s = state()
    data = {'key': str(uuid.uuid4()), 'revision': s['revision'], 'experiment': s['experiment'], 'action': action}
    r = request('/api/commands', 'POST', data, auth)
    assert r[0] == 200, r
    return json.loads(r[1])


initial = state()
bad = {'key': str(uuid.uuid4()), 'revision': initial['revision'], 'experiment': initial['experiment'], 'action': {'type': 'level', 'value': '200'}}
assert request('/api/commands', 'POST', bad, {**auth, 'Origin': 'https://wrong.invalid', 'X-Forwarded-Host': '94.228.170.13:9443', 'X-Forwarded-Proto': 'https'})[0] == 403
assert state() == initial
command({'type': 'level', 'value': '9007199254740993'})
g = command({'type': 'original.put', 'kind': '🅾', 'tier': 1, 'value': '10', 'quantity': '6'})['createdId']
command({'type': 'equip', 'items': [{'id': g, 'quantity': '3'}]})
command({'type': 'craft', 'items': [{'id': g, 'quantity': '3', 'worn': '3'}]})
saved = state()
chm('restart', root)
assert state() == saved
backup = Path(chm('backup', root).stdout.decode().strip())
assert backup.stat().st_mode & 0o777 == 0o600
command({'type': 'level', 'value': '200'})
chm('restore', root, backup)
assert state() == saved
command({'type': 'undo'})
assert state()['spent'] == '0' and state()['level'] == '9007199254740993'
chm('rollback', root)
assert state()['level'] == '200'
assert json.loads(docker('inspect', proxy_name))[0]['Id'] == proxy_id
neighbours()
# A browser/curl attacker cannot change the observed IP through Caddy forwarding.
assert any(request('/auth/mini', 'POST', {'initData': init_data()}, {'Origin': origin, 'X-Forwarded-For': '198.51.100.'+str(i)})[0] == 429 for i in range(1, 26))
ingress('rollback')
ingress('rollback')
assert caddy.read_bytes() == original
neighbours()
assert json.loads(docker('inspect', neighbour_name))[0]['Id'] == neighbour_id
assert not (caddy.parent/'compose.cheapshotmods.yaml').exists()
# Fail the shared proxy up once, AFTER the staged files have been applied.
# Recovery must use every original override and touch no neighbouring service.
ingress('stage')
text = wrapper.read_text()
text = text.replace('r=subprocess.run', 'if os.environ.get("FAIL_INGRESS") and "up" in a and any(x.endswith("compose.cheapshotmods.yaml") for x in a) and not os.path.exists(os.environ["FAIL_INGRESS"]):\n open(os.environ["FAIL_INGRESS"],"w").write("failed once"); sys.exit(17)\nr=subprocess.run', 1)
wrapper.write_text(text)
assert ingress('apply', ok=False, env={**os.environ, 'PATH': str(fake)+':'+os.environ['PATH'], 'FAIL_INGRESS': str(work/'failure-once')}).returncode != 0
assert (work/'failure-once').exists() and caddy.read_bytes() == original
assert json.loads((root/'ingress'/'plan.json').read_text())['status'] == 'rolled_back'
neighbours()
assert json.loads(docker('inspect', neighbour_name))[0]['Id'] == neighbour_id
# Interrupted apply is also journalled and recoverable by the documented command.
ingress('stage')
text = wrapper.read_text()
text = text.replace('r=subprocess.run', 'if os.environ.get("INTERRUPT_INGRESS") and "up" in a and any(x.endswith("compose.cheapshotmods.yaml") for x in a):\n import signal; os.kill(os.getppid(),signal.SIGTERM); sys.exit(17)\nr=subprocess.run', 1)
wrapper.write_text(text)
assert ingress('apply', ok=False, env={**os.environ, 'PATH': str(fake)+':'+os.environ['PATH'], 'INTERRUPT_INGRESS': '1'}).returncode != 0
assert json.loads((root/'ingress'/'plan.json').read_text())['status'] == 'applying'
ingress('rollback')
assert caddy.read_bytes() == original
neighbours()
print('External installer passed: exact IP:9443 over isolated trusted CA; Secure/Origin/forwarding; five overrides, neighbours/HTTP-01/mounts; restart/backup/restore/update/rollback; drift/network/disk refusal; ingress idempotence/rollback/failure recovery. No real IP/ACME/Telegram contacted.')
