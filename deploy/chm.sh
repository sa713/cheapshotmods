#!/usr/bin/env bash
set -euo pipefail
umask 077
fail() { echo "Cheapshot Mods: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null || fail "missing dependency: $1"; }
usage() { echo 'Usage: bash chm.sh install ROOT CONFIG [--internal-tls] | update ROOT BUNDLE_DIR | start|restart|stop|check|backup|rollback ROOT | restore ROOT BACKUP [CA_FILE for check only]'; exit 2; }
[[ $# -ge 2 ]] || usage
command_name="$1"
root="$2"
[[ "$root" =~ ^/[a-zA-Z0-9_./-]+$ && "$root" != '/' && "$root" != *'/../'* && "$root" != */.. ]] || fail 'ROOT must be an absolute path without spaces, symlinks or ..'
[[ ! -L "$root" ]] || fail 'ROOT must not be a symlink'
bundle="$(cd "$(dirname "$0")" && pwd -P)"
for dependency in python3 docker openssl sha256sum df ss stat curl tar gzip realpath; do need "$dependency"; done
[[ "$root" == "$(realpath -m "$root")" ]] || fail 'ROOT must be canonical and contain no symlink components'
platform_check() {
  [[ "$(uname -s)" == Linux && "$(uname -m)" == x86_64 ]] || fail 'supported host: Debian 12/13 Linux amd64 only; no changes made'
  # This file is controlled by the local OS, never a downloaded bundle/config.
  . /etc/os-release
  [[ "${ID:-}" == debian && ( "${VERSION_ID:-}" == 12 || "${VERSION_ID:-}" == 13 ) ]] || fail 'supported host: Debian 12/13 only; no changes made'
  local endpoint
  if [[ -n "${DOCKER_CONTEXT:-}" ]]; then
    endpoint="$(docker context inspect "$DOCKER_CONTEXT" --format '{{.Endpoints.docker.Host}}')"
  elif [[ -n "${DOCKER_HOST:-}" ]]; then endpoint="$DOCKER_HOST"
  else endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')"; fi
  [[ "$endpoint" == unix://* ]] || fail 'only a local Unix-socket Docker daemon is supported'
  docker info >/dev/null 2>&1 || fail 'Docker daemon unavailable; no changes made'
  docker version --format '{{.Server.Version}}' | python3 -c 'import sys; sys.exit(0 if int(sys.stdin.read().split(".")[0])>=24 else 1)' || fail 'Docker Engine >=24 required'
  [[ "$(docker info --format '{{.OSType}}/{{.Architecture}}')" == linux/x86_64 ]] || fail 'Docker daemon must be Linux amd64'
  docker compose version --short | python3 -c 'import re,sys; m=re.match(r"v?(\d+)\.(\d+)",sys.stdin.read()); sys.exit(0 if m and tuple(map(int,m.groups())) >= (2,30) else 1)' || fail 'Docker Compose >= 2.30 required (raw env support)'
}
config_check() {
  local file="$1"
  [[ -f "$file" && ! -L "$file" ]] || fail 'CONFIG must be a regular private file'
  local mode; mode="$(stat -c %a "$file")"
  (( (8#$mode & 077) == 0 )) || fail 'CONFIG permissions must be private: chmod 600 CONFIG'
  # Parse literal dotenv without executing input or interpolating secrets.
  local fields
  fields="$(python3 - "$file" "${tls_mode:-public}" <<'PY'
import sys,re,urllib.parse
values={}
allowed={'PUBLIC_BASE_URL','SESSION_SECRET','TELEGRAM_BOT_TOKEN','TELEGRAM_OIDC_CLIENT_ID','TELEGRAM_OIDC_CLIENT_SECRET','CHM_HTTP_PORT','CHM_HTTPS_PORT','CHM_BIND_ADDRESS','CADDY_EMAIL'}
try:
    for line in open(sys.argv[1]):
        line=line.rstrip('\n')
        if not line or line.startswith('#'): continue
        key,sep,value=line.partition('=')
        if not sep or key not in allowed or key in values or '\r' in value: raise ValueError()
        values[key]=value
    base=values.get('PUBLIC_BASE_URL','')
    url=urllib.parse.urlsplit(base)
    http=int(values.get('CHM_HTTP_PORT','80')); https=int(values.get('CHM_HTTPS_PORT','443'))
    host=url.hostname or ''
    if url.scheme!='https' or url.path or url.query or url.fragment or url.username or url.password or base!=base.strip(): raise ValueError()
    if not re.fullmatch(r'[A-Za-z0-9.-]+',host) or not 1<=http<=65535 or not 1<=https<=65535 or http==https or (url.port or 443)!=https: raise ValueError()
    canonical_origin='https://'+host+((':'+str(url.port)) if url.port not in (None,443) else '')
    if base!=canonical_origin: raise ValueError()
    bind=values.get('CHM_BIND_ADDRESS','0.0.0.0')
    if bind not in ('0.0.0.0','127.0.0.1'): raise ValueError()
    email=values.get('CADDY_EMAIL','')
    if sys.argv[2]=='public' and not re.fullmatch(r'[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+',email): raise ValueError()
    secret=values.get('SESSION_SECRET','')
    if secret and len(secret)<32: raise ValueError()
    if bool(values.get('TELEGRAM_OIDC_CLIENT_ID'))!=bool(values.get('TELEGRAM_OIDC_CLIENT_SECRET')): raise ValueError()
    print('\n'.join([base,host,email,str(http),str(https),bind]))
except (ValueError,OSError):
    sys.exit('Invalid CONFIG: use literal KEY=value, HTTPS origin, matching ports, private long session secret and complete OIDC pair; values suppressed')
PY
)" || fail 'CONFIG rejected before changes'
  mapfile -t config_fields <<< "$fields"
  base_url="${config_fields[0]}"; domain="${config_fields[1]}"; email="${config_fields[2]}"
  http_port="${config_fields[3]}"; https_port="${config_fields[4]}"; bind_address="${config_fields[5]}"
}
ports_check() {
  [[ -z "$(ss -H -ltn "( sport = :$http_port or sport = :$https_port )")" ]] || fail 'requested TCP ports are occupied; no changes made'
}
disk_check() {
  local parent="$root"
  while [[ ! -e "$parent" ]]; do parent="$(dirname "$parent")"; done
  [[ "$(df -Pk "$parent" | awk 'NR==2 {print $4}')" -ge 4194304 ]] || fail 'at least 4 GiB free disk required before changes'
  local docker_root; docker_root="$(docker info --format '{{.DockerRootDir}}')"
  if [[ -d "$docker_root" ]]; then
    [[ "$(df -Pk "$docker_root" | awk 'NR==2 {print $4}')" -ge 4194304 ]] || fail 'at least 4 GiB free Docker storage required before changes'
  fi
}
kit_check() {
  [[ -f "$bundle/SHA256SUMS" && -f "$bundle/manifest.json" ]] || fail 'run from an extracted versioned bundle'
  (cd "$bundle"; sha256sum --check --status SHA256SUMS) || fail 'bundle checksum mismatch'
  mapfile -t manifest_fields < <(python3 - "$bundle/manifest.json" <<'PY'
import json,sys,re
m=json.load(open(sys.argv[1]))
assert m['format']==1 and m['platform']=='linux/amd64' and re.fullmatch('[a-f0-9]{40}',m['source_sha'])
assert m['app_image']=='cheapshotmods:'+m['source_sha']
for key in ['source_sha','app_image','app_image_id','proxy_image','proxy_image_id']:
    value=m[key]; assert re.fullmatch('[A-Za-z0-9:._/@-]+',value); print(value)
PY
  )
  [[ ${#manifest_fields[@]} == 5 ]] || fail 'invalid manifest'
  version="${manifest_fields[0]}"; app_image="${manifest_fields[1]}"; app_id="${manifest_fields[2]}"
  proxy_image="${manifest_fields[3]}"; proxy_id="${manifest_fields[4]}"
}
load_images() {
  gzip -dc "$bundle/images.tar.gz" | docker image load >/dev/null
  [[ "$(docker image inspect --format '{{.Id}}' "$app_image")" == "$app_id" && "$(docker image inspect --format '{{.Id}}' "$proxy_image")" == "$proxy_id" ]] || fail 'loaded image IDs differ from manifest'
  [[ "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$app_image")" == linux/amd64 && "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' "$proxy_image")" == linux/amd64 ]] || fail 'loaded images must be Linux amd64'
  [[ "$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$app_image")" == "$version" ]] || fail 'image revision mismatch'
}
release_copy() {
  mkdir -p "$root/releases/$version"
  cp "$bundle/"{chm.sh,compose.yml,Caddyfile,Caddyfile.internal,env.example,README.md,manifest.json} "$root/releases/$version/"
  chmod -R go-rwx "$root/releases/$version"
}
write_metadata() {
  local caddy_file=Caddyfile
  [[ "$tls_mode" == internal ]] && caddy_file=Caddyfile.internal
  cat > "$root/current.env.new" <<META
CHM_VERSION=$version
CHM_APP_IMAGE=$app_image
CHM_PROXY_IMAGE=$proxy_image
CHM_PROJECT=$project
CHM_DATA_VOLUME=$data_volume
CHM_CONFIG_FILE=$root/config.env
CHM_DOMAIN=$domain
CADDY_EMAIL=$email
CHM_HTTP_PORT=$http_port
CHM_HTTPS_PORT=$https_port
CHM_BIND_ADDRESS=$bind_address
CHM_CADDYFILE=$root/releases/$version/$caddy_file
META
  mv "$root/current.env.new" "$root/current.env"
}
installed() {
  [[ -f "$root/.cheapshotmods" && -f "$root/current.env" ]] || fail 'not an installation created by this kit'
  # Generated metadata contains only validated paths/identifiers, never secrets.
  set -a; . "$root/current.env"; set +a
  tls_mode=public; [[ "$CHM_CADDYFILE" == *.internal ]] && tls_mode=internal
}
compose() { docker compose --project-name "$CHM_PROJECT" --env-file "$root/current.env" -f "$root/releases/$CHM_VERSION/compose.yml" "$@"; }
wait_app() {
  local attempt
  for attempt in {1..40}; do
    if compose exec -T app node -e 'Promise.all([fetch("http://localhost:3000/health"),fetch("http://localhost:3000/version").then(r=>r.json()),fetch("http://localhost:3000/api/state")]).then(([h,v,a])=>{if(!h.ok||v.version!==process.argv[1]||a.status!==401)process.exit(1)}).catch(()=>process.exit(1))' "$CHM_VERSION" >/dev/null 2>&1; then return; fi
    sleep 1
  done
  fail 'app did not become healthy; data volumes retained'
}
wait_proxy() {
  local attempt
  for attempt in {1..20}; do
    if compose exec -T proxy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then return; fi
    sleep 1
  done
  fail 'proxy configuration did not become valid/running; volumes retained'
}
backup() {
  local filename="backup-$CHM_VERSION-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 3).sqlite"
  compose exec -T app node -e 'require("fs").mkdirSync("/data/backups",{recursive:true,mode:0o700})'
  compose exec -T app node apps/server/dist/backup.js /data/cheapshot.sqlite "/data/backups/$filename" >/dev/null
  docker cp "$(compose ps -q app):/data/backups/$filename" "$root/backups/$filename" >/dev/null
  chmod 600 "$root/backups/$filename"
  compose exec -T app node -e 'require("fs").unlinkSync(process.argv[1])' "/data/backups/$filename"
  backup_file="$root/backups/$filename"
  echo "$backup_file"
}
offline_backup() {
  local filename="backup-$CHM_VERSION-$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 3).sqlite"
  update_helper="$CHM_PROJECT-offline-backup-$(openssl rand -hex 4)"
  docker create --name "$update_helper" --label "cheapshotmods.root=$CHM_PROJECT" --mount "source=$CHM_DATA_VOLUME,target=/data" "$CHM_APP_IMAGE" node apps/server/dist/backup.js /data/cheapshot.sqlite /tmp/backup.sqlite >/dev/null
  docker start --attach "$update_helper" >/dev/null
  [[ "$(docker inspect --format '{{.State.ExitCode}}' "$update_helper")" == 0 ]] || fail 'offline backup failed; previous volume retained'
  backup_file="$root/backups/$filename"
  docker cp "$update_helper:/tmp/backup.sqlite" "$backup_file" >/dev/null
  chmod 600 "$backup_file"
  docker rm "$update_helper" >/dev/null
  update_helper=''
  echo "$backup_file"
}
recover_update() {
  local status="$?"
  trap - EXIT
  if [[ "$status" != 0 ]]; then
    if [[ -n "${update_helper:-}" ]]; then docker rm -f "$update_helper" >/dev/null 2>&1 || true; fi
    cp "$root/update-before.env" "$root/current.env.new"
    mv "$root/current.env.new" "$root/current.env"
    installed
    if compose up -d --remove-orphans >/dev/null 2>&1; then
      echo 'Update failed; restart of previous image and unchanged volume requested. Run check; all candidate volumes retained.' >&2
    else
      echo 'Update failed; previous metadata restored. Run start/check using this installation; all volumes retained.' >&2
    fi
  fi
  exit "$status"
}
copy_backup_volume() {
  local source="$1" destination="$2" image="$3"
  [[ -f "$source" && ! -L "$source" ]] || fail 'BACKUP must be a regular file'
  source="$(realpath "$source")"
  [[ "$(stat -c %a "$source")" == 600 ]] || fail 'BACKUP must have mode 600'
  [[ -z "$(docker volume ls -q --filter "name=^${destination}$")" ]] || fail 'new volume already exists'
  docker volume create --label "cheapshotmods.root=$project" "$destination" >/dev/null
  docker run --rm --user 0 --mount "source=$destination,target=/data" --mount "type=bind,source=$source,target=/restore.sqlite,readonly" "$image" node --input-type=module -e 'import fs from "node:fs"; import {Store} from "./apps/server/dist/store.js"; fs.copyFileSync("/restore.sqlite","/data/cheapshot.sqlite",fs.constants.COPYFILE_EXCL); fs.chmodSync("/data/cheapshot.sqlite",0o600); const s=new Store("/data/cheapshot.sqlite"); if(s.db.pragma("integrity_check",{simple:true})!=="ok")throw Error("invalid backup"); s.close(); for(const p of fs.readdirSync("/data"))fs.chownSync("/data/"+p,1000,1000); fs.chownSync("/data",1000,1000);' >/dev/null
}
switch_up() {
  installed
  compose up -d --remove-orphans >/dev/null
  wait_app
  wait_proxy
  cp "$root/releases/$CHM_VERSION/chm.sh" "$root/chm.sh.new"
  mv "$root/chm.sh.new" "$root/chm.sh"
  echo "Running candidate $CHM_VERSION; run check after DNS/TLS configuration."
}
platform_check
case "$command_name" in
  install)
    [[ $# -eq 3 || ( $# -eq 4 && "$4" == --internal-tls ) ]] || usage
    tls_mode=public; [[ "${4:-}" == --internal-tls ]] && tls_mode=internal
    [[ ! -e "$root" ]] || fail 'ROOT already exists; use update/restart, never overwrite an existing installation'
    config_check "$3"; ports_check; disk_check; kit_check
    project="chm-$(printf '%s' "$root" | sha256sum | cut -c1-12)"
    data_volume="${project}-data-initial"
    [[ -z "$(docker volume ls -q --filter "name=^${data_volume}$")" ]] || fail 'installation volume name exists; no changes made'
    load_images
    mkdir -p "$root/backups" "$root/releases"
    printf 'Cheapshot Mods installation; managed volumes are never automatically deleted.\n' > "$root/.cheapshotmods"
    cp "$3" "$root/config.env"
    if ! grep -q '^SESSION_SECRET=.' "$root/config.env"; then
      sed -i '/^SESSION_SECRET=/d' "$root/config.env"
      printf '\nSESSION_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$root/config.env"
    fi
    chmod 600 "$root/config.env"
    release_copy
    docker volume create --label "cheapshotmods.root=$project" "$data_volume" >/dev/null
    write_metadata
    switch_up
    ;;
  update)
    [[ $# == 3 ]] || usage
    installed; config_check "$root/config.env"; disk_check
    bundle="$(cd "$3" && pwd -P)"; kit_check
    [[ "$version" != "$CHM_VERSION" ]] || fail 'this version is already installed; use restart'
    load_images; release_copy
    cp "$root/current.env" "$root/update-before.env"
    trap recover_update EXIT
    # Freeze ingress, then all app writes before taking the migration snapshot.
    # A normal online backup is deliberately not used as the update source.
    compose stop proxy >/dev/null
    compose stop app >/dev/null
    offline_backup
    project="$CHM_PROJECT"; data_volume="${project}-data-update-$(date +%s)-$(openssl rand -hex 3)"
    copy_backup_volume "$backup_file" "$data_volume" "$app_image"
    cp "$root/update-before.env" "$root/previous.env"
    compose down >/dev/null
    write_metadata
    switch_up
    trap - EXIT
    rm "$root/update-before.env"
    ;;
  restore)
    [[ $# == 3 ]] || usage
    installed; config_check "$root/config.env"; disk_check
    project="$CHM_PROJECT"; version="$CHM_VERSION"; app_image="$CHM_APP_IMAGE"; proxy_image="$CHM_PROXY_IMAGE"
    data_volume="${project}-data-restore-$(date +%s)-$(openssl rand -hex 3)"
    copy_backup_volume "$3" "$data_volume" "$app_image"
    cp "$root/current.env" "$root/previous.env"
    compose down >/dev/null
    write_metadata
    switch_up
    ;;
  rollback)
    [[ $# == 2 ]] || usage
    installed
    [[ -f "$root/previous.env" ]] || fail 'no previous installation metadata'
    compose down >/dev/null
    cp "$root/current.env" "$root/swap.env"
    cp "$root/previous.env" "$root/current.env"
    mv "$root/swap.env" "$root/previous.env"
    switch_up
    ;;
  start|restart)
    [[ $# == 2 ]] || usage
    installed; config_check "$root/config.env"
    [[ "$domain" == "$CHM_DOMAIN" && "$http_port" == "$CHM_HTTP_PORT" && "$https_port" == "$CHM_HTTPS_PORT" && "$bind_address" == "$CHM_BIND_ADDRESS" ]] || fail 'changing host/ports requires a separately planned proxy migration; original installation retained'
    compose up -d --force-recreate >/dev/null
    wait_app
    wait_proxy
    echo "Running $CHM_VERSION"
    ;;
  stop) installed; compose stop >/dev/null; echo 'Stopped; all volumes retained.' ;;
  backup) installed; backup ;;
  check)
    installed; config_check "$root/config.env"; wait_app
    curl_args=(--fail --silent --show-error --max-time 20)
    [[ $# == 2 || $# == 3 ]] || usage
    if [[ $# == 3 ]]; then curl_args+=(--cacert "$3"); fi
    curl "${curl_args[@]}" "$base_url/health" >/dev/null
    curl "${curl_args[@]}" "$base_url/version" | python3 -c 'import json,sys; assert json.load(sys.stdin)["version"]==sys.argv[1]' "$CHM_VERSION"
    echo "HTTPS health/version OK: $CHM_VERSION"
    ;;
  *) usage ;;
esac
