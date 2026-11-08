#!/usr/bin/env bash
# Restore only the previous image+volume pair. Never attach an old image to schema5.
set +x
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run this command as root.' >&2; exit 1; }
python3 -I - <<'PY_GUARD'
from pathlib import Path
root = Path('/opt/cheapshotmods')
def metadata(name):
    return dict(line.split('=', 1) for line in (root / name).read_text().splitlines())
current, previous = metadata('current.env'), metadata('previous.env')
assert current['CHM_VERSION'] == 'd6cb0e9404f07b5573b64131281d29569a010442', 'Unexpected current version; stop'
assert previous['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a','feb6a1bf82e70474c482c6a2e1fb0e77c4e20586'}, 'Unexpected rollback target; stop'
assert current['CHM_PROXY_MODE'] == previous['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
print('Rollback target:', previous['CHM_VERSION'])
PY_GUARD
bash /opt/cheapshotmods/chm.sh rollback /opt/cheapshotmods
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
