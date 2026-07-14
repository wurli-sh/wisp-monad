#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FINAL_MANIFEST="$ROOT/deployments/10143.json"
PENDING_MANIFEST="$ROOT/deployments/10143.pending.json"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

PASSWORD_FILE="${WISP_KEYSTORE_PASSWORD_FILE:-$ROOT/.secrets/wisp-deployer.password}"

if [[ ! -f "$PASSWORD_FILE" ]]; then
  echo "Missing keystore password file: $PASSWORD_FILE" >&2
  echo "Create it with mode 600, or set WISP_KEYSTORE_PASSWORD_FILE." >&2
  exit 1
fi

if [[ -f "$FINAL_MANIFEST" ]]; then
  echo "Refusing to redeploy: $FINAL_MANIFEST already exists" >&2
  exit 1
fi
if [[ -f "$PENDING_MANIFEST" ]]; then
  echo "Refusing to redeploy: unresolved pending manifest at $PENDING_MANIFEST" >&2
  echo "Finalize the existing broadcast or investigate it before removing the pending file." >&2
  exit 1
fi

for name in FOUNDRY_ACCOUNT MONAD_DEPLOY_RPC_URL WISP_ADMIN_ADDRESS; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required deployment variable: $name" >&2
    exit 1
  fi
done

if ! DEPLOYER_ADDRESS="$(cast wallet address --account "$FOUNDRY_ACCOUNT" --password-file "$PASSWORD_FILE")"; then
  echo "Named Foundry keystore not found: $FOUNDRY_ACCOUNT" >&2
  echo "Import it with: cast wallet import $FOUNDRY_ACCOUNT --interactive" >&2
  exit 1
fi
if [[ "$DEPLOYER_ADDRESS" == "$WISP_ADMIN_ADDRESS" ]]; then
  echo "Deployer and WISP_ADMIN_ADDRESS must be different addresses" >&2
  exit 1
fi

cd "$ROOT/contracts"
FOUNDRY_PROFILE=deploy forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$MONAD_DEPLOY_RPC_URL" \
  --account "$FOUNDRY_ACCOUNT" \
  --password-file "$PASSWORD_FILE" \
  --broadcast \
  --verify \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/

cd "$ROOT"
node scripts/deploy/finalize-manifest.mjs
