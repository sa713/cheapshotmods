#!/usr/bin/env bash
# CI-only: immutable predecessors in this private repository, then real Debian installer.
set -euo pipefail
[[ $# == 2 ]] || { echo 'Usage: test-task008-upgrades.sh NEW_KIT EVIDENCE_DIR' >&2; exit 2; }
kit=$(realpath "$1")
evidence=$(realpath -m "$2")
mkdir -p "$evidence"
work=$(mktemp -d /tmp/chm008-predecessors-XXXXXX)
trap 'rm -rf "$work"' EXIT
while read -r sha artifact ziphash; do
  gh api "repos/sa713/cheapshotmods/actions/artifacts/$artifact/zip" > "$work/kit.zip"
  printf '%s  %s\n' "$ziphash" "$work/kit.zip" | sha256sum --check -
  python3 -m zipfile -e "$work/kit.zip" "$work"
  (cd "$work"; sha256sum --check "cheapshotmods-$sha-linux-amd64.tar.gz.sha256")
  tar -xzf "$work/cheapshotmods-$sha-linux-amd64.tar.gz" -C "$work"
  (cd "$work/cheapshotmods-$sha-linux-amd64"; sha256sum --check SHA256SUMS)
  rm "$work/kit.zip" "$work/cheapshotmods-$sha-linux-amd64.tar.gz" "$work/cheapshotmods-$sha-linux-amd64.tar.gz.sha256"
  bash scripts/task008-upgrade/run.sh "$kit" "$work/cheapshotmods-$sha-linux-amd64" "$evidence/$sha"
  rm -rf "$work/cheapshotmods-$sha-linux-amd64"
done <<'PREDECESSORS'
f944acb6435a9671cef6db5fc500b79a71d21133 13631764817 225cf1d60f0f179c18fcc7a776c98deff32448dd2f5fe74601ff6e354f4613eb
d6cb0e9404f07b5573b64131281d29569a010442 13628229576 ee1b0eb98d48d46de6ee94e33eda5aa1d4a93e1aa1f23ab7817bfe90e2c521d7
feb6a1bf82e70474c482c6a2e1fb0e77c4e20586 13624905831 0d7f1c83d417cb362c345b8ab32431362377128c87fad3cfe63431293a333731
fbe82aef6008d292515c0efce2fde601c221f3d2 13522083303 fb78a81f5df989c361390c227008916c239b5ad41a5535515cfe1f0581cec062
19a6fdde785eb90b01bd78318deeab1a539dde7b 13579575081 f899a858085731b4831ca631a12b7aad35256f57efff0c49eef3539287b509f2
6dc8021e58daa9aa16a93a9265315bb810fe9d0a 13583903966 b29d9ba8fe17c2c1c2e85a6fc1a385b5cd965b367e240931aadd2a50976af740
PREDECESSORS
