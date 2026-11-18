#!/usr/bin/env python3
"""Owner-operated PR 11 delivery. No build, Actions, new key or proxy edits."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile

SOURCE = 'ed8503c77c684cb8d1b2a7163bfbb56958b62b9a'
DELIVERY = '1946771ac1379fb743912b2d3f6dfaad991289e1'
MANIFEST_SHA = '42281f9b52b5943aa253a825af9ec3d977005c58009b51cbf76234c8da570165'
ARCHIVE_SHA = 'd5f9f075dd6fedcfc0d21c3fdae37b175eadd3506e0acaa23fa79d9f0f50369a'
ARCHIVE_NAME = 'cheapshotmods-' + SOURCE + '-linux-amd64.tar.gz'
ARCHIVE_BYTES = 132014447
IMAGE_BYTES = 350826496
APP_CONFIG = 'sha256:31eb839e9764b59e86e86606d0ec7c213ffcb9aaf8186f59cef8ed1d60ac232b'
CREDENTIAL = Path('/root/.config/cheapshotmods/github.curl')
SUPPORTED = {
    'eb655846db16f3dbc6afdb8ca9f9ad4d710848b0',
    'fbe82aef6008d292515c0efce2fde601c221f3d2',
    '19a6fdde785eb90b01bd78318deeab1a539dde7b',
    '6dc8021e58daa9aa16a93a9265315bb810fe9d0a',
    'feb6a1bf82e70474c482c6a2e1fb0e77c4e20586',
    'd6cb0e9404f07b5573b64131281d29569a010442',
    'f944acb6435a9671cef6db5fc500b79a71d21133',
    '0f2cd90c5b672d67409c2687e4e90a8ce9797482',
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    with Path(path).open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run(args, *, capture=False, log=None):
    if log:
        with Path(log).open('ab') as stream:
            subprocess.run([str(x) for x in args], check=True,
                           stdout=stream, stderr=subprocess.STDOUT)
        return ''
    result = subprocess.run([str(x) for x in args], check=True, text=True,
                            stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else ''


def metadata(path):
    values = {}
    for line in Path(path).read_text().splitlines():
        require('=' in line, 'Invalid installed metadata; stop')
        key, value = line.split('=', 1)
        require(key not in values, 'Duplicate installed metadata; stop')
        values[key] = value
    return values


def private_file(path):
    path = Path(path)
    require(not path.is_symlink() and path.is_file(), 'Missing private regular file: ' + str(path))
    info = path.stat()
    require(info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o600,
            'Expected root-owned mode0600: ' + str(path))


def installed(root, versions):
    require(root.is_absolute() and not root.is_symlink() and root.is_dir(), 'Invalid installation root')
    require((root / '.cheapshotmods').is_file(), 'Not a Cheapshot installation')
    private_file(root / 'config.env')
    current = metadata(root / 'current.env')
    version = current.get('CHM_VERSION', '')
    display = version if re.fullmatch(r'[a-f0-9]{40}', version) else '(invalid metadata)'
    require(version in versions, 'Unexpected installed version ' + display + '; stop without update')
    require(current.get('CHM_PROXY_MODE') == 'external', 'Expected existing external proxy mode')
    for key in ['CHM_PROJECT', 'CHM_DATA_VOLUME', 'CHM_APP_IMAGE']:
        require(re.fullmatch(r'[A-Za-z0-9:._-]+', current.get(key, '')),
                'Invalid installed Docker identifier')
    return current


def preflight(root, download_parent):
    current = installed(root, SUPPORTED)
    private_file(CREDENTIAL)
    require(os.uname().machine == 'x86_64', 'Expected Linux amd64 Debian host')
    release = Path('/etc/os-release').read_text()
    require(re.search(r'^ID=[\"\']?debian[\"\']?$', release, re.M), 'Expected Debian host')
    require(download_parent.is_absolute() and download_parent.is_dir()
            and not download_parent.is_symlink(), 'Invalid download parent')
    run(['bash', root / 'chm.sh', 'check', root])
    volume_size = run(['docker', 'run', '--rm', '--pull=never', '--mount',
                       'source=' + current['CHM_DATA_VOLUME'] + ',target=/data,readonly',
                       current['CHM_APP_IMAGE'], 'du', '-sk', '/data'], capture=True).split()[0]
    require(volume_size.isdecimal(), 'Cannot size the current data safely')
    data_bytes = int(volume_size) * 1024
    # Preserve the installer's 2GiB + two images + two data copies, plus the
    # explicit online backup and peak download/reassembly/extraction storage.
    required = 2 * 1024**3 + 2 * IMAGE_BYTES + 3 * data_bytes + 3 * ARCHIVE_BYTES + 8 * 1024**2
    docker_root = Path(run(['docker', 'info', '--format', '{{.DockerRootDir}}'], capture=True))
    require(docker_root.is_dir(), 'Cannot inspect local Docker storage')
    spaces = []
    for path in [root, download_parent, docker_root]:
        free = shutil.disk_usage(path).free
        require(free >= required, 'Insufficient free space at ' + str(path)
                + ': need ' + str(required) + ' bytes, available ' + str(free)
                + '; no cleanup or guard bypass performed')
        spaces.append({'path': str(path), 'free_bytes': free, 'required_bytes': required})
    print('Installed runtime:', current['CHM_VERSION'], flush=True)
    print('Space preflight passed:', required, 'bytes required at each relevant filesystem', flush=True)
    return current, spaces


def verify_delivery(snapshot, destination):
    require(destination.is_dir() and not any(destination.iterdir()), 'Verification destination must be empty')
    root_name = None
    manifest = None
    part_index = 0
    seen = set()
    whole = hashlib.sha256()
    archive = destination / ARCHIVE_NAME
    total = 0
    with archive.open('xb') as output, tarfile.open(snapshot, 'r|gz') as outer:
        for member in outer:
            path = PurePosixPath(member.name)
            require(not path.is_absolute() and '..' not in path.parts and len(member.name) < 300,
                    'Unsafe transport path')
            require(bool(path.parts), 'Empty transport path')
            if root_name is None:
                root_name = path.parts[0]
            require(path.parts[0] == root_name, 'Multiple transport roots')
            relative = '/'.join(path.parts[1:])
            if member.isdir():
                require(relative in ('', 'parts'), 'Unexpected transport directory')
                continue
            require(member.isfile() and relative not in seen, 'Unsupported or duplicate transport member')
            seen.add(relative)
            stream = outer.extractfile(member)
            if relative == 'README.txt':
                require(member.size <= 8192, 'Oversized transport note')
            elif relative == 'delivery.json':
                require(manifest is None and member.size <= 65536, 'Invalid transport manifest')
                raw = stream.read()
                require(hashlib.sha256(raw).hexdigest() == MANIFEST_SHA, 'Transport manifest hash mismatch')
                manifest = json.loads(raw)
                require(manifest['source_sha'] == SOURCE and manifest['archive_sha256'] == ARCHIVE_SHA
                        and manifest['archive_bytes'] == ARCHIVE_BYTES and len(manifest['parts']) == 32,
                        'Unexpected transport identity')
            else:
                require(manifest is not None and part_index < 32, 'Parts precede manifest or exceed count')
                part = manifest['parts'][part_index]
                require(relative == 'parts/' + part['name'] and member.size == part['bytes'],
                        'Unexpected part order or size')
                part_hash = hashlib.sha256()
                while chunk := stream.read(1024 * 1024):
                    part_hash.update(chunk)
                    whole.update(chunk)
                    total += len(chunk)
                    require(total <= ARCHIVE_BYTES, 'Oversized reassembled archive')
                    output.write(chunk)
                require(part_hash.hexdigest() == part['sha256'], 'Transport part hash mismatch')
                part_index += 1
    require(part_index == 32 and total == ARCHIVE_BYTES and whole.hexdigest() == ARCHIVE_SHA,
            'Incomplete or corrupt original archive')
    prefix = 'cheapshotmods-' + SOURCE + '-linux-amd64'
    with tarfile.open(archive, 'r|gz') as inner:
        unpacked = 0
        seen = set()
        for member in inner:
            path = PurePosixPath(member.name)
            require(not path.is_absolute() and '..' not in path.parts
                    and path.parts[0] == prefix and len(path.parts) <= 2,
                    'Unsafe kit path')
            require(member.name not in seen, 'Duplicate kit member')
            seen.add(member.name)
            target = destination.joinpath(*path.parts)
            if member.isdir():
                target.mkdir(mode=0o700, exist_ok=True)
            else:
                require(member.isfile(), 'Unsupported kit member')
                unpacked += member.size
                require(unpacked <= ARCHIVE_BYTES + 32 * 1024**2, 'Oversized kit')
                target.parent.mkdir(mode=0o700, exist_ok=True)
                with target.open('xb') as output:
                    shutil.copyfileobj(inner.extractfile(member), output, 1024 * 1024)
                target.chmod(member.mode & 0o700)
    kit = destination / prefix
    m = json.loads((kit / 'manifest.json').read_text())
    require(m['format'] == 2 and m['source_sha'] == SOURCE and m['image_bytes'] == IMAGE_BYTES
            and m['image_proofs']['app']['config_digest'] == APP_CONFIG, 'Unexpected kit manifest')
    sums = (kit / 'SHA256SUMS').read_text().splitlines()
    require(len(sums) == 13, 'Unexpected kit checksum count')
    for line in sums:
        require(re.fullmatch(r'[a-f0-9]{64}  [A-Za-z0-9._-]+', line), 'Invalid kit checksum row')
        expected, filename = line.split('  ')
        require(digest(kit / filename) == expected, 'Kit checksum mismatch')
    require({p.name for p in kit.iterdir()} == {line.split('  ')[1] for line in sums} | {'SHA256SUMS'},
            'Unexpected kit files')
    run(['python3', '-I', kit / 'image-proof.py', 'archive', kit / 'manifest.json', kit / 'images.tar.gz'])
    return kit


def prepare(root, download_parent):
    current, spaces = preflight(root, download_parent)
    work = Path(tempfile.mkdtemp(prefix='cheapshotmods-pr11-', dir=download_parent))
    print('Private delivery directory:', work, flush=True)
    snapshot = work / 'delivery-snapshot.tar.gz'
    run(['curl', '--disable', '--config', CREDENTIAL, '--fail', '--silent', '--show-error',
         '--location', '--connect-timeout', '15', '--max-time', '600', '--max-filesize',
         str(ARCHIVE_BYTES + 8 * 1024**2), '--output', snapshot,
         'https://api.github.com/repos/sa713/cheapshotmods/tarball/' + DELIVERY])
    verify_dir = work / 'verified'
    verify_dir.mkdir(mode=0o700)
    kit = verify_delivery(snapshot, verify_dir)
    # Only verified transport duplicates belonging to this invocation.
    snapshot.unlink()
    (verify_dir / ARCHIVE_NAME).unlink()
    return current, spaces, work, kit


def check(root):
    current = installed(root, {SOURCE})
    run(['bash', root / 'chm.sh', 'check', root])
    containers = run(['docker', 'ps', '-q', '--filter',
                      'label=com.docker.compose.project=' + current['CHM_PROJECT'], '--filter',
                      'label=com.docker.compose.service=app'], capture=True).splitlines()
    require(len(containers) == 1, 'Expected one running Cheapshot app')
    script = """const D=require('better-sqlite3');const d=new D('/data/cheapshot.sqlite',{readonly:true,fileMustExist:true});
