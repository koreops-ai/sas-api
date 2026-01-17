#!/bin/bash
# Test script for Vercel-deployed SAS Market Validation Platform API
# Usage: ./test-vercel-deployment.sh [vercel-url]
# Example: ./test-vercel-deployment.sh https://sas-market-validation-api.vercel.app

BASE_URL=${1:-""}
USER_ID="test-user-123"

if [ -z "$BASE_URL" ]; then
  echo "❌ Error: Please provide your Vercel deployment URL"
  echo "Usage: ./test-vercel-deployment.sh https://your-project.vercel.app"
  exit 1
fi

AUTH_HEADER="X-User-Id: ${USER_ID}"

echo "🧪 Testing SAS Market Validation Platform API on Vercel"
echo "📍 Base URL: ${BASE_URL}"
echo "👤 User ID: ${USER_ID}"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
  local method=$1
  local endpoint=$2
  local data=$3
  local description=$4
  
  echo -n "Testing ${description}... "
  
  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" -H "${AUTH_HEADER}" "${BASE_URL}${endpoint}" --max-time 30)
  elif [ "$method" = "POST" ] || [ "$method" = "PATCH" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "${method}" -H "${AUTH_HEADER}" -H "Content-Type: application/json" -d "${data}" "${BASE_URL}${endpoint}" --max-time 30)
  elif [ "$method" = "DELETE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "${method}" -H "${AUTH_HEADER}" "${BASE_URL}${endpoint}" --max-time 30)
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓${NC} (HTTP ${http_code})"
    echo "$body" | jq '.' 2>/dev/null || echo "$body" | head -5
  elif [ "$http_code" = "000" ]; then
    echo -e "${RED}✗${NC} (Connection failed - check URL and deployment status)"
  else
    echo -e "${RED}✗${NC} (HTTP ${http_code})"
    echo "$body" | jq '.' 2>/dev/null || echo "$body" | head -10
  fi
  echo ""
}

# Test 1: Health check / Presets
test_endpoint "GET" "/api/presets" "" "GET /api/presets - List presets"

# Test 2: Create Analysis
CREATE_ANALYSIS_DATA='{
  "name": "Vercel Test Analysis",
  "company_name": "Test Company",
  "product_name": "Test Product",
  "target_market": "Singapore",
  "selected_modules": ["market_demand"]
}'
test_endpoint "POST" "/api/analyses" "${CREATE_ANALYSIS_DATA}" "POST /api/analyses - Create analysis"

# Test 3: List Analyses
test_endpoint "GET" "/api/analyses" "" "GET /api/analyses - List analyses"

echo "✅ Testing complete!"
echo ""
echo "💡 Tip: To test with JWT authentication, replace X-User-Id header with:"
echo "   Authorization: Bearer <your-supabase-jwt-token>"
