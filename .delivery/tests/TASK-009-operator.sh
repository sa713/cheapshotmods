#!/usr/bin/env bash
set -euo pipefail
[[ $# == 3 ]] || { echo 'Usage: TASK-009-operator.sh NEW_KIT CANONICAL_TASK008_KIT EVIDENCE_DIR' >&2; exit 2; }
kit=$(realpath "$1")
old=$(realpath "$2")
evidence=$(realpath -m "$3")
repo=$(git rev-parse --show-toplevel)
work=$(mktemp -d /tmp/chm009-owner-test-XXXXXX)
host=chm009-owner-host-$(openssl rand -hex 5)
project=chm-$(printf '%s' "$work/install" | sha256sum | cut -c1-12)
mkdir -p "$evidence"
cleanup() {
  local status=$?
  if ((status != 0)); then docker logs "$project-operator-proxy" > "$evidence/proxy-failure.log" 2>&1 || true; fi
  docker exec "$host" chown -R "$(id -u):$(id -g)" "$work" >/dev/null 2>&1 || true
  [[ ! -f "$work/proof.json" ]] || cp "$work/proof.json" "$evidence/proof.json"
  docker rm -f "$project-operator-proxy" >/dev/null 2>&1 || true
  mapfile -t ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project")
  ((${#ids[@]} == 0)) || docker rm -f "${ids[@]}" >/dev/null
  docker network rm "$project-edge" >/dev/null 2>&1 || true
  mapfile -t ids < <(docker volume ls -q --filter "label=cheapshotmods.root=$project")
  ((${#ids[@]} == 0)) || docker volume rm "${ids[@]}" >/dev/null
  docker rm -f "$host" >/dev/null 2>&1 || true
  rm -rf "$work"
  return "$status"
}
trap cleanup EXIT
cp "$repo/tests/fixtures/v5-mixed-history.json" "$work/schema5.json"
cli=$(command -v docker)
plugin=$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "compose"}}{{.Path}}{{end}}{{end}}')
docker_root=$(docker info --format '{{.DockerRootDir}}')
mounts=(--mount "type=bind,source=$work,target=$work" --mount "type=bind,source=$kit,target=$kit,readonly" --mount "type=bind,source=$old,target=$old,readonly" --mount "type=bind,source=$repo/.delivery,target=/operator,readonly" --mount "type=bind,source=$repo/scripts/task009-upgrade/api.mjs,target=/fixtures/api.mjs,readonly" --mount "type=bind,source=$cli,target=/usr/local/bin/docker,readonly" --mount "type=bind,source=$plugin,target=/usr/libexec/docker/cli-plugins/docker-compose,readonly" --mount "type=bind,source=$docker_root,target=$docker_root,readonly" --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock)
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then mounts+=(--mount "type=bind,source=$CODEX_PROXY_CERT,target=/usr/local/share/ca-certificates/session.crt,readonly"); fi
docker pull caddy:2.11.4-alpine@sha256:6aeddd44c3078b0f9a35206472a11420648a79c184603ef95957d0a20044cb2b >/dev/null
docker run -d --name "$host" --network host --label cheapshotmods.task=TASK-009-operator "${mounts[@]}" -e HTTP_PROXY -e HTTPS_PROXY -e NO_PROXY -e http_proxy -e https_proxy -e no_proxy debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 sleep infinity >/dev/null
docker exec "$host" bash -c 'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl openssl python3 iproute2 >/dev/null && update-ca-certificates >/dev/null'
docker exec "$host" python3 /operator/tests/TASK-009-operator-fixture.py "$kit" "$old" "$work" /operator/TASK-009-install.py
