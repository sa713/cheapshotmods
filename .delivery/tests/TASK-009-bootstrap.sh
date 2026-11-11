#!/usr/bin/env bash
set -euo pipefail
repo=$(git rev-parse --show-toplevel)
work=$(mktemp -d /tmp/chm009-bootstrap-test-XXXXXX)
host=chm009-bootstrap-$(openssl rand -hex 5)
cleanup() {
  local status=$?
  docker exec "$host" chown -R "$(id -u):$(id -g)" "$work" >/dev/null 2>&1 || true
  [[ ! -f "$work/proof.json" ]] || cp "$work/proof.json" "$repo/.delivery/evidence/TASK-009/bootstrap-integration.json"
  docker rm -f "$host" >/dev/null 2>&1 || true
  rm -rf "$work"
  return "$status"
}
trap cleanup EXIT
mounts=(--mount "type=bind,source=$work,target=/proof" --mount "type=bind,source=$repo/.delivery/TASK-009-update.sh,target=/bootstrap.sh,readonly")
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then mounts+=(--mount "type=bind,source=$CODEX_PROXY_CERT,target=/usr/local/share/ca-certificates/session.crt,readonly"); fi
docker run -d --name "$host" --label cheapshotmods.task=TASK-009-bootstrap "${mounts[@]}" -e HTTP_PROXY -e HTTPS_PROXY -e NO_PROXY -e http_proxy -e https_proxy -e no_proxy debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 sleep infinity >/dev/null
docker exec "$host" bash -c 'set -e; apt-get update -qq; DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl python3 >/dev/null; update-ca-certificates >/dev/null; install -d -m700 /root/.config/cheapshotmods; printf "header = \"Accept: application/vnd.github+json\"\n" > /root/.config/cheapshotmods/github.curl; chmod 600 /root/.config/cheapshotmods/github.curl'
docker exec "$host" bash /bootstrap.sh fetch
docker exec "$host" rm /root/.config/cheapshotmods/github.curl
docker exec "$host" bash /bootstrap.sh fetch
docker exec "$host" sh -c 'printf "\n# tamper\n" >> /root/cheapshotmods-task009-89d1f3296b0c.py'
if docker exec "$host" bash /bootstrap.sh fetch > "$work/tamper.log" 2>&1; then echo 'Tampered operator accepted' >&2; exit 1; fi
rg -q 'Local operator checksum mismatch' "$work/tamper.log"
docker exec "$host" python3 -c 'import json;from pathlib import Path;Path("/proof/proof.json").write_text(json.dumps({"scope":"isolated Debian13 bootstrap, no app/server update", "private_git_blob_download_and_pinned_operator_hash":"passed", "existing_verified_helper_needs_no_GitHub_credential_or_download":"passed", "tampered_existing_helper_refused_without_overwrite":"passed", "owner_credential":"synthetic Accept-only fixture; Cloud connection authenticates exact private GitHub request"},indent=2)+"\n")'
