# Quick Test - You're at Prompt 15

You've run prompts 1-15. Let's verify everything works before continuing!

---

## 🧪 Quick Test Checklist

### ✅ Test 1: Connection & API Client (Foundation)
**Test if basic API connection works:**

```typescript
// In browser console or a test component
import { api } from '@/lib/api';
import { API_BASE_URL } from '@/config/api';

console.log('API Base URL:', API_BASE_URL);

api.listPresets()
  .then(data => console.log('✅ API Works!', data))
  .catch(err => console.error('❌ API Failed:', err));
```

**Expected:** ✅ See presets data in console

---

### ✅ Test 2: Authentication Hook
**Verify auth hook works:**

```typescript
// In any component
import { useAuth } from '@/hooks/useAuth';

const { userId, loading, error } = useAuth();
console.log('Auth:', { userId, loading, error });
```

**Expected:** ✅ `{ userId: 'test-user-123', loading: false, error: null }`

---

### ✅ Test 3: React Query Hooks - Presets
**Test preset hooks:**

```typescript
import { usePresets } from '@/hooks/usePresets';

const { data: presets, isLoading, error } = usePresets();
console.log('Presets:', { presets, isLoading, error });
```

**Expected:** ✅ List of presets from API

---

### ✅ Test 4: React Query Hooks - Analyses
**Test analysis hooks:**

```typescript
import { useAnalyses } from '@/hooks/useAnalyses';

const { data: analyses, isLoading, error } = useAnalyses();
console.log('Analyses:', { analyses, isLoading, error });
```

**Expected:** ✅ List of analyses (might be empty if none created yet)

---

### ✅ Test 5: Create Analysis Mutation
**Test if you can create an analysis:**

```typescript
import { useCreateAnalysis } from '@/hooks/useAnalyses';

const createAnalysis = useCreateAnalysis();

// Try creating
createAnalysis.mutate({
  name: 'Test Analysis',
  company_name: 'Test Company',
  selected_modules: ['market_demand']
}, {
  onSuccess: (data) => console.log('✅ Created!', data),
  onError: (err) => console.error('❌ Failed:', err)
});
```

**Expected:** ✅ Analysis created successfully, appears in list

---

### ✅ Test 6: Analysis Detail Page (Prompt 15)
**Test the detail page:**

1. Navigate to an analysis detail page (if you have one)
2. Or test the hook:

```typescript
import { useAnalysis } from '@/hooks/useAnalyses';

const { data: analysis, isLoading, error } = useAnalysis('analysis-id-here');
console.log('Analysis Detail:', { analysis, isLoading, error });
```

