# Testing Priority Plan - SAS Market Validation Platform

## 🎯 Critical Tests (Do First)

### 1. **Authentication & Basic Connectivity** ⭐⭐⭐
**Why**: Frontend can't do anything without this working
- ✅ Test JWT authentication (Bearer token)
- ✅ Test X-User-Id header (backwards compatibility)
- ✅ Verify CORS headers are set correctly
- **Impact**: Blocks all frontend interactions if broken

### 2. **Core Analysis Workflow** ⭐⭐⭐
**Why**: This is the main user journey
```
Create Analysis → View Analysis → Start Analysis → 
Check HITL → Resolve Checkpoint → View Results
```
**Test endpoints**:
- `POST /api/analyses` - Create analysis
- `GET /api/analyses/[id]` - View analysis
- `POST /api/analyses/[id]/start` - Start analysis
- `GET /api/hitl/checkpoints` - List checkpoints
- `POST /api/hitl/checkpoints/[id]/resolve` - Resolve checkpoint
- **Impact**: Core functionality - everything depends on this

### 3. **Supabase Connection** ⭐⭐⭐
**Why**: All data comes from Supabase
- ✅ Verify Supabase client connects
- ✅ Test database queries (list analyses, create analysis)
- ✅ Check environment variables are loaded
- **Impact**: No data without this

## 🚀 High Priority (New Features)

### 4. **Operational Feasibility Module** ⭐⭐
**Why**: Just implemented - need to verify it works
- Test module execution
- Verify it returns resource requirements, timeline, dependencies
- Check feasibility scoring works
- **Impact**: One of 7 modules - users expect it to work

### 5. **Preset CRUD Operations** ⭐⭐
**Why**: Users can save/load analysis templates
- `POST /api/presets` - Create preset
- `GET /api/presets/[id]` - Get preset
- `PATCH /api/presets/[id]` - Update preset
- `DELETE /api/presets/[id]` - Delete preset
- **Impact**: Convenience feature - improves UX

### 6. **Export Functionality** ⭐
**Why**: Users want to download reports
- `GET /api/analyses/[id]/export?format=pdf` - PDF export
- `GET /api/analyses/[id]/export?format=excel` - Excel export
- **Impact**: Nice-to-have feature

### 7. **JWT Authentication Integration** ⭐⭐
**Why**: Production-ready authentication
- Test Supabase JWT token validation
- Verify user extraction from token
- Test backwards compatibility with X-User-Id
- **Impact**: Security and production readiness

## 📋 Recommended Testing Order

### Phase 1: Critical Path (30 min)
1. ✅ Authentication test (JWT + X-User-Id)
2. ✅ Create analysis endpoint
3. ✅ List analyses endpoint
4. ✅ Start analysis endpoint
5. ✅ Check HITL checkpoints

### Phase 2: Core Workflow (45 min)
1. ✅ Complete full analysis workflow end-to-end
2. ✅ Test module execution (at least 2 modules)
3. ✅ Test HITL resolution
4. ✅ Verify Supabase data persistence

### Phase 3: New Features (30 min)
1. ✅ Operational Feasibility module execution
2. ✅ Preset CRUD (create, read, update, delete)
3. ✅ Export functionality (PDF/Excel)

### Phase 4: Edge Cases (20 min)
1. ✅ Error handling (invalid IDs, missing data)
2. ✅ Validation (invalid request bodies)
3. ✅ Permissions (user can only access own data)

## 🧪 Testing Approach

### Option A: Manual Testing (Quick)
```bash
# Test with curl/Postman
curl -H "X-User-Id: test-123" \
  https://sas-api-two.vercel.app/api/presets
```

### Option B: Automated Scripts
```bash
# Use test scripts
./test-endpoints.sh
./test-vercel-deployment.sh
```

### Option C: Frontend Integration Testing
- Connect Lovable UI to production API
- Test real user workflows
- Monitor for errors

## 🎯 What I Recommend Testing NEXT

**Immediate Priority**:
1. **Authentication** - Can the frontend connect?
2. **Create Analysis** - Can users create analyses?
3. **Start Analysis** - Does the orchestrator work?
4. **Supabase Connection** - Is data being saved?

**Then**:
5. **Operational Feasibility** - Does the new module work?
6. **Preset CRUD** - Can users save/load templates?
7. **Export** - Can users download reports?

## 📊 Success Criteria

Each test should verify:
- ✅ Returns correct HTTP status (200, 201, etc.)
- ✅ Response format matches expected schema
- ✅ No errors in logs
- ✅ Data persists in Supabase
- ✅ Frontend can consume the response

---

**Next Action**: Start with Phase 1 - Authentication & Basic Connectivity tests