const schema=d.pragma('user_version',{simple:true}),ok=d.pragma('integrity_check',{simple:true})==='ok',foreign=d.pragma('foreign_key_check').length;
if(schema!==6||!ok||foreign)throw Error('Database integrity/schema check failed');
const result={schema,integrity:'ok',foreignKeyErrors:foreign,originalRows:d.prepare(\"SELECT count(*) n FROM groups WHERE scope='original'\").get().n,workRows:d.prepare(\"SELECT count(*) n FROM groups WHERE scope='work'\").get().n,historyRows:d.prepare('SELECT count(*) n FROM history').get().n,baselineRows:d.prepare('SELECT count(*) n FROM baselines').get().n};d.close();console.log(JSON.stringify(result));"""
    audit = json.loads(run(['docker', 'exec', containers[0], 'node', '-e', script], capture=True))
    print('Database check:', json.dumps(audit), flush=True)
    return current, audit


def rollback(root):
    current = installed(root, {SOURCE})
    previous = metadata(root / 'previous.env')
    require(previous.get('CHM_VERSION') in SUPPORTED
            and previous.get('CHM_PROXY_MODE') == current['CHM_PROXY_MODE'] == 'external',
            'Unexpected rollback pair; stop without changing metadata')
    print('Rollback target:', previous['CHM_VERSION'], flush=True)
    run(['bash', root / 'chm.sh', 'rollback', root])
    run(['bash', root / 'chm.sh', 'check', root])


def update(root, download_parent):
    before, spaces, work, kit = prepare(root, download_parent)
    before_raw = (root / 'current.env').read_bytes()
    require(metadata(root / 'current.env') == before, 'Installed metadata changed during preparation')
    (work / 'before-update.env').write_bytes(before_raw)
    preserve = {str(root / 'config.env'): digest(root / 'config.env')}
    helper = root / 'ingress-b008807.py'
    if helper.exists():
        private_file(helper)
        preserve[str(helper)] = digest(helper)
    (work / 'preserved-hashes.json').write_text(json.dumps(preserve, indent=2) + '\n')
    backup = Path(run(['bash', root / 'chm.sh', 'backup', root], capture=True))
    require(backup.is_file() and backup.parent == root / 'backups', 'Cannot confirm pre-update backup')
    (work / 'pre-update-backup.path').write_text(str(backup) + '\n')
    print('Pre-update backup:', backup, flush=True)
    log = work / 'update.log'
    try:
        print('Applying the verified kit; diagnostics:', log, flush=True)
        # Unmodified packaged installer verifies archive/imported config+layers
        # and checks space BEFORE stopping the app or copying/migrating data.
        run(['bash', kit / 'chm.sh', 'update', root, kit], log=log)
        current, audit = check(root)
        require((root / 'previous.env').read_bytes() == before_raw, 'Unexpected previous metadata')
        require(current['CHM_DATA_VOLUME'] != before['CHM_DATA_VOLUME'], 'Expected a separate new data volume')
        for path in preserve:
            private_file(path)
        require(all(digest(path) == expected for path, expected in preserve.items()),
                'Preserved config/helper hash changed')
    except BaseException:
        # The installer already recovers failures during transition. Roll back
        # post-check failures only when this exact previous pair is still known.
        now = metadata(root / 'current.env')
        if now.get('CHM_VERSION') == SOURCE and (root / 'previous.env').read_bytes() == before_raw:
            print('Post-check failed; restoring the exact previous pair.', file=sys.stderr, flush=True)
            rollback(root)
        elif now.get('CHM_VERSION') == before['CHM_VERSION']:
            print('Update failed; previous metadata retained. Check the private log.', file=sys.stderr)
        raise
    receipt = {'runtime_sha': SOURCE, 'delivery_commit': DELIVERY, 'archive_sha256': ARCHIVE_SHA,
               'previous_runtime': before['CHM_VERSION'], 'previous_data_volume': before['CHM_DATA_VOLUME'],
               'new_data_volume': current['CHM_DATA_VOLUME'], 'backup': str(backup),
               'config_and_separate_helper_unchanged': True, 'paired_rollback_available': True,
               'spaces_before': spaces, 'database_check': audit,
               'scope': 'host update/check; live user acceptance remains separate'}
    (work / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print('Updated runtime:', SOURCE, flush=True)
    print('Receipt:', work / 'receipt.json', flush=True)
    print('Reload website/Mini App and verify the compact layout and your inventory, history and snapshot.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('operation', choices=['preflight', 'prepare', 'update', 'check', 'rollback', 'verify-delivery'])
    parser.add_argument('paths', nargs='*')
    args = parser.parse_args()
    os.umask(0o077)
    if args.operation == 'verify-delivery':
        require(len(args.paths) == 2, 'verify-delivery SNAPSHOT EMPTY_DESTINATION')
        print(verify_delivery(Path(args.paths[0]), Path(args.paths[1])))
        return
    require(os.geteuid() == 0, 'Run the operator command as root')
    require(len(args.paths) <= 1, 'Specify at most one installation root')
    for name in ['DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']:
        os.environ.pop(name, None)
    os.environ['DOCKER_HOST'] = 'unix:///var/run/docker.sock'
    root = Path(args.paths[0] if args.paths else '/opt/cheapshotmods')
    parent = Path(os.environ.get('CHM_DOWNLOAD_PARENT', '/root'))
    if args.operation == 'preflight':
        preflight(root, parent)
    elif args.operation == 'prepare':
        print('Verified kit:', prepare(root, parent)[3])
    elif args.operation == 'update':
        update(root, parent)
    elif args.operation == 'check':
        check(root)
    else:
        rollback(root)


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError, tarfile.TarError, subprocess.CalledProcessError) as error:
        print('TASK-009 stopped:', error, file=sys.stderr)
        sys.exit(1)
