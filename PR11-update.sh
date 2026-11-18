#!/usr/bin/env bash
# Owner-operated bootstrap; the verified Python helper performs all host checks.
set +x
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
CHM_OPERATION=${1:-update}
case "$CHM_OPERATION" in fetch|preflight|prepare|update|check|rollback) ;; *) echo 'Unknown operation.' >&2; exit 2;; esac
CHM_OPERATOR=/root/cheapshotmods-pr11-c720d3b96c04.py
if [[ ! -e "$CHM_OPERATOR" && ! -L "$CHM_OPERATOR" ]]; then
  python3 -I - <<'PY_CREDENTIAL'
from pathlib import Path
import stat
p=Path('/root/.config/cheapshotmods/github.curl')
assert not p.is_symlink() and p.is_file() and p.stat().st_uid==0 and stat.S_IMODE(p.stat().st_mode)==0o600, 'Existing root-owned0600 GitHub curl credential required'
PY_CREDENTIAL
  CHM_BOOTSTRAP_TEMP=$(mktemp -d /root/cheapshotmods-pr11-command-XXXXXX)
  trap 'rm -rf -- "$CHM_BOOTSTRAP_TEMP"' EXIT
  curl --disable --config /root/.config/cheapshotmods/github.curl \
    --fail --silent --show-error --location --connect-timeout 15 --max-time 60 --max-filesize 65536 \
    --output "$CHM_BOOTSTRAP_TEMP/operator.json" \
    https://api.github.com/repos/sa713/cheapshotmods/git/blobs/472f7c43c23c2b60121d9d8f19b67b2fa0e9cd4d
  python3 -I - "$CHM_BOOTSTRAP_TEMP/operator.json" "$CHM_OPERATOR" <<'PY_FETCH'
import base64,hashlib,json,os,sys
from pathlib import Path
value=json.loads(Path(sys.argv[1]).read_text())
assert value['encoding']=='base64'
data=base64.b64decode(''.join(value['content'].split()),validate=True)
assert len(data)==17706 and hashlib.sha256(data).hexdigest()=='c720d3b96c04a6c88dac09e5753a550f9b03a6a5b0a19deacf196b99efddeb0e', 'Operator checksum mismatch'
with os.fdopen(os.open(sys.argv[2],os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600),'wb') as output: output.write(data)
PY_FETCH
fi
python3 -I - "$CHM_OPERATOR" <<'PY_VERIFY'
from pathlib import Path
import hashlib,stat,sys
p=Path(sys.argv[1]);assert not p.is_symlink() and p.is_file() and p.stat().st_uid==0 and stat.S_IMODE(p.stat().st_mode)==0o600, 'Unexpected local operator file'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='c720d3b96c04a6c88dac09e5753a550f9b03a6a5b0a19deacf196b99efddeb0e', 'Local operator checksum mismatch; stop without overwriting'
PY_VERIFY
printf 'Verified operator: %s\n' "$CHM_OPERATOR"
if [[ "$CHM_OPERATION" != fetch ]]; then python3 -I "$CHM_OPERATOR" "$CHM_OPERATION"; fi
