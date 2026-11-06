#!/usr/bin/env bash
set -euo pipefail
[[ $# == 2 ]] || { echo 'Usage: test-legacy-update.sh NEW_BUNDLE OLD_INSTALLER' >&2; exit 2; }
bundle="$(realpath "$1")"
scripts="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d /tmp/chm-legacy-test-XXXXXX)"
host="chm-legacy-$(openssl rand -hex 5)"
project="chm-$(printf '%s' "$work/install" | sha256sum | cut -c1-12)"
cleanup() {
  docker exec "$host" chown -R "$(id -u):$(id -g)" "$work" >/dev/null 2>&1 || true
  mapfile -t ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project")
  if ((${#ids[@]})); then docker rm -f "${ids[@]}" >/dev/null 2>&1 || true; fi
  mapfile -t ids < <(docker volume ls -q --filter "label=cheapshotmods.root=$project")
  if ((${#ids[@]})); then docker volume rm "${ids[@]}" >/dev/null 2>&1 || true; fi
  docker network rm "$project-edge" >/dev/null 2>&1 || true
  docker rm -f "$host" >/dev/null 2>&1 || true
  if [[ -f "$work/legacy-image" ]]; then docker image rm "$(cat "$work/legacy-image")" >/dev/null 2>&1 || true; fi
  rm -rf "$work"
}
trap cleanup EXIT
cp "$2" "$work/legacy-chm.sh"
cli="$(command -v docker)"
plugin="$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "compose"}}{{.Path}}{{end}}{{end}}')"
buildx="$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "buildx"}}{{.Path}}{{end}}{{end}}')"
[[ -f "$buildx" ]] || { echo 'Buildx is required by the test fixture (not the installer)' >&2; exit 1; }
mounts=(--mount "type=bind,source=$work,target=$work" --mount "type=bind,source=$bundle,target=$bundle,readonly" --mount "type=bind,source=$scripts,target=/fixtures,readonly" --mount "type=bind,source=$cli,target=/usr/local/bin/docker,readonly" --mount "type=bind,source=$plugin,target=/usr/libexec/docker/cli-plugins/docker-compose,readonly" --mount "type=bind,source=$buildx,target=/usr/libexec/docker/cli-plugins/docker-buildx,readonly" --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock)
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then mounts+=(--mount "type=bind,source=$CODEX_PROXY_CERT,target=/usr/local/share/ca-certificates/session.crt,readonly"); fi
docker run -d --name "$host" --network host "${mounts[@]}" -e HTTP_PROXY -e HTTPS_PROXY -e NO_PROXY -e http_proxy -e https_proxy -e no_proxy debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 sleep infinity >/dev/null
docker exec "$host" bash -c 'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl openssl python3 iproute2 >/dev/null && update-ca-certificates >/dev/null'
docker exec "$host" python3 /fixtures/legacy-update-fixture.py "$bundle" "$work"
