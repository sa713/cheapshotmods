#!/usr/bin/env bash
set -euo pipefail
sha="${BUILD_SHA:-$(git rev-parse HEAD)}"
image="cheapshotmods:test-$sha"
tag="chm-smoke-${RANDOM}-$$"
restored="$tag-restored"
data="$tag-data"
backup="$tag-backup"
cleanup() {
  docker rm -f "$tag" "$restored" >/dev/null 2>&1 || true
  docker volume rm "$data" "$backup" >/dev/null 2>&1 || true
}
trap cleanup EXIT
build_args=()
if [[ -n "${CODEX_PROXY_CERT:-}" ]]; then build_args+=(--secret "id=proxy_ca,src=$CODEX_PROXY_CERT"); fi
docker build "${build_args[@]}" --build-arg "BUILD_SHA=$sha" -t "$image" .
docker volume create "$data" >/dev/null
docker volume create "$backup" >/dev/null
# Both fresh volumes inherit /data ownership from the non-root runtime image.
docker run --rm --mount "source=$backup,target=/data" "$image" node -e "require('fs').writeFileSync('/data/.initialized','')"
docker run -d --name "$tag" --mount "source=$data,target=/data" "$image" >/dev/null
wait_ready() {
  local container="$1"
  for attempt in {1..30}; do
    if docker exec "$container" node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then return; fi
    if [[ "$attempt" == 30 ]]; then docker logs "$container"; return 1; fi
    sleep 1
  done
}
wait_ready "$tag"
docker exec "$tag" node -e "Promise.all([fetch('http://localhost:3000/version').then(r=>r.json()),fetch('http://localhost:3000/api/state')]).then(([v,r])=>{if(v.version!==process.argv[1]||r.status!==401||process.getuid()===0)process.exit(1)})" "$sha"
docker run --rm -i --mount "source=$data,target=/data" --mount "source=$backup,target=/backup" "$image" node --input-type=module - seed < scripts/volume-fixture.mjs
docker rm -f "$tag" >/dev/null
docker run -d --name "$tag" --mount "source=$data,target=/data" "$image" >/dev/null
wait_ready "$tag"
docker run --rm -i --mount "source=$data,target=/data" "$image" node --input-type=module - check < scripts/volume-fixture.mjs
# Internal HTTP models the proxy hop; public origin/cookie policy remains HTTPS.
# Synthetic credentials are scoped to this disposable container, never the image.
docker run -d --name "$restored" --mount "source=$backup,target=/data" \
  -e PUBLIC_BASE_URL=https://smoke.invalid \
  -e TELEGRAM_BOT_TOKEN=isolated-container-fixture-token \
  -e SESSION_SECRET=isolated-container-fixture-session-secret-32-chars "$image" >/dev/null
wait_ready "$restored"
docker exec -i "$restored" node --input-type=module - http < scripts/volume-fixture.mjs
docker inspect --format '{{.Id}} {{index .Config.Labels "org.opencontainers.image.revision"}}' "$image"
