#!/usr/bin/env bash
set -euo pipefail
probe_dir="$(mktemp -d)"
trap 'rm -rf "$probe_dir"' EXIT
cat > "$probe_dir/package.json" <<'JSON'
{"private":true,"scripts":{"measure":"node -e \"process.exit(17)\""}}
JSON
# Match GitHub's explicit bash shell and the actual measurement pipeline.
if (cd "$probe_dir" && bash --noprofile --norc -e -o pipefail -c 'npm run measure | tee capacity.txt'); then
  echo 'Measurement failure was hidden by the pipeline' >&2
  exit 1
else
  status=$?
fi
printf '{"measurementFailureProbe":"passed","exitCode":%s}\n' "$status"
