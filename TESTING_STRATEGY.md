# Testing Strategy - Incremental vs Batch

## ✅ Recommended: Test As You Go (Incremental)

**Why?**
- 🐛 Catch errors early
- 🔍 Easier to debug (know exactly what broke)
- ⚡ Faster feedback
- 🎯 Verify each piece works before building on it

---

## 📋 Incremental Testing Plan

### Phase 1: Foundation (Test after each checkpoint)

#### Checkpoint 1: Config & Auth (2 prompts)
1. ✅ `src/config/api.ts` - Already done
2. **Prompt 2** - Create Authentication Hook
3. **Test**: Verify hook returns `{ userId: 'test-user-123', loading: false }`

**Quick Test:**
```typescript
// In a component
const { userId, loading } = useAuth();
console.log('User ID:', userId); // Should be 'test-user-123'
```

---

#### Checkpoint 2: API Client (1 prompt)
4. **Prompt 1** - Update API Client
5. **Test**: Try calling `api.listPresets()`

**Quick Test:**
```typescript
// In a component
useEffect(() => {
  api.listPresets()
    .then(data => console.log('✅ API works!', data))
    .catch(err => console.error('❌ API failed:', err));
}, []);
```

---

#### Checkpoint 3: Connection Test (1 prompt)
6. **Prompt 7** - Connection Test Component
7. **Test**: Add component to app and verify it shows ✅ Connected

**Quick Test:**
- Add `<APIConnectionTest />` to your main App component
- Should see green checkmark if backend is reachable

---

### Phase 2: Core Features (Test after each checkpoint)

#### Checkpoint 4: Types & Errors (2 prompts)
8. **Prompt 8** - TypeScript Types
9. **Prompt 9** - Error Handling Utility
10. **Test**: Verify TypeScript compiles, error handler works

**Quick Test:**
```typescript
// Should compile without errors
import { Analysis } from '@/types/api';
import { formatApiError } from '@/lib/api-errors';
```

---

#### Checkpoint 5: React Query Hooks - Analyses (1 prompt)
11. **Prompt 4** - React Query Hooks for Analyses
12. **Test**: Try `useAnalyses()` in a component

**Quick Test:**
```typescript
// In a component
const { data: analyses, isLoading, error } = useAnalyses();
console.log('Analyses:', analyses);
```

---

#### Checkpoint 6: React Query Hooks - Presets (1 prompt)
13. **Prompt 5** - React Query Hooks for Presets
14. **Test**: Try `usePresets()` in a component

**Quick Test:**
```typescript
const { data: presets } = usePresets();
console.log('Presets:', presets);
```

---

#### Checkpoint 7: React Query Hooks - HITL (1 prompt)
15. **Prompt 6** - React Query Hooks for HITL
16. **Test**: Try `useCheckpoints()` in a component

---

### Phase 3: Component Integration (Test each integration)

#### Checkpoint 8: Analysis List (1 prompt)
17. **Prompt 13** - Integrate Analysis List Component
18. **Test**: Should see real data from API (not mock data)

---

#### Checkpoint 9: Create Form (1 prompt)
19. **Prompt 14** - Create Analysis Form Integration
20. **Test**: Create an analysis, verify it appears in list

---

#### Checkpoint 10: Detail Page (1 prompt)
21. **Prompt 15** - Analysis Detail Page Integration
22. **Test**: View analysis details, start analysis

---

### Phase 4: Advanced Features (Test as needed)

- **Prompt 16** - HITL Checkpoint Component → Test resolving checkpoints
- **Prompt 17** - Export Buttons → Test PDF/Excel export
- **Prompt 18** - Preset Selector → Test selecting presets
- **Prompt 19** - Update Create Form → Test preset integration
- **Prompt 20** - Modules Display → Test showing modules

---

## 🎯 Recommended Approach

### ✅ DO: Test After Checkpoints

```
Prompt 1-2 → Test Auth ✅
Prompt 3-4 → Test API Client ✅
Prompt 7 → Test Connection ✅
Prompt 4 → Test Hooks ✅
Prompt 13 → Test Integration ✅
```

### ❌ DON'T: Run All Then Test

```
Run all 20 prompts → Try to test everything → 
Find 5 different errors → Don't know which prompt broke what ❌
```

---

## 🧪 Testing Checklist

After each checkpoint, verify:

- [ ] ✅ No TypeScript errors
- [ ] ✅ No console errors
- [ ] ✅ Component renders without crashing
- [ ] ✅ API calls work (check Network tab)
- [ ] ✅ Data displays correctly
- [ ] ✅ Loading states show
- [ ] ✅ Errors are handled gracefully

---

## ⚡ Quick Testing Commands

**Test in Browser Console:**
```javascript
// Test API directly
fetch('https://sas-api-two.vercel.app/api/presets', {
  headers: { 'X-User-Id': 'test-user-123' }
})
  .then(r => r.json())
  .then(d => console.log('✅', d))
  .catch(e => console.error('❌', e));
```

**Test in Component:**
```typescript
// Add this to any component
useEffect(() => {
  console.log('Testing:', {
    userId: useAuth().userId,
    apiBase: API_BASE_URL
  });
}, []);
```

---

## 🚨 When to Stop and Debug

Stop and fix if:
- ❌ TypeScript errors (red squiggles)
- ❌ Component won't render
- ❌ API returns error status
- ❌ Data not displaying
- ❌ Console shows errors

**Don't continue** until current checkpoint works!

---

## 📊 Time Estimate

**Incremental (Recommended):**
- ~5 minutes per checkpoint
- ~2-3 hours total with testing

**Batch (Not Recommended):**
- ~1 hour to run all prompts
- ~2-3 hours to debug multiple errors
- ~3-4 hours total

**Incremental is faster overall!**

---

## 🎯 Summary

**Recommended Strategy:**
1. Run 2-3 prompts
2. Test the checkpoint
3. Fix any issues
4. Continue to next checkpoint

**Starting Now:**
1. ✅ `src/config/api.ts` - Done
2. Run **Prompt 2** (Auth Hook) → **Test**
3. Run **Prompt 1** (API Client) → **Test**
4. Run **Prompt 7** (Connection Test) → **Test**
5. Continue...

**Test early, test often, catch bugs fast! 🐛→✅**
