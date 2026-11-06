#!/usr/bin/env python3
"""Operator-only transaction for an EXISTING Caddy compose service.

No SSH, ACME requests, registry pulls, application auth or neighbour lifecycle.
All resolved configuration/diagnostics remain in the installation's private dir.
"""
import argparse
import difflib
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import time
import urllib.parse

os.umask(0o077)


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def private(path, data):
    require(not path.is_symlink(), 'symlink in private staging directory')
    path.write_bytes(data if isinstance(data, bytes) else data.encode())
    path.chmod(0o600)


def atomic(path, data, original=None):
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.chm-', delete=False) as f:
        name = f.name
        try:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
            os.fchmod(f.fileno(), original.st_mode & 0o777 if original else 0o600)
            if original:
                os.fchown(f.fileno(), original.st_uid, original.st_gid)
        except BaseException:
            os.unlink(name)
            raise
    os.replace(name, path)


def encoded(value):
    return (json.dumps(value, sort_keys=True, indent=2)+'\n').encode()


def metadata(root):
    require(root.is_absolute() and root.resolve() == root and root.is_dir(), 'ROOT must be a canonical existing installation')
    require((root/'.cheapshotmods').is_file(), 'not a Cheapshot installation')
    data = dict(line.split('=', 1) for line in (root/'current.env').read_text().splitlines())
    require(data.get('CHM_PROXY_MODE') == 'external', 'installation must use external proxy mode')
    for key in ('CHM_PROJECT', 'CHM_EXTERNAL_NETWORK', 'CHM_APP_ALIAS'):
        require(re.fullmatch(r'[a-z0-9-]+', data[key]), 'invalid generated installation metadata')
    url = urllib.parse.urlsplit(data['CHM_ORIGIN'])
    require(url.scheme == 'https' and url.port and url.port > 1024, 'external ingress needs an explicit unprivileged HTTPS port')
    return data, url


