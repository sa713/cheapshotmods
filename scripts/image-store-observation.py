"""Safe evidence from a real selected Docker daemon; no config/env dump."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

bundle, output = map(Path, sys.argv[1:3])
mode = sys.argv[3]
m = json.loads((bundle/'manifest.json').read_text())
info = json.loads(subprocess.check_output(['docker', 'info', '--format', '{{json .}}']))
containerd = ['driver-type', 'io.containerd.snapshotter.v1'] in (info.get('DriverStatus') or [])
assert containerd == (mode == 'containerd')
assert info['ServerVersion'].startswith('29.')
result = {'mode': mode, 'server': info['ServerVersion'], 'driver': info['Driver'], 'driver_status': info['DriverStatus'],
          'images_archive_sha256': hashlib.file_digest((bundle/'images.tar.gz').open('rb'), 'sha256').hexdigest(), 'images': {}}
for role in ('app', 'proxy'):
    item = json.loads(subprocess.check_output(['docker', 'image', 'inspect', m[role+'_image']]))[0]
    proof = m['image_proofs'][role]
    assert item['Os']+'/'+item['Architecture'] == proof['platform']
    assert item['RootFS']['Layers'] == proof['diff_ids']
    # This is the exact old predicate, observed on real stores for one archive.
    assert (item['Id'] == proof['config_digest']) == (mode == 'classic')
    result['images'][role] = {'native_id': item['Id'], 'config_digest': proof['config_digest'], 'diff_ids': proof['diff_ids'], 'platform': proof['platform']}
output.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, sort_keys=True))