**Expected:** ✅ Analysis data loads (or 404 if ID doesn't exist)

---

### ✅ Test 7: Start Analysis Mutation
**Test starting an analysis:**

```typescript
import { useStartAnalysis } from '@/hooks/useAnalyses';

const startAnalysis = useStartAnalysis();

startAnalysis.mutate('analysis-id-here', {
  onSuccess: (data) => console.log('✅ Started!', data),
  onError: (err) => console.error('❌ Failed:', err)
});
```

**Expected:** ✅ Analysis starts successfully

---

## 🚨 Common Issues & Quick Fixes

### Issue 1: API Call Fails
**Symptoms:** Error in console, no data
**Check:**
- Is `API_BASE_URL` correct? Should be `https://sas-api-two.vercel.app`
- Is `X-User-Id` header included?
- Check Network tab - what's the response?

**Quick Fix:**
```typescript
// Verify API_BASE_URL
console.log('API URL:', API_BASE_URL);

// Check headers in apiCall function
console.log('Headers:', headers);
```

---

### Issue 2: TypeScript Errors
**Symptoms:** Red squiggles, build fails
**Fix:**
- Run `npm run build` or check TypeScript errors
- Verify types in `types/api.ts` match backend response
- Check imports are correct

---

### Issue 3: React Query Not Working
**Symptoms:** Data doesn't refresh, errors
**Check:**
- Is `QueryClientProvider` wrapping your app?
- Are hooks using correct query keys?
- Check React Query DevTools (if installed)

**Quick Fix:**
```typescript
// Verify QueryClient is set up
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();
// Make sure this wraps your app
```

---

### Issue 4: Component Won't Render
**Symptoms:** Blank screen, error in console
**Check:**
- Browser console for errors
- React error boundary
- Check if hooks are used correctly (inside components)

---

## ✅ Quick Integration Test

**Create a test page component:**

```typescript
// TestPage.tsx or TestIntegration.tsx
import { useAuth } from '@/hooks/useAuth';
import { usePresets } from '@/hooks/usePresets';
import { useAnalyses } from '@/hooks/useAnalyses';
import { api } from '@/lib/api';

export function TestIntegration() {
  const { userId, loading: authLoading } = useAuth();
  const { data: presets, isLoading: presetsLoading } = usePresets();
  const { data: analyses, isLoading: analysesLoading } = useAnalyses();

  const testApiCall = async () => {
    try {
      const result = await api.listPresets();
      console.log('✅ API Call Success:', result);
    } catch (error) {
      console.error('❌ API Call Failed:', error);
    }
  };

  return (
    <div className="p-4">
      <h1>Integration Test</h1>
      
      <div className="mb-4">
        <h2>Auth Hook:</h2>
        <p>User ID: {authLoading ? 'Loading...' : userId || 'None'}</p>
      </div>

      <div className="mb-4">
        <h2>Presets:</h2>
        {presetsLoading ? (
          <p>Loading presets...</p>
        ) : (
          <p>Found {presets?.length || 0} presets</p>
        )}
      </div>

      <div className="mb-4">
        <h2>Analyses:</h2>
        {analysesLoading ? (
          <p>Loading analyses...</p>
        ) : (
          <p>Found {analyses?.data?.length || 0} analyses</p>
        )}
      </div>

      <button onClick={testApiCall} className="bg-blue-500 text-white px-4 py-2 rounded">
        Test API Call
      </button>
    </div>
  );
}
```

**Add this to your app and check:**
- ✅ Does it render?
- ✅ Do all hooks work?
- ✅ Does API call work?

---

## 🎯 What to Test Right Now

**Priority Order:**

1. **API Connection** (Test 1) - Most important
2. **Auth Hook** (Test 2) - Required for everything
3. **List Presets** (Test 3) - Simplest data fetch
4. **List Analyses** (Test 4) - Core data
5. **Create Analysis** (Test 5) - Core functionality
6. **Detail Page** (Test 6) - What you just built (Prompt 15)

---

## 🚦 Decision Tree

**After Testing:**

### ✅ Everything Works?
→ Continue with Prompt 16 (HITL Checkpoint Component)

### ⚠️ Some Issues Found?
→ Fix issues before continuing
→ Test again after fixes

### ❌ Major Issues?
→ Stop here
→ Debug systematically
→ Test each component individually

---

## 💡 Pro Tip

**Use Browser DevTools:**
- **Network Tab** - See all API calls
- **Console** - See all logs/errors
- **React DevTools** - Check component state

**Check Network Tab:**
1. Open DevTools (F12)
2. Go to Network tab
3. Make an API call
4. Check:
   - ✅ Status code (200 = good)
   - ✅ Response data
   - ✅ Headers (X-User-Id included?)

---

## 📋 Test Summary

**You're at Prompt 15 (Analysis Detail Page)**

**Test These:**
- [ ] API connection works
- [ ] Auth hook returns userId
- [ ] Can list presets
- [ ] Can list analyses
- [ ] Can create analysis
- [ ] Analysis detail page works
- [ ] Can start analysis

**If all ✅ → Continue to Prompt 16**
**If any ❌ → Fix before continuing**

---

**Quick test command:**
Add the `TestIntegration` component above to your app and check the console/logs!