class Ingress:
    def __init__(self, root):
        self.root = root
        self.meta, self.url = metadata(root)
        self.directory = root/'ingress'
        require(not self.directory.is_symlink(), 'staging directory is a symlink')
        self.directory.mkdir(mode=0o700, exist_ok=True)
        self.directory.chmod(0o700)
        self.plan_file = self.directory/'plan.json'

    def run(self, args):
        result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        with (self.directory/'diagnostics.log').open('ab') as f:
            f.write(result.stderr)
        if result.returncode:
            raise RuntimeError('command failed; inspect private ingress/diagnostics.log locally (do not send secrets)')
        return result.stdout

    def docker(self, *args):
        return self.run(['docker', *args])

    def inspect(self, container):
        return json.loads(self.docker('inspect', container))[0]

    def compose(self, plan, extra=None):
        args = ['docker', 'compose', '--project-directory', plan['working_dir'], '--project-name', plan['project']]
        for path in plan['files'] + ([str(extra)] if extra else []):
            args.extend(['-f', path])
        return args

    def config(self, plan, extra=None):
        return json.loads(self.run(self.compose(plan, extra)+['config', '--format', 'json']))

    def network(self):
        network = json.loads(self.docker('network', 'inspect', self.meta['CHM_EXTERNAL_NETWORK']))[0]
        require(network['Labels'].get('cheapshotmods.root') == self.meta['CHM_PROJECT'], 'dedicated network missing or foreign')

    def platform(self):
        require(os.uname().machine == 'x86_64', 'only Debian amd64 is supported')
        release = Path('/etc/os-release').read_text()
        require(re.search(r'^ID=debian$', release, re.M), 'only Debian is supported')
        endpoint = os.environ.get('DOCKER_HOST')
        if os.environ.get('DOCKER_CONTEXT') or not endpoint:
            args = ['context', 'inspect']
            if os.environ.get('DOCKER_CONTEXT'):
                args.append(os.environ['DOCKER_CONTEXT'])
            endpoint = self.docker(*args, '--format', '{{.Endpoints.docker.Host}}').decode().strip()
        require(endpoint.startswith('unix://'), 'only a local Docker Unix socket is supported')
        self.network()

    def running_matches(self, cfg, plan, container):
        """Detect omitted overrides against actual running resources, not a template."""
        service = cfg['services'][plan['service']]
        def ports_config():
            return {(p.get('host_ip') or '0.0.0.0', str(p['published']), str(p['target']), p.get('protocol', 'tcp')) for p in service.get('ports', [])}
        actual_ports = {(p['HostIp'] or '0.0.0.0', p['HostPort'], target.split('/')[0], target.split('/')[1]) for target, bindings in (container['HostConfig'].get('PortBindings') or {}).items() for p in bindings or []}
        require(ports_config() == actual_ports, 'rendered ports differ from running proxy; full ordered compose stack required')
        mounts = set()
        for v in service.get('volumes', []):
            source = cfg['volumes'][v['source']]['name'] if v['type'] == 'volume' else v['source']
            mounts.add((v['type'], source, v['target'], not v.get('read_only', False)))
        actual_mounts = {(v['Type'], v.get('Name') if v['Type'] == 'volume' else v['Source'], v['Destination'], v['RW']) for v in container['Mounts']}
        require(mounts == actual_mounts, 'rendered mounts differ from running proxy; omitted override or changed configuration')
        networks = {cfg['networks'][name]['name'] for name in service.get('networks', {})}
        require(networks == set(container['NetworkSettings']['Networks']), 'rendered networks differ from running proxy')
        image = json.loads(self.docker('image', 'inspect', service['image']))[0]
        require(image['Id'] == container['Image'] == plan['image'], 'proxy image/tag changed; refuse implicit upgrade')
        require(service.get('command', container['Config']['Cmd']) == container['Config']['Cmd'], 'proxy command differs from running service')

    def validation(self, cfg, plan, caddy_file, name):
        # Resolve actual env/mounts through Compose; no host secrets are printed.
        # All existing mounts are read-only and there is no network for validation.
        service = json.loads(json.dumps(cfg['services'][plan['service']]))
        service['image'] = plan['image']
        for key in ('ports', 'networks', 'container_name', 'depends_on', 'restart', 'healthcheck'):
            service.pop(key, None)
        service['network_mode'] = 'none'
        service['pull_policy'] = 'never'
        for mount in service.get('volumes', []):
            mount['read_only'] = True
            if mount['target'] == '/etc/caddy/Caddyfile':
                mount.update(type='bind', source=str(caddy_file))
                mount.pop('volume', None)
        service['entrypoint'] = ['caddy']
        test_cfg = {'name': plan['project']+'-chm-validation', 'services': {'validate': service}, 'volumes': cfg.get('volumes', {})}
        for volume in test_cfg['volumes'].values():
            volume['external'] = True
            volume.pop('labels', None)
        path = self.directory/(name+'.validation.json')
        # Resolved env may contain literal dollars. Prevent a second Compose
        # interpolation when feeding its JSON back to Compose for validation.
        private(path, encoded(test_cfg).replace(b'$', b'$$'))
        command = ['docker', 'compose', '--project-directory', plan['working_dir'], '-f', str(path), 'run', '--rm', '--no-deps', '-T', 'validate']
        adapted = json.loads(self.run(command+['adapt', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile']))
        self.run(command+['validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile'])
        return adapted

    def stage(self, container_name, internal=False):
        self.platform()
        if self.plan_file.exists():
            plan = json.loads(self.plan_file.read_text())
            if plan['status'] == 'applied':
                self.unchanged(plan, applied=True)
                self.running_matches(self.config(plan, plan['override']), plan, self.inspect(plan['container']))
                print('Ingress already applied; no duplicate route or port added.')
                return
            require(plan['status'] == 'rolled_back', 'existing pending stage; apply/rollback it first')
        running = self.inspect(container_name)
        labels = running['Config']['Labels']
        files = labels['com.docker.compose.project.config_files'].split(',')
        working_dir = labels['com.docker.compose.project.working_dir']
        require(labels['com.docker.compose.service'] == 'ip-proxy', 'target must be the existing ip-proxy service')
        require(all(Path(f).is_absolute() and Path(f).is_file() for f in files), 'all running ordered compose files must exist')
        caddy = [m for m in running['Mounts'] if m['Destination'] == '/etc/caddy/Caddyfile']
        require(len(caddy) == 1 and caddy[0]['Type'] == 'bind', 'expected existing Caddyfile bind mount')
        target = Path(caddy[0]['Source'])
        require(not target.is_symlink(), 'Caddyfile symlink not supported')
        override = target.parent/'compose.cheapshotmods.yaml'
        require(not override.exists(), 'override already exists without matching transaction; refuse overwrite')
        plan = dict(status='staged', container=container_name, original_container=running['Id'], project=labels['com.docker.compose.project'], service='ip-proxy', files=files, working_dir=working_dir, caddy=str(target), override=str(override), image=running['Image'], origin=self.meta['CHM_ORIGIN'], hashes={f: digest(Path(f).read_bytes()) for f in files})
        require(len(files) == len(set(files)), 'duplicate running compose file')
        base = self.config(plan)
        self.running_matches(base, plan, running)
        private(self.directory/'before.compose.json', encoded(base))
        original = target.read_bytes()
        require(b'# BEGIN CHEAPSHOT MODS' not in original, 'unmanaged Cheapshot route marker already exists')
        private(self.directory/'before.Caddyfile', original)
        network_key = self.meta['CHM_PROJECT']+'-edge'
        change = {'services': {'ip-proxy': {'ports': [f"{self.url.port}:{self.url.port}/tcp"], 'networks': {network_key: {}}}}, 'networks': {network_key: {'external': True, 'name': self.meta['CHM_EXTERNAL_NETWORK']}}}
        private(self.directory/'override.json', encoded(change))
        staged = self.config(plan, self.directory/'override.json')
        # Compare full merged config to baseline. Only these two additions allowed.
        expected = json.loads(json.dumps(base))
        expected['services']['ip-proxy'].setdefault('ports', []).append({'mode': 'ingress', 'target': self.url.port, 'published': str(self.url.port), 'protocol': 'tcp'})
        expected['services']['ip-proxy'].setdefault('networks', {})[network_key] = None
        expected.setdefault('networks', {})[network_key] = {'name': self.meta['CHM_EXTERNAL_NETWORK'], 'external': True}
        # Compose may order/represent empty network options differently.
        def normalized(cfg):
            cfg = json.loads(json.dumps(cfg))
            for svc in cfg['services'].values():
                svc['ports'] = sorted(svc.get('ports', []), key=lambda p: json.dumps(p, sort_keys=True))
                svc['networks'] = {k: v or None for k, v in svc.get('networks', {}).items()}
            return cfg
        require(normalized(staged) == normalized(expected), 'merged compose changes more than one port and the dedicated network')
        private(self.directory/'staged.compose.json', encoded(staged))
        tls = 'tls internal' if internal else 'tls {\n        issuer acme {\n            profile shortlived\n            disable_tlsalpn_challenge\n        }\n    }'
        block = f'\n# BEGIN CHEAPSHOT MODS {self.meta["CHM_PROJECT"]}\nhttps://{self.url.hostname}:{self.url.port} {{\n    {tls}\n    reverse_proxy {self.meta["CHM_APP_ALIAS"]}:3000\n}}\n# END CHEAPSHOT MODS\n'
        private(self.directory/'staged.Caddyfile', original+block.encode())
        before = self.validation(base, plan, self.directory/'before.Caddyfile', 'before')
        after = self.validation(staged, plan, self.directory/'staged.Caddyfile', 'staged')
        # Existing certificate/HTTP-01 automation must not be changed or replaced.
        require(before.get('apps', {}).get('tls') == after.get('apps', {}).get('tls'), 'TLS automation differs; existing IP issuer must match the supplied route policy')
        private(self.directory/'changes.diff', ''.join(difflib.unified_diff(original.decode().splitlines(True), (original+block.encode()).decode().splitlines(True), fromfile='current Caddyfile', tofile='staged Caddyfile', n=0))+''.join(difflib.unified_diff(encoded(base).decode().splitlines(True), encoded(staged).decode().splitlines(True), fromfile='current full compose', tofile='staged full compose', n=0)))
        plan['caddy_before'] = digest(original)
        plan['caddy_after'] = digest(original+block.encode())
        plan['override_hash'] = digest((self.directory/'override.json').read_bytes())
        private(self.plan_file, encoded(plan))
        print('Staged: private backup, changes.diff, complete ordered compose and Caddy validation passed. Apply recreates ONLY ip-proxy; expect a short interruption of its routes.')

    def unchanged(self, plan, applied=False):
        self.platform()
        require(plan['origin'] == self.meta['CHM_ORIGIN'], 'installation origin changed')
        for path, expected in plan['hashes'].items():
            require(digest(Path(path).read_bytes()) == expected, 'compose source changed since stage; refuse overwrite')
        require(digest(Path(plan['caddy']).read_bytes()) == plan['caddy_after' if applied else 'caddy_before'], 'Caddyfile changed since stage; refuse overwrite')
        if applied:
            require(digest(Path(plan['override']).read_bytes()) == plan['override_hash'], 'owned override changed; refuse overwrite')
        else:
            require(not Path(plan['override']).exists(), 'override path appeared after stage')
        require(self.config(plan) == json.loads((self.directory/'before.compose.json').read_text()), 'resolved compose/env changed since stage')

    def start(self, plan, extra=None):
        self.run(self.compose(plan, extra)+['up', '-d', '--no-deps', '--force-recreate', '--pull', 'never', '--no-build', plan['service']])
        for _ in range(30):
            current = self.inspect(plan['container'])
            if current['State']['Running'] and not current['State'].get('Restarting'):
                time.sleep(2)
                if self.inspect(plan['container'])['State']['Running']:
                    self.running_matches(self.config(plan, extra), plan, self.inspect(plan['container']))
                    self.docker('exec', plan['container'], 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile', '--adapter', 'caddyfile')
                    return
            time.sleep(1)
        raise RuntimeError('proxy did not become ready')

    def rollback(self, plan, automatic=False):
        if not automatic:
            if plan['status'] == 'rolled_back':
                self.unchanged(plan)
                print('Ingress already rolled back.')
                return
            require(plan['status'] == 'applied', 'stage was not applied')
            self.unchanged(plan, applied=True)
        target = Path(plan['caddy'])
        atomic(target, (self.directory/'before.Caddyfile').read_bytes(), target.stat())
        override = Path(plan['override'])
        if override.exists():
            require(digest(override.read_bytes()) == plan['override_hash'], 'refuse removing changed override')
            override.unlink()
        self.start(plan)
        plan['status'] = 'rolled_back'
        private(self.plan_file, encoded(plan))
        print('Original proxy restored with its FULL ordered compose stack. Cheapshot app/data retained.')

    def apply(self, plan):
        if plan['status'] == 'applied':
            self.unchanged(plan, applied=True)
            print('Ingress already applied.')
            return
        require(plan['status'] == 'staged', 'stage again after rollback')
        self.unchanged(plan)
        require(self.inspect(plan['container'])['Id'] == plan['original_container'], 'proxy was recreated since stage')
        require(not self.run(['ss', '-H', '-ltn', f'( sport = :{self.url.port} )']).strip(), 'new public port is occupied')
        self.running_matches(self.config(plan), plan, self.inspect(plan['container']))
        # Last validation before the only writes to the shared project.
        self.validation(json.loads((self.directory/'staged.compose.json').read_text()), plan, self.directory/'staged.Caddyfile', 'apply')
        try:
            target = Path(plan['caddy'])
            atomic(target, (self.directory/'staged.Caddyfile').read_bytes(), target.stat())
            atomic(Path(plan['override']), (self.directory/'override.json').read_bytes())
            self.start(plan, plan['override'])
            plan['status'] = 'applied'
            private(self.plan_file, encoded(plan))
            print('Ingress applied. Run Cheapshot check and verify existing routes/TLS externally.')
        except BaseException:
            self.rollback(plan, automatic=True)
            raise RuntimeError('apply failed; original proxy restored. Inspect private diagnostics locally.') from None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['stage', 'apply', 'rollback'])
    parser.add_argument('root', type=Path)
    parser.add_argument('--container', default='uek-radar-ip-proxy-1')
    parser.add_argument('--internal-tls', action='store_true', help='isolated fixture ONLY, never public Telegram')
    args = parser.parse_args()
    ingress = Ingress(args.root)
    if args.action == 'stage':
        ingress.stage(args.container, args.internal_tls)
    else:
        plan = json.loads(ingress.plan_file.read_text())
        getattr(ingress, args.action)(plan)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        # Never echo raw compose/provider errors, config, env or request data.
        print('Cheapshot ingress refused: '+(str(error) if isinstance(error, RuntimeError) else 'invalid/missing transaction input; inspect private diagnostics locally'), file=__import__('sys').stderr)
        raise SystemExit(1)
