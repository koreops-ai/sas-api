# Testing Guide - SAS Market Validation Platform API

This guide explains how to test the API endpoints locally and in production.

## Prerequisites

1. **Environment Variables** - Create `.env.local` file:
```bash
SUPABASE_URL=https://ufxvqmbfevbpvfqqysjr.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here  # For JWT auth
ANTHROPIC_API_KEY=your_anthropic_key_here
```

2. **Install Dependencies** (if not already done):
```bash
npm install
```

3. **Build the Project**:
```bash
npm run build
```

## Starting the Dev Server

```bash
npm run dev
```

The server will start on `http://localhost:3000` by default.

## Authentication Methods

### Method 1: X-User-Id Header (Development/Testing)
For quick testing, use the `X-User-Id` header:
```bash
curl -H "X-User-Id: test-user-123" http://localhost:3000/api/analyses
```

### Method 2: JWT Bearer Token (Production)
For production, use Supabase JWT tokens:
```bash
curl -H "Authorization: Bearer <your-jwt-token>" http://localhost:3000/api/analyses
```

## Testing Endpoints

### Quick Test Script
Use the provided test script:
```bash
chmod +x test-endpoints.sh
./test-endpoints.sh http://localhost:3000 test-user-123
```

### Manual Testing Examples

#### 1. List Presets
```bash
curl -H "X-User-Id: test-user-123" \
  http://localhost:3000/api/presets
```

#### 2. Create Analysis
```bash
curl -X POST \
  -H "X-User-Id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Analysis",
    "company_name": "Acme Corp",
    "product_name": "Widget Pro",
    "target_market": "Singapore",
    "selected_modules": ["market_demand", "revenue_intelligence"],
    "social_platforms": ["reddit", "twitter"]
  }' \
  http://localhost:3000/api/analyses
```

#### 3. Get Analysis Details
```bash
curl -H "X-User-Id: test-user-123" \
  http://localhost:3000/api/analyses/{analysis-id}
```

#### 4. Start Analysis
```bash
curl -X POST \
  -H "X-User-Id: test-user-123" \
  http://localhost:3000/api/analyses/{analysis-id}/start
```

#### 5. Create Preset
```bash
curl -X POST \
  -H "X-User-Id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Preset",
    "description": "A custom preset",
    "modules": ["market_demand", "financial_modeling"],
    "social_platforms": ["reddit"]
  }' \
  http://localhost:3000/api/presets
```

#### 6. Update Preset
```bash
curl -X PATCH \
  -H "X-User-Id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Preset Name",
    "modules": ["market_demand", "risk_assessment"]
  }' \
  http://localhost:3000/api/presets/{preset-id}
```

#### 7. Delete Preset
```bash
curl -X DELETE \
  -H "X-User-Id: test-user-123" \
  http://localhost:3000/api/presets/{preset-id}
```

#### 8. Export Analysis (PDF)
```bash
curl -H "X-User-Id: test-user-123" \
  http://localhost:3000/api/analyses/{analysis-id}/export?format=pdf \
  --output analysis.pdf
```

#### 9. Export Analysis (Excel)
```bash
curl -H "X-User-Id: test-user-123" \
  http://localhost:3000/api/analyses/{analysis-id}/export?format=excel \
  --output analysis.xlsx
```

#### 10. Get HITL Checkpoints
```bash
curl -H "X-User-Id: test-user-123" \
  http://localhost:3000/api/hitl/checkpoints
```

#### 11. Resolve HITL Checkpoint
```bash
curl -X POST \
  -H "X-User-Id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "checkpoint_id": "{checkpoint-id}",
    "action": "approve_all",
    "comment": "Looks good!"
  }' \
  http://localhost:3000/api/hitl/checkpoints/{checkpoint-id}/resolve
```

## Using Postman

1. **Import Collection**: Create a new collection
2. **Set Base URL**: `http://localhost:3000`
3. **Set Headers**:
   - `X-User-Id`: `test-user-123` (for development)
   - OR `Authorization`: `Bearer <jwt-token>` (for production)
4. **Test Endpoints**: Import the endpoints above

## Using cURL with JWT (Production)

```bash
# Get JWT token from Supabase Auth
JWT_TOKEN="your-jwt-token-here"

# Test with JWT
curl -H "Authorization: Bearer ${JWT_TOKEN}" \
  http://localhost:3000/api/analyses
```

## Expected Response Format

All endpoints return JSON in this format:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Common Issues

### 1. Missing Environment Variables
**Error**: `Missing Supabase environment variables`
**Solution**: Create `.env.local` file with required variables

### 2. Port Already in Use
**Error**: `EADDRINUSE: address already in use`
**Solution**: Kill the process using port 3000 or change the port

### 3. Module Not Found (Export)
**Error**: `Cannot find module 'pdfkit'`
**Solution**: Run `npm install` to install all dependencies

### 4. Authentication Failed
**Error**: `Unauthorized: Missing or invalid authentication token`
**Solution**: 
- Check that `X-User-Id` header is set (development)
- Or verify JWT token is valid (production)

## Testing Workflow

1. **Start Dev Server**: `npm run dev`
2. **Test Authentication**: Verify `/api/presets` returns 200
3. **Create Analysis**: POST to `/api/analyses`
4. **Start Analysis**: POST to `/api/analyses/{id}/start`
5. **Check HITL**: GET `/api/hitl/checkpoints`
6. **Resolve Checkpoint**: POST to `/api/hitl/checkpoints/{id}/resolve`
7. **Export Results**: GET `/api/analyses/{id}/export?format=pdf`

## Performance Testing

For load testing, use tools like:
- **Apache Bench**: `ab -n 100 -c 10 http://localhost:3000/api/presets`
- **Artillery**: `artillery quick --count 10 --num 100 http://localhost:3000/api/presets`

## Debugging

Enable verbose logging:
```bash
DEBUG=* npm run dev
```

Check Vercel logs:
```bash
vercel logs
```

---

**Note**: Make sure your Supabase database has the required tables and your environment variables are correctly set before testing!
