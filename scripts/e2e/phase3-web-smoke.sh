#!/usr/bin/env bash
set -euo pipefail
# Reproducible local Phase 3 frontend gate. Live wallet/OAuth flows are separate.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export PATH="${HOME}/.nvm/versions/node/v22.22.1/bin:${PATH}"

echo "== phase3 web unit =="
pnpm --filter @wisp/web test
pnpm --filter @wisp/crypto test
pnpm --filter @wisp/shared test

echo "== phase3 web lint/typecheck/build =="
pnpm --filter @wisp/web lint
pnpm --filter @wisp/web typecheck
pnpm --filter @wisp/web build

echo "== phase3 browser artifact checksums =="
(
  cd apps/web/public/circuits
  sha256sum --check --ignore-missing checksums.sha256
)

echo "OK: phase3 unit+lint+typecheck+build+artifact hashes. Live exit still requires funded Monad wallets and a verified X OAuth identity."
