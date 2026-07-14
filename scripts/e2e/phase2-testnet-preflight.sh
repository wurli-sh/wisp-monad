#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [[ ! -f "$ROOT/.env" ]]; then
  echo "FAIL: missing $ROOT/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a

required=(
  SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY
  REDIS_URL REDIS_TOKEN RESEND_API_KEY RESEND_FROM_EMAIL
  CLAIM_PAYLOAD_ENC_KEYS_JSON INVITE_STATUS_HMAC_KEYS_JSON
  INDEXER_ADMIN_TOKEN MONAD_INDEXER_RPC_URL CORS_ALLOWED_ORIGINS API_ORIGIN
)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "FAIL: missing $name" >&2
    exit 1
  fi
done
if [[ "$CORS_ALLOWED_ORIGINS" == "*" ]]; then
  echo "FAIL: CORS_ALLOWED_ORIGINS must be an exact allowlist" >&2
  exit 1
fi
echo "OK: required server env is present and CORS is explicit"

chain_id="$(cast chain-id --rpc-url "$MONAD_INDEXER_RPC_URL")"
if [[ "$chain_id" != "10143" ]]; then
  echo "FAIL: RPC chain ID is $chain_id, expected 10143" >&2
  exit 1
fi
token="$(node -p 'require(process.argv[1]).token.address' "$ROOT/deployments/10143.json")"
if [[ "$(cast call "$token" 'decimals()(uint8)' --rpc-url "$MONAD_INDEXER_RPC_URL")" != "6" ]]; then
  echo "FAIL: configured Circle token does not report 6 decimals" >&2
  exit 1
fi
echo "OK: Monad Testnet RPC and Circle USDC contract"

for table in profiles indexer_leases; do
  code="$(curl -sS -o "/tmp/wisp-preflight-${table}.json" -w '%{http_code}' \
    "$SUPABASE_URL/rest/v1/$table?select=*&limit=1" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")"
  if [[ "$code" != "200" ]]; then
    echo "FAIL: Supabase table '$table' unavailable (HTTP $code); apply both migrations" >&2
    exit 1
  fi
done
echo "OK: Supabase Phase 2 migrations are visible through PostgREST"

curl -sS "$SUPABASE_URL/auth/v1/settings" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -o /tmp/wisp-preflight-auth-settings.json
node -e '
  const settings = require("/tmp/wisp-preflight-auth-settings.json");
  if (!settings.external?.email || !settings.external?.google) {
    console.error("FAIL: Supabase Email and Google providers must both be enabled");
    process.exit(1);
  }
' 
curl -sS "$SUPABASE_URL/auth/v1/admin/users?page=1&per_page=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -o /tmp/wisp-preflight-auth-users.json
node -e '
  const response = require("/tmp/wisp-preflight-auth-users.json");
  if (!Array.isArray(response.users) || response.users.length === 0) {
    console.error("FAIL: no real Supabase OAuth/OTP test user exists yet");
    process.exit(1);
  }
' 
echo "OK: Supabase providers and real test identity"

redis_code="$(curl -sS -o /tmp/wisp-preflight-redis.json -w '%{http_code}' \
  "$REDIS_URL/ping" -H "Authorization: Bearer $REDIS_TOKEN")"
if [[ "$redis_code" != "200" ]] || ! grep -q 'PONG' /tmp/wisp-preflight-redis.json; then
  echo "FAIL: Upstash Redis ping failed" >&2
  exit 1
fi
echo "OK: Upstash Redis"

resend_code="$(curl -sS -o /tmp/wisp-preflight-resend.json -w '%{http_code}' \
  https://api.resend.com/domains \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "User-Agent: Wisp-Phase2-Preflight/1.0")"
if [[ "$resend_code" != "200" ]]; then
  echo "FAIL: Resend API key validation failed (HTTP $resend_code)" >&2
  exit 1
fi
echo "OK: Resend API key"

echo "Phase 2 testnet provider preflight passed."
