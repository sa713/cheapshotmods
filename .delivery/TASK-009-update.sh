#!/usr/bin/env bash
# Owner-operated bootstrap; the verified Python helper performs all host checks.
set +x
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
CHM_OPERATION=${1:-update}
case "$CHM_OPERATION" in fetch|preflight|prepare|update|check|rollback) ;; *) echo 'Unknown operation.' >&2; exit 2;; esac
CHM_OPERATOR=/root/cheapshotmods-task009-89d1f3296b0c.py
if [[ ! -e "$CHM_OPERATOR" && ! -L "$CHM_OPERATOR" ]]; then
  python3 -I - <<'PY_CREDENTIAL'
from pathlib import Path
import stat
p=Path('/root/.config/cheapshotmods/github.curl')
assert not p.is_symlink() and p.is_file() and p.stat().st_uid==0 and stat.S_IMODE(p.stat().st_mode)==0o600, 'Existing root-owned0600 GitHub curl credential required'
PY_CREDENTIAL
  CHM_BOOTSTRAP_TEMP=$(mktemp -d /root/cheapshotmods-task009-command-XXXXXX)
  trap 'rm -rf -- "$CHM_BOOTSTRAP_TEMP"' EXIT
  curl --disable --config /root/.config/cheapshotmods/github.curl \
    --fail --silent --show-error --location --connect-timeout 15 --max-time 60 --max-filesize 65536 \
    --output "$CHM_BOOTSTRAP_TEMP/operator.json" \
    https://api.github.com/repos/sa713/cheapshotmods/git/blobs/c3828438fab992b6cd84b5ddf7392a358a378349
  python3 -I - "$CHM_BOOTSTRAP_TEMP/operator.json" "$CHM_OPERATOR" <<'PY_FETCH'
import base64,hashlib,json,os,sys
from pathlib import Path
value=json.loads(Path(sys.argv[1]).read_text())
assert value['encoding']=='base64'
data=base64.b64decode(''.join(value['content'].split()),validate=True)
assert len(data)==17659 and hashlib.sha256(data).hexdigest()=='89d1f3296b0cb0cf61c44ea3be6422e2a7efa5b14f8d31bcb8a1a4d9af2aa69e', 'Operator checksum mismatch'
with os.fdopen(os.open(sys.argv[2],os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as output: output.write(data)
PY_FETCH
fi
python3 -I - "$CHM_OPERATOR" <<'PY_VERIFY'
from pathlib import Path
import hashlib,stat,sys
p=Path(sys.argv[1]);assert not p.is_symlink() and p.is_file() and p.stat().st_uid==0 and stat.S_IMODE(p.stat().st_mode)==0o600, 'Unexpected local operator file'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='89d1f3296b0cb0cf61c44ea3be6422e2a7efa5b14f8d31bcb8a1a4d9af2aa69e', 'Local operator checksum mismatch; stop without overwriting'
PY_VERIFY
printf 'Verified operator: %s\n' "$CHM_OPERATOR"
if [[ "$CHM_OPERATION" != fetch ]]; then python3 -I "$CHM_OPERATOR" "$CHM_OPERATION"; fi
