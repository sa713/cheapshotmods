#!/usr/bin/env bash
set -euo pipefail
# Builds only the checked-out source. No registry upload or deployment.
cd "$(dirname "$0")/.."
sha="${BUILD_SHA:-$(git rev-parse HEAD)}"
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo 'BUILD_SHA must be a full Git SHA' >&2; exit 1; }
[[ "$sha" == "$(git rev-parse HEAD)" ]] || { echo 'BUILD_SHA differs from checkout' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=no)" ]] || { echo 'Commit tracked changes before bundling' >&2; exit 1; }
[[ "$(docker info --format '{{.OSType}}/{{.Architecture}}')" == 'linux/x86_64' ]] || { echo 'Only Linux amd64 bundles are supported' >&2; exit 1; }
output="${1:-artifacts}"
mkdir -p "$output"
output="$(realpath "$output")"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
name="cheapshotmods-$sha-linux-amd64"
kit="$work/$name"
mkdir "$kit" "$work/source"
git archive "$sha" | tar -x -C "$work/source"
cp "$work/source/deploy/"{chm.sh,compose.yml,Caddyfile,Caddyfile.internal,env.example,README.md} "$kit/"
image="cheapshotmods:$sha"
# Version is fixed; the downloaded manifest digest and exact image IDs are recorded.
proxy='caddy:2.10.2-alpine'
proxy_digest='caddy@sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d'
args=()
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then args+=(--secret "id=proxy_ca,src=$CODEX_PROXY_CERT"); fi
docker build "${args[@]}" --build-arg "BUILD_SHA=$sha" --tag "$image" "$work/source"
docker pull --platform linux/amd64 "$proxy@${proxy_digest#*@}"
docker image tag "$proxy@${proxy_digest#*@}" "$proxy"
app_id="$(docker image inspect --format '{{.Id}}' "$image")"
proxy_id="$(docker image inspect --format '{{.Id}}' "$proxy")"
[[ "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$proxy")" == linux/amd64 ]]
docker image save "$image" "$proxy" | gzip -1 > "$kit/images.tar.gz"
python3 - "$kit/manifest.json" "$sha" "$image" "$app_id" "$proxy" "$proxy_id" "$proxy_digest" "$work/source/Dockerfile" <<'PY'
import json,sys
path,sha,image,app_id,proxy,proxy_id,digest,dockerfile=sys.argv[1:]
bases=[line.split()[1] for line in open(dockerfile) if line.startswith("FROM ")]
with open(path,'w') as out:
    json.dump({'format':1,'source_sha':sha,'platform':'linux/amd64','app_image':image,'app_image_id':app_id,'proxy_image':proxy,'proxy_image_id':proxy_id,'proxy_manifest_digest':digest,'node':'24.22.1','npm':'11.9.0','base_images':bases},out,indent=2)
    out.write('\n')
PY
(cd "$kit"; sha256sum chm.sh compose.yml Caddyfile Caddyfile.internal env.example README.md manifest.json images.tar.gz > SHA256SUMS)
tar -C "$work" -czf "$output/$name.tar.gz" "$name"
(cd "$output"; sha256sum "$name.tar.gz" > "$name.tar.gz.sha256")
echo "$output/$name.tar.gz"
