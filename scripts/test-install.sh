#!/usr/bin/env bash
set -euo pipefail
# Disposable Debian host analogue. No external host/domain/Telegram, no global prune.
[[ $# == 1 ]] || { echo 'Usage: scripts/test-install.sh EXTRACTED_BUNDLE_DIR' >&2; exit 2; }
bundle="$(realpath "$1")"
work="$(mktemp -d /tmp/chm-install-test-XXXXXX)"
container="chm-kit-test-$(openssl rand -hex 6)"
root="$work/installation"
project="chm-$(printf '%s' "$root" | sha256sum | cut -c1-12)"
fixture_sha="$(printf '%s' "$container" | sha256sum | cut -c1-40)"
fixture_image="cheapshotmods:$fixture_sha"
sentinel="$container-foreign-volume"
cleanup() {
  docker exec "$container" chown -R "$(id -u):$(id -g)" "$work" >/dev/null 2>&1 || true
  docker rm -f "$container" >/dev/null 2>&1 || true
  mapfile -t owned < <(docker ps -aq --filter "label=com.docker.compose.project=$project")
  if [[ ${#owned[@]} -gt 0 ]]; then docker rm -f "${owned[@]}" >/dev/null 2>&1 || true; fi
  mapfile -t networks < <(docker network ls -q --filter "label=com.docker.compose.project=$project")
  if [[ ${#networks[@]} -gt 0 ]]; then docker network rm "${networks[@]}" >/dev/null 2>&1 || true; fi
  mapfile -t volumes < <(docker volume ls -q --filter "label=cheapshotmods.root=$project")
  mapfile -t proxy_volumes < <(docker volume ls -q --filter "label=com.docker.compose.project=$project")
  if [[ ${#volumes[@]} -gt 0 ]]; then docker volume rm "${volumes[@]}" >/dev/null 2>&1 || true; fi
  if [[ ${#proxy_volumes[@]} -gt 0 ]]; then docker volume rm "${proxy_volumes[@]}" >/dev/null 2>&1 || true; fi
  docker volume rm "$sentinel" >/dev/null 2>&1 || true
  docker image rm "$fixture_image" >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work/fake-bin"
cat > "$work/fake-bin/uname" <<'SH'
#!/bin/sh
case "$1" in -m) echo aarch64;; -s) echo Linux;; *) /usr/bin/uname "$@";; esac
SH
chmod +x "$work/fake-bin/uname"
printf 'ID=alpine\nVERSION_ID=3.22\n' > "$work/unsupported-os"
# Select two currently free local TCP ports; installer independently checks them.
read -r http_port https_port < <(python3 - <<'PY'
import socket
with socket.socket() as a,socket.socket() as b:
    a.bind(('127.0.0.1',0)); b.bind(('127.0.0.1',0)); print(a.getsockname()[1],b.getsockname()[1])
PY
)
cat > "$work/config.env" <<CONFIG
PUBLIC_BASE_URL=https://localhost:$https_port
SESSION_SECRET=
TELEGRAM_BOT_TOKEN=
TELEGRAM_OIDC_CLIENT_ID=
TELEGRAM_OIDC_CLIENT_SECRET=
CHM_HTTP_PORT=$http_port
CHM_HTTPS_PORT=$https_port
CHM_BIND_ADDRESS=127.0.0.1
CADDY_EMAIL=
CONFIG
chmod 600 "$work/config.env"
docker volume create "$sentinel" >/dev/null
cli="$(command -v docker)"
plugin="$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "compose"}}{{.Path}}{{end}}{{end}}')"
[[ -f "$plugin" ]] || { echo 'Cannot locate compose plugin' >&2; exit 1; }
mounts=(--mount "type=bind,source=$work,target=$work" --mount "type=bind,source=$bundle,target=$bundle,readonly" --mount "type=bind,source=$cli,target=/usr/local/bin/docker,readonly" --mount "type=bind,source=$plugin,target=/usr/libexec/docker/cli-plugins/docker-compose,readonly" --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock)
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then mounts+=(--mount "type=bind,source=$CODEX_PROXY_CERT,target=/usr/local/share/ca-certificates/chm-session-proxy.crt,readonly"); fi
docker run -d --name "$container" --network host "${mounts[@]}" -e HTTP_PROXY -e HTTPS_PROXY -e NO_PROXY -e http_proxy -e https_proxy -e no_proxy debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 sleep infinity >/dev/null
docker exec "$container" bash -c 'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl openssl python3 iproute2 >/dev/null && update-ca-certificates >/dev/null'
inside() {
  local status=0
  docker exec "$container" bash "$bundle/chm.sh" "$@" || status=$?
  # The Debian analogue runs as root; return only harness files to its caller.
  # Actual installed config/backup permissions remain 0600.
  docker exec "$container" chown -R "$(id -u):$(id -g)" "$work"
  return "$status"
}
# Unsupported arch and foreign OS stop before ROOT creation or Docker mutations.
if docker exec -e "PATH=$work/fake-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$container" bash "$bundle/chm.sh" install "$work/rejected-arch" "$work/config.env" --internal-tls; then echo 'Unsupported arch accepted' >&2; exit 1; fi
[[ ! -e "$work/rejected-arch" ]]
docker exec "$container" bash -c 'cp /etc/os-release "$1/os-release.saved"; cp "$1/unsupported-os" /etc/os-release' _ "$work"
if inside install "$work/rejected-os" "$work/config.env" --internal-tls; then echo 'Unsupported OS accepted' >&2; exit 1; fi
[[ ! -e "$work/rejected-os" ]]
docker exec "$container" cp "$work/os-release.saved" /etc/os-release
chmod 644 "$work/config.env"
if inside install "$work/rejected-mode" "$work/config.env" --internal-tls; then echo 'Public secrets file accepted' >&2; exit 1; fi
[[ ! -e "$work/rejected-mode" ]]
chmod 600 "$work/config.env"
inside install "$root" "$work/config.env" --internal-tls
[[ "$(stat -c %a "$root/config.env")" == 600 ]]
# No secret text is printed: verify generated session secret only as a boolean.
python3 - "$root/config.env" <<'PY'
import sys
values=dict(line.rstrip('\n').split('=',1) for line in open(sys.argv[1]) if line.strip() and not line.startswith('#'))
assert len(values['SESSION_SECRET'])==64
PY
proxy="$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=proxy)"
app="$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=app)"
for attempt in {1..40}; do
  if docker cp "$proxy:/data/caddy/pki/authorities/local/root.crt" "$work/internal-ca.crt" >/dev/null 2>&1; then break; fi
  sleep 1
done
inside check "$root" "$work/internal-ca.crt"
if inside install "$work/rejected-port" "$work/config.env" --internal-tls; then echo 'Occupied port accepted' >&2; exit 1; fi
[[ ! -e "$work/rejected-port" ]]
# Genuine better-sqlite3 and rules through a separate process, not a seed endpoint.
docker exec -i "$app" node --input-type=module > "$work/expected.json" <<'JS'
import {Store} from './apps/server/dist/store.js'; import {randomUUID} from 'node:crypto';
const s=new Store('/data/cheapshot.sqlite');const owner='744002';
const command=action=>{const state=s.summary(owner);return s.command(owner,{key:randomUUID(),revision:state.revision,experiment:state.experiment,action});};
const id=command({type:'original.put',kind:'🅾',tier:1,value:'10',quantity:'1000000'}).createdId;
command({type:'level',value:'9007199254740993'});command({type:'equip',items:[{id,quantity:'3'}]});command({type:'craft',items:[{id,quantity:'3',worn:'3'}]});
console.log(JSON.stringify({state:s.summary(owner),original:s.inventory(owner,'original'),work:s.inventory(owner,'work')}));s.close();
JS
snapshot() {
  app="$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter label=com.docker.compose.service=app)"
  docker exec "$app" node --input-type=module -e 'import {Store} from "./apps/server/dist/store.js";const s=new Store("/data/cheapshot.sqlite");console.log(JSON.stringify({state:s.summary("744002"),original:s.inventory("744002","original"),work:s.inventory("744002","work")}));s.close();'
}
inside restart "$root"
snapshot > "$work/actual.json"; cmp "$work/expected.json" "$work/actual.json"
backup_file="$(inside backup "$root")"
[[ -f "$backup_file" && "$(stat -c %a "$backup_file")" == 600 ]]
docker exec "$app" node --input-type=module -e 'import {Store} from "./apps/server/dist/store.js";import {randomUUID} from "node:crypto";const s=new Store("/data/cheapshot.sqlite");const p=s.summary("744002");s.command("744002",{key:randomUUID(),revision:p.revision,experiment:p.experiment,action:{type:"level",value:"2000"}});s.close();'
snapshot > "$work/changed.json"
inside restore "$root" "$backup_file"
snapshot > "$work/actual.json"; cmp "$work/expected.json" "$work/actual.json"
inside check "$root" "$work/internal-ca.crt"
inside rollback "$root"
snapshot > "$work/actual.json"; cmp "$work/changed.json" "$work/actual.json"
# Create an explicitly synthetic second image/version only to exercise update.
# It is never uploaded and is not represented as a second source release.
mapfile -t images < <(python3 - "$bundle/manifest.json" <<'PY'
import json,sys
m=json.load(open(sys.argv[1]));print(m['app_image']);print(m['proxy_image'])
PY
)
mkdir "$work/update-bundle"
cp "$bundle/"{chm.sh,compose.yml,Caddyfile,Caddyfile.internal,env.example,README.md} "$work/update-bundle/"
printf 'FROM %s\nENV BUILD_SHA=%s\nLABEL org.opencontainers.image.revision=%s\n' "${images[0]}" "$fixture_sha" "$fixture_sha" > "$work/Dockerfile"
docker build -q -t "$fixture_image" - < "$work/Dockerfile" >/dev/null
docker image save "$fixture_image" "${images[1]}" | gzip -1 > "$work/update-bundle/images.tar.gz"
fixture_id="$(docker image inspect --format '{{.Id}}' "$fixture_image")"
python3 - "$bundle/manifest.json" "$work/update-bundle/manifest.json" "$fixture_sha" "$fixture_image" "$fixture_id" <<'PY'
import json,sys
m=json.load(open(sys.argv[1]));m.update(source_sha=sys.argv[3],app_image=sys.argv[4],app_image_id=sys.argv[5],test_fixture=True)
json.dump(m,open(sys.argv[2],'w'),indent=2)
PY
(cd "$work/update-bundle"; sha256sum chm.sh compose.yml Caddyfile Caddyfile.internal env.example README.md manifest.json images.tar.gz > SHA256SUMS)
# A failed offline helper after freeze must recover the old image+volume.
mkdir "$work/failure-bin"
cat > "$work/failure-bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == create && "$*" == *-offline-backup-* ]]; then exit 17; fi
exec /usr/local/bin/docker "$@"
SH
chmod +x "$work/failure-bin/docker"
failed_status=0
docker exec -e "PATH=$work/failure-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" "$container" bash "$bundle/chm.sh" update "$root" "$work/update-bundle" || failed_status=$?
docker exec "$container" chown -R "$(id -u):$(id -g)" "$work"
[[ "$failed_status" == 17 ]]
inside check "$root" "$work/internal-ca.crt"
snapshot > "$work/actual.json"; cmp "$work/changed.json" "$work/actual.json"
# Regression: a command commits at the last possible point before app freeze.
# Only this harness wraps Docker; the production installer has no fixture hooks.
mkdir "$work/boundary-bin"
cat > "$work/boundary-bin/docker" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [[ "$#" -ge 2 && "${@: -2:1}" == stop && "${@: -1}" == app ]]; then
  /usr/local/bin/docker exec "$CHM_BOUNDARY_APP" node --input-type=module -e 'import {Store} from "./apps/server/dist/store.js";import {randomUUID} from "node:crypto";const s=new Store("/data/cheapshot.sqlite");const p=s.summary("744002");s.command("744002",{key:randomUUID(),revision:p.revision,experiment:p.experiment,action:{type:"level",value:"2001"}});console.log(JSON.stringify({state:s.summary("744002"),original:s.inventory("744002","original"),work:s.inventory("744002","work")}));s.close();' > "$CHM_BOUNDARY_OUT"
fi
exec /usr/local/bin/docker "$@"
SH
chmod +x "$work/boundary-bin/docker"
docker exec -e "PATH=$work/boundary-bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" -e "CHM_BOUNDARY_APP=$app" -e "CHM_BOUNDARY_OUT=$work/boundary-expected.json" "$container" bash "$bundle/chm.sh" update "$root" "$work/update-bundle"
docker exec "$container" chown -R "$(id -u):$(id -g)" "$work"
[[ -s "$work/boundary-expected.json" ]]
snapshot > "$work/actual.json"; cmp "$work/boundary-expected.json" "$work/actual.json"
inside check "$root" "$work/internal-ca.crt"
inside rollback "$root"
snapshot > "$work/actual.json"; cmp "$work/boundary-expected.json" "$work/actual.json"
inside check "$root" "$work/internal-ca.crt"
docker volume inspect "$sentinel" >/dev/null
# Undo history from the original candidate survives restart/backup/restore/update.
docker exec "$app" node --input-type=module -e 'import {Store} from "./apps/server/dist/store.js";import {randomUUID} from "node:crypto";const s=new Store("/data/cheapshot.sqlite");const p=s.summary("744002");const r=s.command("744002",{key:randomUUID(),revision:p.revision,experiment:p.experiment,action:{type:"undo"}});if(r.spent!=="0"||r.level!=="2001"||r.equipment[0].quantity!=="3")throw Error("undo state");s.close();'
docker exec "$container" bash -c '. /etc/os-release; printf "Installation test passed: Debian %s, %s; internal HTTPS, native SQLite, restart, backup/restore, synthetic update with last-commit freeze regression, rollback, foreign volume retained.\n" "$VERSION_ID" "$(uname -m)"'
