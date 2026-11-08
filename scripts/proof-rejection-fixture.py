"""Actual installer rejects substituted loaded config before persistent resources."""
import gzip
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import uuid

bundle, work = map(Path, sys.argv[1:3])
m = json.loads((bundle/'manifest.json').read_text())
app = m['app_image']
bad_tag = 'cheapshotmods:r6-substitution-'+uuid.uuid4().hex
real = '/usr/local/bin/docker'
marker = 'R6_PRIVATE_VALUE_MUST_NOT_APPEAR'


def run(*args, ok=True, **kwargs):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, **kwargs)
    if ok and result.returncode:
        raise AssertionError('R6 rejection fixture setup failed: '+args[0])
    return result


def load():
    with gzip.open(bundle/'images.tar.gz', 'rb') as stream:
        process = subprocess.Popen([real, 'image', 'load'], stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.copyfileobj(stream, process.stdin)
        process.stdin.close()
        assert process.wait() == 0


def resources():
    return [run(real, *args).stdout for args in [('ps', '-aq', '--no-trunc'), ('network', 'ls', '-q', '--no-trunc'), ('volume', 'ls', '-q')]]


load()
before_image = json.loads(run(real, 'image', 'inspect', app).stdout)[0]
run(real, 'build', '-q', '-t', bad_tag, '-', input=f'FROM {app}\nENV R6_TEST_SECRET={marker}\n'.encode())
after_image = json.loads(run(real, 'image', 'inspect', bad_tag).stdout)[0]
assert before_image['Os'] == after_image['Os'] and before_image['Architecture'] == after_image['Architecture']
assert before_image['RootFS'] == after_image['RootFS']
assert before_image['Config']['Labels']['org.opencontainers.image.revision'] == after_image['Config']['Labels']['org.opencontainers.image.revision']
before = resources()
fake = work/'proof-bin'
fake.mkdir()
wrapper = fake/'docker'
wrapper.write_text('#!/usr/bin/env python3\nimport subprocess,sys\na=sys.argv[1:]\nr=subprocess.run(["'+real+'"]+a)\nif r.returncode: sys.exit(r.returncode)\nif a[:2]==["image","load"]:\n sys.exit(subprocess.run(["'+real+'","image","tag","'+bad_tag+'","'+app+'"]).returncode)\n')
wrapper.chmod(0o700)
root = work/'rejected-loaded-proof'
env = {**os.environ, 'PATH': str(fake)+':'+os.environ['PATH']}
try:
    rejected = run('bash', str(bundle/'chm.sh'), 'install', str(root), str(work/'config.env'), env=env, ok=False)
    assert rejected.returncode != 0 and b'type=config_sha256' in rejected.stderr
    assert marker.encode() not in rejected.stdout+rejected.stderr
    assert not root.exists() and resources() == before
finally:
    load()
    run(real, 'image', 'rm', bad_tag)
# A corrupted kit fails checksums without import or persistent resources.
corrupt = work/'corrupt-kit'
corrupt.mkdir()
for item in bundle.iterdir():
    if item.is_file():
        if item.name == 'images.tar.gz':
            (corrupt/item.name).symlink_to(item)
        else:
            shutil.copyfile(item, corrupt/item.name)
with (corrupt/'manifest.json').open('a') as f:
    f.write('\n')
root = work/'rejected-corrupt-kit'
rejected = run('bash', str(corrupt/'chm.sh'), 'install', str(root), str(work/'config.env'), ok=False)
assert rejected.returncode != 0 and b'bundle checksum mismatch' in rejected.stderr
assert not root.exists() and resources() == before
print('R6 negatives passed: same tag/platform/revision/rootfs with substituted runtime config rejected before ROOT/data/edge/app; corrupted kit rejected; no credential values printed.')
