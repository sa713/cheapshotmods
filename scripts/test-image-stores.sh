#!/usr/bin/env bash
set -euo pipefail
# Only disposable labelled DinD instances. Never reconfigure the outer daemon.
[[ $# == 1 || $# == 2 ]] || { echo 'Usage: test-image-stores.sh BUNDLE_DIR [EVIDENCE_DIR]' >&2; exit 2; }
bundle="$(realpath "$1")"
scripts="$(cd "$(dirname "$0")" && pwd)"
evidence="$(realpath -m "${2:-$scripts/../artifacts/image-stores}")"
mkdir -p "$evidence"
work="$(mktemp -d /tmp/chm-image-stores-XXXXXX)"
chmod 700 "$work"
cli="$(command -v docker)"
outer=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH "$cli" --host=unix:///var/run/docker.sock)
dind='docker:29.8.0-dind@sha256:5efed980cba3fc126cf54e21a5a6ff8849d05b6e0623d6e7612f48e9cd6cd17e'
prefix="$(basename "$work")"
cleanup() {
  local status=$?
  for mode in classic containerd; do
    "${outer[@]}" logs "$prefix-$mode" > "$evidence/$mode-daemon.log" 2>&1 || true
    "${outer[@]}" rm -f "$prefix-$mode" >/dev/null 2>&1 || true
    "${outer[@]}" volume rm "$prefix-$mode-data" >/dev/null 2>&1 || true
  done
  # Files created by root in our private bind mount only.
  "${outer[@]}" run --rm --mount "type=bind,source=$work,target=/work" "$dind" sh -c 'chown -R "$1:$2" /work' _ "$(id -u)" "$(id -g)" >/dev/null 2>&1 || true
  rm -rf "$work"
  return "$status"
}
trap cleanup EXIT
"${outer[@]}" pull "$dind" >/dev/null
python3 - "$work" "$cli" "$prefix" <<'PY'
import json,pathlib,shlex,sys
root=pathlib.Path(sys.argv[1]);cli,prefix=sys.argv[2:]
for mode,driver,enabled in [('classic','vfs',False),('containerd','native',True)]:
    (root/(mode+'.json')).write_text(json.dumps({'storage-driver':driver,'features':{'containerd-snapshotter':enabled}}))
    directory=root/mode;directory.mkdir();wrapper=directory/'docker'
    cmd=[cli,'--host=unix:///var/run/docker.sock','exec','-i',prefix+'-'+mode,'docker','--host=unix:///var/run/docker.sock']
    wrapper.write_text('#!/bin/sh\nunset DOCKER_HOST DOCKER_CONTEXT DOCKER_TLS DOCKER_TLS_VERIFY DOCKER_CERT_PATH\nexec '+shlex.join(cmd)+' "$@"\n')
    wrapper.chmod(0o700)
PY
start() {
  local mode="$1"
  "${outer[@]}" volume create --label cheapshotmods.task=TASK-003-R6 "$prefix-$mode-data" >/dev/null
  local mounts=(--mount "type=volume,source=$prefix-$mode-data,target=/var/lib/docker" --mount "type=bind,source=$work,target=$work" --mount "type=bind,source=$bundle,target=$bundle,readonly" --mount "type=bind,source=$scripts,target=$scripts,readonly")
  if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then
    mounts+=(--mount "type=bind,source=/etc/ssl/certs/ca-certificates.crt,target=/etc/ssl/certs/ca-certificates.crt,readonly" --mount "type=bind,source=$CODEX_PROXY_CERT,target=$work/session.crt,readonly")
  fi
  "${outer[@]}" run -d --privileged --name "$prefix-$mode" --label cheapshotmods.task=TASK-003-R6 "${mounts[@]}" -e HTTP_PROXY -e HTTPS_PROXY -e NO_PROXY -e http_proxy -e https_proxy -e no_proxy "$dind" dockerd --host=unix:///var/run/docker.sock --config-file "$work/$mode.json" >/dev/null
  local ready=false
  for attempt in {1..40}; do
    if "${outer[@]}" exec "$prefix-$mode" docker info >/dev/null 2>&1; then ready=true; break; fi
    sleep 1
  done
  [[ "$ready" == true ]] || { echo "Dedicated $mode daemon failed; see evidence daemon log" >&2; exit 1; }
}
inside() {
  local mode="$1"; shift
  local envs=()
  if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then envs=(-e "CODEX_PROXY_CERT=$work/session.crt"); fi
  "${outer[@]}" exec "${envs[@]}" "$prefix-$mode" "$@"
}
git -C "$scripts/.." show cf0a793010bc9fc431ad4b6a82bcce36b49e0bcb:deploy/chm.sh > "$work/legacy-chm.sh"
for mode in classic containerd; do
  start "$mode"
  inside "$mode" sh -c 'apk add --no-cache bash python3 openssl curl coreutils iproute2 >/dev/null'
  gzip -dc "$bundle/images.tar.gz" | PATH="$work/$mode:$PATH" docker image load >/dev/null
  PATH="$work/$mode:$PATH" python3 "$bundle/image-proof.py" loaded "$bundle/manifest.json"
  PATH="$work/$mode:$PATH" python3 "$scripts/image-store-observation.py" "$bundle" "$evidence/$mode.json" "$mode"
  if [[ "$mode" == classic ]]; then
    inside "$mode" bash "$scripts/test-legacy-update.sh" "$bundle" "$work/legacy-chm.sh"
  fi
  inside "$mode" bash "$scripts/test-external.sh" "$bundle"
done
# Export the SAME verified images from containerd; never rebuild/re-sign proof.
PATH="$work/containerd:$PATH" docker image save "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["app_image"])' "$bundle/manifest.json")" "$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["proxy_image"])' "$bundle/manifest.json")" | gzip -1 > "$work/containerd-export.tar.gz"
python3 "$bundle/image-proof.py" archive "$bundle/manifest.json" "$work/containerd-export.tar.gz"
# A fresh classic fixture proves reverse import without existing cached images.
"${outer[@]}" rm -f "$prefix-classic" >/dev/null
"${outer[@]}" volume rm "$prefix-classic-data" >/dev/null
start classic
gzip -dc "$work/containerd-export.tar.gz" | PATH="$work/classic:$PATH" docker image load >/dev/null
PATH="$work/classic:$PATH" python3 "$bundle/image-proof.py" loaded "$bundle/manifest.json"
PATH="$work/classic:$PATH" python3 "$scripts/image-store-observation.py" "$bundle" "$evidence/containerd-to-classic.json" classic
python3 - "$evidence" "$work/containerd-export.tar.gz" <<'PY'
import hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1]);a=json.loads((root/'classic.json').read_text());b=json.loads((root/'containerd.json').read_text());c=json.loads((root/'containerd-to-classic.json').read_text())
assert a['images_archive_sha256']==b['images_archive_sha256']==c['images_archive_sha256']
for role in ('app','proxy'):
    assert a['images'][role]['config_digest']==b['images'][role]['config_digest']==c['images'][role]['config_digest']
    assert a['images'][role]['native_id']!=b['images'][role]['native_id']
    assert a['images'][role]['native_id']==c['images'][role]['native_id']
with open(sys.argv[2],'rb') as stream:export_hash=hashlib.file_digest(stream,'sha256').hexdigest()
(root/'summary.json').write_text(json.dumps({'same_input_archive_sha256':a['images_archive_sha256'],'containerd_export_sha256':export_hash,'classic_to_containerd':'passed','containerd_to_fresh_classic':'passed','format1_to_format2_and_rollback':'passed','external_install_lifecycle_both_stores':'passed'},indent=2)+'\n')
PY
echo 'Real Docker29 cross-store matrix passed: one exact kit on classic/containerd, native IDs differ, config/layer proof equal, external lifecycle/negatives both stores, incoming v2 upgrade/legacy rollback, containerd export -> fresh classic.'
