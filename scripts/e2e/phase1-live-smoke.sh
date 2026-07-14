#!/usr/bin/env bash
set -euo pipefail

# Executes the first-leaf live smoke flow: approve → deposit → claim.
# The encrypted keystore password is read from an owner-only local file.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [[ "${1:-}" == "--" ]]; then
  shift
fi
RECIPIENT="${1:-}"
RPC="https://testnet-rpc.monad.xyz"
CHAIN_ID=10143
DENOMINATION=1000000
TOKEN="0x534b2f3A21130d7a60830c2Df862319e593943A3"
VERIFIER="0x1026346d75D10FEa3340361DC6C288E25DB46C3A"

if [[ -z "$RECIPIENT" ]]; then
  echo "usage: $0 <recipient-address>" >&2
  exit 1
fi
if [[ ! -f "$ROOT/.env" || ! -f "$ROOT/deployments/10143.json" ]]; then
  echo "Missing .env or deployments/10143.json" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

PASSWORD_FILE="${WISP_KEYSTORE_PASSWORD_FILE:-$ROOT/.secrets/wisp-deployer.password}"
if [[ ! -f "$PASSWORD_FILE" ]]; then
  echo "Missing keystore password file: $PASSWORD_FILE" >&2
  echo "Create it with mode 600, or set WISP_KEYSTORE_PASSWORD_FILE." >&2
  exit 1
fi

POOL="$(node -e 'const d=require(process.argv[1]); console.log(d.pools["1000000"].address)' "$ROOT/deployments/10143.json")"
NOTE="${WISP_NOTE_PATH:-$ROOT/.wisp-notes/phase1-live-1usdc.json}"
PROOF="$NOTE.proof.json"

[[ "$(cast chain-id --rpc-url "$RPC")" == "$CHAIN_ID" ]] || { echo "Wrong chain" >&2; exit 1; }
cast to-check-sum-address "$RECIPIENT" >/dev/null
[[ "$(cast call "$POOL" "nextLeafIndex()(uint32)" --rpc-url "$RPC")" == "0" ]] || {
  echo "1-USDC pool is no longer empty; do not use the first-leaf smoke script." >&2
  exit 1
}

node "$ROOT/circuits/scripts/prove-for-pool.mjs" "$POOL" "$CHAIN_ID" "$RECIPIENT" "$DENOMINATION" "$NOTE" >/dev/null

commitment="$(node -e 'const p=require(process.argv[1]); console.log(p.commitment)' "$PROOF")"
expectedRoot="$(node -e 'const p=require(process.argv[1]); console.log(p.root)' "$PROOF")"
nullifier="$(node -e 'const p=require(process.argv[1]); console.log(p.nullifier)' "$PROOF")"
binding="$(node -e 'const p=require(process.argv[1]); console.log(p.recipientBinding)' "$PROOF")"
a="$(node -e 'const p=require(process.argv[1]); console.log("["+p.a.join(",")+"]")' "$PROOF")"
b="$(node -e 'const p=require(process.argv[1]); console.log("[["+p.b[0].join(",")+"],["+p.b[1].join(",")+"]]" )' "$PROOF")"
c="$(node -e 'const p=require(process.argv[1]); console.log("["+p.c.join(",")+"]")' "$PROOF")"

proofValid="$(cast call "$VERIFIER" "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[7])(bool)" \
  "$a" "$b" "$c" "[$expectedRoot,$nullifier,$RECIPIENT,$DENOMINATION,$CHAIN_ID,$POOL,$binding]" \
  --rpc-url "$RPC")"
[[ "$proofValid" == "true" ]] || { echo "Prepared proof does not verify on-chain" >&2; exit 1; }

echo "Approving exactly 1 USDC for $POOL"
cast send "$TOKEN" "approve(address,uint256)" "$POOL" "$DENOMINATION" \
  --account "$FOUNDRY_ACCOUNT" --password-file "$PASSWORD_FILE" --rpc-url "$RPC"

echo "Depositing 1 USDC"
cast send "$POOL" "deposit(bytes32)" "$commitment" \
  --account "$FOUNDRY_ACCOUNT" --password-file "$PASSWORD_FILE" --rpc-url "$RPC"

actualRoot="$(cast call "$POOL" "currentRoot()(bytes32)" --rpc-url "$RPC")"
[[ "${actualRoot,,}" == "${expectedRoot,,}" ]] || {
  echo "Deposit root differs from the prepared proof root; claim stopped. Preserve $NOTE." >&2
  exit 1
}

echo "Claiming 1 USDC to $RECIPIENT"
cast send "$POOL" \
  "claim(uint256[2],uint256[2][2],uint256[2],bytes32,bytes32,address,bytes32)" \
  "$a" "$b" "$c" "$expectedRoot" "$nullifier" "$RECIPIENT" "$binding" \
  --account "$FOUNDRY_ACCOUNT" --password-file "$PASSWORD_FILE" --rpc-url "$RPC"

echo "Smoke flow complete. Recipient USDC units:"
cast call "$TOKEN" "balanceOf(address)(uint256)" "$RECIPIENT" --rpc-url "$RPC"
