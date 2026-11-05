#!/usr/bin/env bash
set -euo pipefail
sha="${BUILD_SHA:-$(git rev-parse HEAD)}"
image="cheapshotmods:test-$sha"
tag="chm-smoke-${RANDOM}-$$"
data="$tag-data"
backup="$tag-backup"
cleanup() {
  docker rm -f "$tag" >/dev/null 2>&1 || true
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
for attempt in {1..30}; do
  if docker exec "$tag" node -e "fetch('http://localhost:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"; then break; fi
  if [[ "$attempt" == 30 ]]; then docker logs "$tag"; exit 1; fi
  sleep 1
done
docker exec "$tag" node -e "Promise.all([fetch('http://localhost:3000/version').then(r=>r.json()),fetch('http://localhost:3000/api/state')]).then(([v,r])=>{if(v.version!==process.argv[1]||r.status!==401||process.getuid()===0)process.exit(1)})" "$sha"
docker run --rm -i --mount "source=$data,target=/data" --mount "source=$backup,target=/backup" "$image" node --input-type=module - seed < scripts/volume-fixture.mjs
docker rm -f "$tag" >/dev/null
docker run -d --name "$tag" --mount "source=$data,target=/data" "$image" >/dev/null
docker run --rm -i --mount "source=$data,target=/data" "$image" node --input-type=module - check < scripts/volume-fixture.mjs
docker run --rm -i --mount "source=$backup,target=/data" "$image" node --input-type=module - restore < scripts/volume-fixture.mjs
docker inspect --format '{{.Id}} {{index .Config.Labels "org.opencontainers.image.revision"}}' "$image"
