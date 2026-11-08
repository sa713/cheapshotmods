#!/usr/bin/env bash
set -euo pipefail
[[ $# == 3 ]] || { echo 'Usage: run.sh NEW_KIT OLD_KIT EVIDENCE_DIR' >&2; exit 2; }
bundle="$(realpath "$1")"
evidence="$(realpath -m "$3")"
mkdir -p "$evidence"
fixture_dir="$(cd "$(dirname "$0")" && pwd -P)"
old="$(realpath "$2")"
work="$(mktemp -d /tmp/chm-task005-upgrade-XXXXXX)"
host="chm-task005-upgrade-$(openssl rand -hex 5)"
project="chm-$(printf '%s' "$work/install" | sha256sum | cut -c1-12)"
cleanup() {
  local status=$?
  docker exec "$host" chown -R "$(id -u):$(id -g)" "$work" >/dev/null 2>&1 || true
  [[ ! -f "$work/proof.json" ]] || cp "$work/proof.json" "$evidence/proof.json"
  for kind in container network volume; do
    case "$kind" in
      container) mapfile -t ids < <(docker ps -aq --filter "label=com.docker.compose.project=$project"); ((${#ids[@]} == 0)) || docker rm -f "${ids[@]}" >/dev/null;;
      network) docker network rm "$project-edge" >/dev/null 2>&1 || true;;
      volume) mapfile -t ids < <(docker volume ls -q --filter "label=cheapshotmods.root=$project"); ((${#ids[@]} == 0)) || docker volume rm "${ids[@]}" >/dev/null;;
    esac
  done
  docker rm -f "$host" >/dev/null 2>&1 || true
  rm -rf "$work"
  return "$status"
}
trap cleanup EXIT
cli="$(command -v docker)"
plugin="$(docker info --format '{{range .ClientInfo.Plugins}}{{if eq .Name "compose"}}{{.Path}}{{end}}{{end}}')"
mounts=(--mount "type=bind,source=$work,target=$work" --mount "type=bind,source=$bundle,target=$bundle,readonly" --mount "type=bind,source=$old,target=$old,readonly" --mount type=bind,source=$fixture_dir,target=/fixtures,readonly --mount "type=bind,source=$cli,target=/usr/local/bin/docker,readonly" --mount "type=bind,source=$plugin,target=/usr/libexec/docker/cli-plugins/docker-compose,readonly" --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock)
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then mounts+=(--mount "type=bind,source=$CODEX_PROXY_CERT,target=/usr/local/share/ca-certificates/session.crt,readonly"); fi
docker run -d --name "$host" --network host --label cheapshotmods.task=TASK-005 "${mounts[@]}" debian:13-slim@sha256:a72b4433de1cf7d6bae0c4cee74d0547f58601a643b3375f070c51600d63b6b2 sleep infinity >/dev/null
docker exec "$host" bash -c 'apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ca-certificates curl openssl python3 iproute2 >/dev/null && update-ca-certificates >/dev/null'
docker exec "$host" python3 /fixtures/fixture.py "$bundle" "$work" "$old"
