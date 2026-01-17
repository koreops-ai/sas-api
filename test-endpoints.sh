#!/bin/bash
# Test script for SAS Market Validation Platform API
# Usage: ./test-endpoints.sh [base-url] [user-id]
# Example: ./test-endpoints.sh http://localhost:3000 test-user-123

BASE_URL=${1:-"http://localhost:3000"}
USER_ID=${2:-"test-user-123"}
AUTH_HEADER="X-User-Id: ${USER_ID}"

echo "🧪 Testing SAS Market Validation Platform API"
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
    response=$(curl -s -w "\n%{http_code}" -H "${AUTH_HEADER}" "${BASE_URL}${endpoint}")
  elif [ "$method" = "POST" ] || [ "$method" = "PATCH" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "${method}" -H "${AUTH_HEADER}" -H "Content-Type: application/json" -d "${data}" "${BASE_URL}${endpoint}")
  elif [ "$method" = "DELETE" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "${method}" -H "${AUTH_HEADER}" "${BASE_URL}${endpoint}")
  fi
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')
  
  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓${NC} (HTTP ${http_code})"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  else
    echo -e "${RED}✗${NC} (HTTP ${http_code})"
    echo "$body" | jq '.' 2>/dev/null || echo "$body"
  fi
  echo ""
}

# Test 1: Get Presets
test_endpoint "GET" "/api/presets" "" "GET /api/presets - List presets"

# Test 2: Create Analysis
CREATE_ANALYSIS_DATA='{
  "name": "Test Analysis",
  "company_name": "Test Company",
  "product_name": "Test Product",
  "target_market": "Singapore",
  "selected_modules": ["market_demand", "competitive_intelligence"],
  "social_platforms": ["reddit", "twitter"]
}'
test_endpoint "POST" "/api/analyses" "${CREATE_ANALYSIS_DATA}" "POST /api/analyses - Create analysis"

# Extract analysis ID from response (you'll need to manually update this)
# ANALYSIS_ID="analysis-id-here"

# Test 3: List Analyses
test_endpoint "GET" "/api/analyses" "" "GET /api/analyses - List analyses"

# Test 4: Create Preset
CREATE_PRESET_DATA='{
  "name": "Test Preset",
  "description": "A test preset",
  "modules": ["market_demand", "revenue_intelligence"],
  "social_platforms": ["reddit"]
}'
test_endpoint "POST" "/api/presets" "${CREATE_PRESET_DATA}" "POST /api/presets - Create preset"

echo "✅ Testing complete!"
echo ""
echo "📝 Note: To test with JWT authentication, replace X-User-Id header with:"
echo "   Authorization: Bearer <your-supabase-jwt-token>"
