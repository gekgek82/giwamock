#!/usr/bin/env bash
# Smoke-check gateway HTTP parity routes (not 404 = route registered).
# Requires a running gateway; broker must answer RPC or some paths return 5xx.
#
# Usage:
#   GATEWAY_URL=https://your-gateway.up.railway.app bash scripts/check-gateway-parity.sh
#   bash scripts/check-gateway-parity.sh   # default http://127.0.0.1:3046
set -euo pipefail

BASE="${GATEWAY_URL:-http://127.0.0.1:3046}"
BASE="${BASE%/}"

fail=0

die() {
  echo "$*" >&2
  exit 1
}

http_code() {
  curl -sS -o /dev/null -w '%{http_code}' "${BASE}${1}"
}

not_404() {
  local path="$1"
  local code
  code="$(http_code "$path")"
  if [[ "$code" == "404" ]]; then
    echo "FAIL ${path} → ${code} (route missing — redeploy gateway or wrong BASE URL)"
    fail=1
  else
    echo "OK   ${path} → ${code}"
  fi
}

gateway_health() {
  local body code
  code="$(curl -sS -o /tmp/gw-health.json -w '%{http_code}' "${BASE}/api/health")"
  body="$(cat /tmp/gw-health.json)"
  rm -f /tmp/gw-health.json
  if [[ "$code" != "200" ]]; then
    echo "FAIL /api/health → ${code} (expected 200; is this the gateway URL?)"
    fail=1
    return
  fi
  if [[ "$body" != *"giwater-gateway"* ]]; then
    echo "FAIL /api/health body missing giwater-gateway: ${body}"
    fail=1
    return
  fi
  echo "OK   /api/health → 200 (gateway)"
}

echo "Gateway parity smoke: BASE=${BASE}"
gateway_health

not_404 "/health"
not_404 "/indexed-events"

# Must be HTTP 200: broker GatewayRpcInvokeService implements GET /spot-pairs/recently-created.
code="$(http_code "/spot-pairs/recently-created")"
if [[ "$code" != "200" ]]; then
  echo "FAIL /spot-pairs/recently-created → ${code} (expected 200; broker RPC must expose this route)"
  fail=1
else
  echo "OK   /spot-pairs/recently-created → 200"
fi

code="$(http_code "/spot-tokens/recently-created")"
if [[ "$code" != "200" ]]; then
  echo "FAIL /spot-tokens/recently-created → ${code} (expected 200; broker RPC must expose this route)"
  fail=1
else
  echo "OK   /spot-tokens/recently-created → 200"
fi

echo "POST invoke: GET /spot-pairs/recently-created (detect missing RPC route)"
invoke_body="$(curl -sS -X POST "${BASE}/api/v1/broker/invoke" \
  -H 'content-type: application/json' \
  -d '{"method":"GET","path":"/spot-pairs/recently-created"}')"
if echo "$invoke_body" | grep -q 'No route for GET /spot-pairs/recently-created'; then
  echo "FAIL invoke recently-created: RPC route missing in GatewayRpcInvokeService"
  fail=1
elif echo "$invoke_body" | grep -q '"ok":true'; then
  echo "OK   invoke GET /spot-pairs/recently-created → ok"
else
  echo "WARN invoke GET /spot-pairs/recently-created → ${invoke_body:0:200}"
fi

echo "POST invoke: GET /spot-tokens/recently-created"
invoke_tokens_recent="$(curl -sS -X POST "${BASE}/api/v1/broker/invoke" \
  -H 'content-type: application/json' \
  -d '{"method":"GET","path":"/spot-tokens/recently-created"}')"
if echo "$invoke_tokens_recent" | grep -q 'No route for GET /spot-tokens/recently-created'; then
  echo "FAIL invoke spot-tokens recently-created: RPC route missing in GatewayRpcInvokeService"
  fail=1
elif echo "$invoke_tokens_recent" | grep -q '"ok":true'; then
  echo "OK   invoke GET /spot-tokens/recently-created → ok"
else
  echo "WARN invoke GET /spot-tokens/recently-created → ${invoke_tokens_recent:0:200}"
fi

echo "POST invoke sanity"
code="$(curl -sS -o /dev/null -w '%{http_code}' \
  -X POST "${BASE}/api/v1/broker/invoke" \
  -H 'content-type: application/json' \
  -d '{"method":"GET","path":"/health"}')"
if [[ "$code" == "404" ]]; then
  echo "FAIL POST /api/v1/broker/invoke → 404"
  fail=1
else
  echo "OK   POST /api/v1/broker/invoke → ${code}"
fi

if [[ "$fail" -ne 0 ]]; then
  die "One or more checks failed."
fi
echo "All parity smoke checks passed."
