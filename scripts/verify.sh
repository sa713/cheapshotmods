#!/usr/bin/env bash
set -euo pipefail
npm ci --no-audit --no-fund
npm run typecheck
npm run lint
npm test
npm run build
