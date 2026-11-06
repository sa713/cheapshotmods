#!/usr/bin/env bash
set -euo pipefail
[[ $# == 1 ]] || { echo 'Usage: test-external.sh BUNDLE_DIR' >&2; exit 2; }
bundle="$(realpath "$1")"
source_dir="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d /tmp/chm-external-XXXXXX)"
host="chm-external-host-$(openssl rand -hex 5)"
project="chm-$(printf '%s' "$work/install" | sha256sum | cut -c1-12)"
shared="$host-shared"
cleanup() {
  local status=$?
  docker exec "$host" chown -R "$(id -u):$(id -g)" "$work" >/dev/null 2>&1 || true
  if [[ "$status" != 0 && -d "$work/install/ingress" ]]; then
    mkdir -p /tmp/chm-003-evidence
    cp -R "$work/install/ingress" "/tmp/chm-003-evidence/$(basename "$work")" || true
  fi
  for owner in "$project" "$shared" "$shared-chm-validation"; do
    mapfile -t ids < <(docker ps -aq --filter "label=com.docker.compose.project=$owner")
    if ((${#ids[@]})); then docker rm -f "${ids[@]}" >/dev/null 2>&1 || true; fi
    mapfile -t ids < <(docker network ls -q --filter "label=com.docker.compose.project=$owner")
    if ((${#ids[@]})); then docker network rm "${ids[@]}" >/dev/null 2>&1 || true; fi
    mapfile -t ids < <(docker volume ls -q --filter "label=com.docker.compose.project=$owner")
    if ((${#ids[@]})); then docker volume rm "${ids[@]}" >/dev/null 2>&1 || true; fi
  done
  mapfile -t ids < <(docker volume ls -q --filter "label=cheapshotmods.root=$project")
  if ((${#ids[@]})); then docker volume rm "${ids[@]}" >/dev/null 2>&1 || true; fi
  docker network rm "$project-edge" >/dev/null 2>&1 || true
  docker rm -f "$host" >/dev/null 2>&1 || true
  if [[ -f "$work/update-image" ]]; then docker image rm "$(cat "$work/update-image")" >/dev/null 2>&1 || true; fi
  rm -rf "$work"
}
trap cleanup EXIT
cli="$(command -v docker)"
plugin="$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "compose"}}{{.Path}}{{end}}{{end}}')"
mounts=(--mount "type=bind,source=$work,target=$work" --mount "type=bind,source=$bundle,target=$bundle,readonly" --mount "type=bind,source=$source_dir,target=/fixtures,readonly" --mount "type=bind,source=$cli,target=/usr/local/bin/docker,readonly" --mount "type=bind,source=$plugin,target=/usr/libexec/docker/cli-plugins/docker-compose,readonly" --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock)
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then mounts+=(--mount "type=bind,source=$CODEX_PROXY_CERT,target=/usr/local/share/ca-certificates/session.crt,readonly"); fi
docker pull caddy:2.11.4-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b >/dev/null
docker run -d --name "$host" --network host "${mounts[@]}" -e HTTP_PROXY -e HTTPS_PROXY -e NO_PROXY -e http_proxy -e https_proxy -e no_proxy debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 sleep infinity >/dev/null
docker exec "$host" bash -c 'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl openssl python3 iproute2 >/dev/null && update-ca-certificates >/dev/null'
docker exec "$host" python3 /fixtures/external-fixture.py "$bundle" "$work" "$shared"
