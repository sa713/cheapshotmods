#!/usr/bin/env bash
# Owner-operated Debian update. Run as root; no sudo, gh, build or proxy changes.
set +x
set -euo pipefail
umask 077
[[ $(id -u) == 0 ]] || { echo 'Run this command as root.' >&2; exit 1; }
test -r /root/.config/cheapshotmods/github.curl
test -f /opt/cheapshotmods/current.env
python3 -I - <<'PY_GUARD'
from pathlib import Path
v = dict(line.split('=', 1) for line in Path('/opt/cheapshotmods/current.env').read_text().splitlines())
assert v['CHM_VERSION'] in {'fbe82aef6008d292515c0efce2fde601c221f3d2','19a6fdde785eb90b01bd78318deeab1a539dde7b','6dc8021e58daa9aa16a93a9265315bb810fe9d0a'}, 'Unexpected installed version; stop'
assert v['CHM_PROXY_MODE'] == 'external', 'Unexpected proxy mode; stop'
PY_GUARD
CHM_SHA=feb6a1bf82e70474c482c6a2e1fb0e77c4e20586
CHM_DOWNLOAD=$(mktemp -d /root/cheapshotmods-task005-XXXXXX)
printf 'Kit directory: %s\n' "$CHM_DOWNLOAD"
cd "$CHM_DOWNLOAD"
curl --disable --config /root/.config/cheapshotmods/github.curl \
  --fail --silent --show-error --location --output kit.zip \
  https://api.github.com/repos/sa713/cheapshotmods/actions/artifacts/13624905831/zip
printf '%s  kit.zip\n' 0d7f1c83d417cb362c345b8ab32431362377128c87fad3cfe63431293a333731 | sha256sum --check -
python3 -m zipfile -e kit.zip .
printf '%s  cheapshotmods-%s-linux-amd64.tar.gz\n' 30d5703a59ee734b5094291bf2ae83e4b46fb5039614753309f13a7037909e50 "$CHM_SHA" | sha256sum --check -
tar --no-same-owner -xzf "cheapshotmods-$CHM_SHA-linux-amd64.tar.gz"
cd "cheapshotmods-$CHM_SHA-linux-amd64"
sha256sum --check SHA256SUMS
# Remove only these verified transport duplicates. Keep the complete extracted kit.
rm -- ../kit.zip "../cheapshotmods-$CHM_SHA-linux-amd64.tar.gz"
cp /opt/cheapshotmods/current.env "$CHM_DOWNLOAD/before-update.env"
sha256sum /opt/cheapshotmods/config.env > "$CHM_DOWNLOAD/preserved.sha256"
if [[ -f /opt/cheapshotmods/ingress-b008807.py ]]; then
  sha256sum /opt/cheapshotmods/ingress-b008807.py >> "$CHM_DOWNLOAD/preserved.sha256"
fi
CHM_BACKUP=$(bash /opt/cheapshotmods/chm.sh backup /opt/cheapshotmods)
printf '%s\n' "$CHM_BACKUP" > "$CHM_DOWNLOAD/pre-update-backup.path"
printf 'Pre-update backup: %s\n' "$CHM_BACKUP"
bash ./chm.sh update /opt/cheapshotmods "$PWD"
bash /opt/cheapshotmods/chm.sh check /opt/cheapshotmods
sha256sum --check "$CHM_DOWNLOAD/preserved.sha256"
printf 'Updated: %s\nReload the website/Mini App completely.\n' "$CHM_SHA"
