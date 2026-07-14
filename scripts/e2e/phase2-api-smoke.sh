#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
API_URL="${API_URL:-http://localhost:8787}"
REQUIRE_READY="${REQUIRE_READY:-0}"
if [[ "${1:-}" == "--require-ready" ]]; then
  REQUIRE_READY=1
fi

echo "Phase 2 API smoke against ${API_URL}"

code="$(curl -s -o /tmp/wisp-health.json -w "%{http_code}" "${API_URL}/health")"
if [[ "$code" != "200" ]]; then
  echo "FAIL: /health returned ${code}"
  exit 1
fi
echo "OK: /health"

code="$(curl -s -o /tmp/wisp-ready.json -w "%{http_code}" "${API_URL}/ready")"
if [[ "$REQUIRE_READY" == "1" && "$code" != "200" ]]; then
  echo "FAIL: /ready returned ${code}"
  cat /tmp/wisp-ready.json || true
  exit 1
fi
echo "OK: /ready returned ${code}"

code="$(curl -s -o /tmp/wisp-openapi.json -w "%{http_code}" "${API_URL}/openapi.json")"
if [[ "$code" != "200" ]] || ! grep -q '"/v1/merkle/path"' /tmp/wisp-openapi.json; then
  echo "FAIL: OpenAPI document missing or incomplete"
  exit 1
fi
echo "OK: OpenAPI document"

code="$(curl -s -o /tmp/wisp-me.json -w "%{http_code}" "${API_URL}/v1/me")"
if [[ "$code" != "401" ]]; then
  echo "FAIL: /v1/me should require auth (got ${code})"
  exit 1
fi
echo "OK: /v1/me requires bearer token"

code="$(curl -s -o /tmp/wisp-cookie.json -w "%{http_code}" -X POST "${API_URL}/v1/activity" -H 'cookie: sb-access-token=fake' -H 'content-type: application/json' -d '{}')"
if [[ "$code" != "400" ]]; then
  echo "FAIL: mutation cookie should be rejected (got ${code})"
  exit 1
fi
echo "OK: mutation cookies rejected"

code="$(curl -s -o /tmp/wisp-resolve.json -w "%{http_code}" "${API_URL}/v1/resolve?q=nobody")"
if [[ "$REQUIRE_READY" != "1" && "$code" == "503" ]]; then
  echo "INFO: /v1/resolve unavailable because dependencies are not ready"
  echo "Phase 2 API smoke passed (dependency-independent checks only)."
  exit 0
fi
if [[ "$code" != "200" ]]; then
  echo "FAIL: /v1/resolve returned ${code}"
  exit 1
fi
grep -q '"found":false' /tmp/wisp-resolve.json
echo "OK: /v1/resolve returns found:false for unknown handle"

echo "Phase 2 API smoke passed. OAuth/wallet/deposit/decrypt coverage is performed by the live exit flow."
