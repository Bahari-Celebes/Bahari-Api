#!/bin/bash
# BAHARI Intelligence — smoke test all endpoints.
# Usage: bash test/smoke-test.sh [API_URL]
# Default: http://localhost:3000 (or set API_URL env var)

BASE="${1:-${API_URL:-http://localhost:3000}}"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ $1\033[0m"; PASS=$((PASS+1)); }
red() { echo -e "\033[31m✗ $1\033[0m"; FAIL=$((FAIL+1)); }

check() {
  local label="$1" method="$2" url="$3" data="$4" expected_status="${5:-200}"
  local http_code
  if [ -z "$data" ]; then
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE$url" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN")
  else
    http_code=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE$url" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$data")
  fi
  if [ "$http_code" = "$expected_status" ]; then
    green "$label"
  else
    red "$label  (expected $expected_status, got $http_code)"
  fi
}

check_body() {
  local label="$1" method="$2" url="$3" data="$4" grep_for="$5"
  local body
  if [ -z "$data" ]; then
    body=$(curl -s -X "$method" "$BASE$url" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN")
  else
    body=$(curl -s -X "$method" "$BASE$url" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$data")
  fi
  if echo "$body" | grep -q "$grep_for"; then
    green "$label"
  else
    red "$label  (body missing '$grep_for')"
  fi
}

echo "============================================"
echo " BAHARI Intelligence Smoke Test"
echo " Target: $BASE"
echo "============================================"

# 1. Health (no auth)
echo ""
echo "--- 1. Health ---"
check "GET /health"         "GET" "/health" "" 200

# 2. Auth
echo ""
echo "--- 2. Auth ---"
check "POST /auth/login (valid)"   "POST" "/auth/login" \
  '{"email":"manager@bahari.id","password":"password123"}' 200
check "POST /auth/login (invalid)" "POST" "/auth/login" \
  '{"email":"x@x.com","password":"wrong"}' 401

# Login to get token
LOGIN=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"manager@bahari.id","password":"password123"}')
TOKEN=$(echo "$LOGIN" | grep -o '"accessToken":"[^"]*"' | head -1 | sed 's/"accessToken":"//;s/"//')
if [ -n "$TOKEN" ]; then
  green "Extracted token"
else
  red "Failed to extract token"
  echo "Login response: $LOGIN"
  exit 1
fi

check_body "GET /auth/me"           "GET" "/auth/me" "" "manager@bahari.id"

# 3. Cooperatives
echo ""
echo "--- 3. Cooperatives ---"
check "GET /cooperatives"           "GET" "/cooperatives" "" 200
COOP=$(curl -s "$BASE/cooperatives" -H "Authorization: Bearer $TOKEN")
COOP_ID=$(echo "$COOP" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
if [ -n "$COOP_ID" ]; then
  green "Got cooperative ID: ${COOP_ID:0:8}..."
  check_body "GET /cooperatives/:id/baseline" "GET" "/cooperatives/$COOP_ID/baseline" "" "totalMembers"
else
  red "No cooperative found"
fi

# 4. Commodities
echo ""
echo "--- 4. Commodities ---"
check "GET /commodities" "GET" "/commodities?cooperativeId=$COOP_ID" "" 200
check "POST /commodities" "POST" "/commodities" \
  "{\"cooperativeId\":\"$COOP_ID\",\"commodityName\":\"Test Ikan\",\"category\":\"ikan\",\"volume\":100,\"unit\":\"kg\",\"sourceGroup\":\"Test\",\"buyPrice\":40000,\"expectedSellPrice\":55000,\"spoilagePercentage\":0.05,\"date\":\"2026-07-04\"}" 201

COMMODITIES=$(curl -s "$BASE/commodities?cooperativeId=$COOP_ID&limit=1" -H "Authorization: Bearer $TOKEN")
CMD_ID=$(echo "$COMMODITIES" | grep -o '"id":"[^"]*"' | head -1 | sed 's/"id":"//;s/"//')
if [ -n "$CMD_ID" ]; then
  green "Got commodity ID: ${CMD_ID:0:8}..."
  check "GET /commodities/:id" "GET" "/commodities/$CMD_ID" "" 200
  check "DELETE /commodities/:id" "DELETE" "/commodities/$CMD_ID" "" 200
fi

# 5. Transactions
echo ""
echo "--- 5. Transactions ---"
check "GET /transactions" "GET" "/transactions?cooperativeId=$COOP_ID" "" 200
check "POST /transactions" "POST" "/transactions" \
  "{\"cooperativeId\":\"$COOP_ID\",\"buyerType\":\"restoran\",\"volumeSold\":50,\"sellingPrice\":55000,\"logisticsCost\":5000,\"storageCost\":2000,\"paymentStatus\":\"paid\",\"date\":\"2026-07-04\"}" 201

# 6. Supply Chain
echo ""
echo "--- 6. Supply Chain ---"
check_body "GET /supply-chain/analysis" "GET" "/supply-chain/analysis?cooperativeId=$COOP_ID" "" "totalMargin"

# 7. Feasibility
echo ""
echo "--- 7. Feasibility ---"
check_body "POST /feasibility/calculate" "POST" "/feasibility/calculate" \
  '{"capex":50000000,"monthlyOpex":5000000,"monthlyRevenue":12000000,"discountRate":0.12,"projectionMonths":24}' \
  '"status":"layak"'
check "GET /feasibility/scenarios" "GET" "/feasibility/scenarios?cooperativeId=$COOP_ID" "" 200

# 8. Scenario & Sensitivity
echo ""
echo "--- 8. Scenario ---"
check "GET /scenarios/presets" "GET" "/scenarios/presets" "" 200
check_body "POST /scenarios/simulate" "POST" "/scenarios/simulate" \
  '{"capex":50000000,"monthlyOpex":5000000,"monthlyRevenue":12000000,"discountRate":0.12,"projectionMonths":24,"adjustments":{"priceAdjustment":-0.15,"costAdjustment":0.1}}' \
  '"status"'
check_body "POST /scenarios/switching-value" "POST" "/scenarios/switching-value" \
  '{"capex":50000000,"monthlyOpex":5000000,"monthlyRevenue":12000000,"discountRate":0.12,"projectionMonths":24}' \
  "breakEvenDelta"

# 9. Impact
echo ""
echo "--- 9. Impact ---"
check_body "GET /impact/metrics" "GET" "/impact/metrics?cooperativeId=$COOP_ID" "" "txValueIncrease"

# 10. AI Copilot
echo ""
echo "--- 10. AI Copilot ---"
check_body "POST /ai/summary" "POST" "/ai/summary" \
  '{"baseline":{"cooperativeName":"Test","totalMembers":45,"activeMembers":32,"activeRatio":0.71,"totalVolume":5000,"totalTxValue":67600000,"avgBuyPrice":32400,"avgSellPrice":44200,"spoilageRate":0.044,"marginPct":0.267}}' \
  "Kondisi Koperasi"
check_body "POST /ai/recommendation" "POST" "/ai/recommendation" \
  '{"feasibility":{"status":"layak"},"scenario":{},"biggestRisk":"fluktuasi harga"}' \
  "Rekomendasi"
check_body "POST /ai/presentation-summary" "POST" "/ai/presentation-summary" \
  '{"baseline":{"cooperativeName":"Test","totalMembers":45,"activeMembers":32,"totalTxValue":67600000},"feasibility":{"npv":126000000,"irr":1.59,"paybackPeriod":8,"bcr":1.71,"status":"layak"},"scenario":{},"impact":{}}' \
  "Ringkasan untuk Rapat"

# 11. Sync
echo ""
echo "--- 11. Sync ---"
check "GET /sync/pull" "GET" "/sync/pull?since=2020-01-01T00:00:00Z" "" 200
check "POST /sync/push (empty)" "POST" "/sync/push" '{"items":[]}' 200

# 12. Auth edge cases
echo ""
echo "--- 12. Auth edge cases ---"
check "GET /auth/me (no token)" "GET" "/auth/me" "" 400
check "POST /auth/register (duplicate)" "POST" "/auth/register" \
  '{"name":"Test","email":"manager@bahari.id","password":"password123","role":"cooperative_manager","cooperativeId":"00000000-0000-0000-0000-000000000001"}' 409

echo ""
echo "============================================"
echo " Results: $PASS passed, $FAIL failed"
echo "============================================"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
