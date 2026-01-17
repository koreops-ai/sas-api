# Lovable UI Setup Prompts

Copy and paste these prompts into Lovable to set up your frontend to connect to the backend API.

---

## 📋 Prompt 1: Environment Configuration

```
Create an environment configuration file at lib/config.ts that sets up the API base URL. Use environment variable NEXT_PUBLIC_API_URL with fallback to production URL https://sas-api-two.vercel.app. Export a constant API_BASE_URL.
```

**Expected output:**
```typescript
// lib/config.ts
export const API_BASE_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  'https://sas-api-two.vercel.app';
```

---

## 📋 Prompt 2: API Client Service

```
Create an API client service at lib/api.ts that handles all API calls to the backend. It should:
1. Use API_BASE_URL from lib/config.ts
2. Include authentication headers (X-User-Id for now, support JWT later)
3. Handle JSON requests/responses
4. Throw errors for non-2xx responses
5. Return data from the success response format { success: true, data: ... }

Include these methods:
- apiCall<T>(endpoint, options) - generic API call function
- api.listPresets() - GET /api/presets
- api.listAnalyses(limit, offset, status) - GET /api/analyses
- api.getAnalysis(id) - GET /api/analyses/[id]
- api.createAnalysis(data) - POST /api/analyses
- api.updateAnalysis(id, data) - PATCH /api/analyses/[id]
- api.deleteAnalysis(id) - DELETE /api/analyses/[id]
- api.startAnalysis(id) - POST /api/analyses/[id]/start
- api.getAnalysisModules(id) - GET /api/analyses/[id]/modules
- api.listCheckpoints() - GET /api/hitl/checkpoints
- api.resolveCheckpoint(id, data) - POST /api/hitl/checkpoints/[id]/resolve
```

---

## 📋 Prompt 3: Authentication Hook

```
Create a React hook at hooks/useAuth.ts that:
1. Gets the current user ID from your auth system (Supabase or whatever you're using)
2. Returns { userId, loading, error }
3. If using Supabase, extract user.id from the session
4. Provide a temporary fallback that returns 'test-user-123' for testing
```

**Expected output:**
```typescript
// hooks/useAuth.ts
export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Get from your auth system
  // For now, return test user
  return { userId: 'test-user-123', loading: false, error: null };
}
```

---

## 📋 Prompt 4: React Query Hooks for Analyses

```
Create React Query hooks at hooks/useAnalyses.ts using @tanstack/react-query:
1. useAnalyses(limit, offset, status) - list analyses with query
2. useAnalysis(id) - get single analysis
3. useCreateAnalysis() - mutation to create analysis
4. useUpdateAnalysis() - mutation to update analysis
5. useDeleteAnalysis() - mutation to delete analysis
6. useStartAnalysis() - mutation to start analysis

All mutations should invalidate the analyses list query on success. Use the API client from lib/api.ts and authentication from hooks/useAuth.ts.
```

---

## 📋 Prompt 5: React Query Hooks for Presets

```
Create React Query hooks at hooks/usePresets.ts using @tanstack/react-query:
1. usePresets() - list all presets
2. usePreset(id) - get single preset
3. useCreatePreset() - mutation to create preset
4. useUpdatePreset() - mutation to update preset
5. useDeletePreset() - mutation to delete preset

All mutations should invalidate presets query on success. Use the API client from lib/api.ts.
```

---

## 📋 Prompt 6: React Query Hooks for HITL

```
Create React Query hooks at hooks/useHITL.ts using @tanstack/react-query:
1. useCheckpoints() - list pending checkpoints
2. useResolveCheckpoint() - mutation to resolve checkpoint

Use the API client from lib/api.ts. The resolve mutation should accept action: 'approve_all' | 'request_revision' | 'reject', and optional comment and adjustments.
```

---

## 📋 Prompt 7: Connection Test Component

```
Create a test component at components/APIConnectionTest.tsx that:
1. Tests the API connection on mount
2. Calls GET /api/presets endpoint
3. Shows loading state while testing
4. Displays success message with green checkmark if connected
5. Displays error message in red if failed
6. Shows the API base URL being tested
7. Has a "Retry" button to test again
```

---

## 📋 Prompt 8: Update API Client to Use Auth Hook

```
Update lib/api.ts to use the useAuth hook for getting userId. Modify apiCall function to automatically include X-User-Id header from the auth hook. If userId is not available, throw an error. Also support Authorization: Bearer token if token is provided in options.
```

---

## 📋 Prompt 9: Error Handling Utility

```
Create an error handling utility at lib/api-errors.ts that:
1. Formats API errors into user-friendly messages
2. Handles different HTTP status codes (401, 403, 404, 500)
3. Extracts error messages from API responses
4. Provides default error messages for unknown errors
5. Logs errors to console in development
```

---

## 📋 Prompt 10: TypeScript Types for API

```
Create TypeScript types at types/api.ts based on the backend API response format. Include types for:
- Analysis (with all fields from backend)
- AnalysisModule
- Preset
- HITLCheckpoint
- CreateAnalysisInput
- UpdateAnalysisInput
- CreatePresetInput
- UpdatePresetInput
- ApiResponse<T> generic type

Match the types exactly as they come from the backend: { success: boolean, data?: T, error?: string }
```

---

## 📋 Prompt 11: Environment Variable Setup

```
Add NEXT_PUBLIC_API_URL environment variable to .env.local file. Set it to https://sas-api-two.vercel.app. Create a .env.example file with NEXT_PUBLIC_API_URL=https://sas-api-two.vercel.app as a template.
```

---

## 📋 Prompt 12: API Client with Better Error Handling

```
Update lib/api.ts to use the error handling utility. Wrap all API calls in try-catch. Format errors using the error handler. Return formatted error messages to the caller. Log detailed errors in development mode.
```

---

## 📋 Prompt 13: Loading States Component

```
Create a reusable loading spinner component at components/LoadingSpinner.tsx that shows a centered spinner with optional text message. Make it customizable with size (small, medium, large) and color props.
```

---

## 📋 Prompt 14: Test Connection on App Load

```
Add a connection test to the main app component or layout that:
1. Tests API connection when app loads
2. Shows a toast/notification if connection fails
3. Allows user to retry connection
4. Stores connection status in context/state
5. Only shows error if connection fails, not on loading
```

---

## 📋 Prompt 15: Integration with Existing Analysis Components

```
Update the existing analysis list component to use the useAnalyses hook from hooks/useAnalyses.ts. Replace any hardcoded data or mock API calls with the real API calls. Add proper loading and error states using the LoadingSpinner and error handling utilities.
```

---

## 📋 Prompt 16: Create Analysis Form Integration

```
Update the create analysis form to use useCreateAnalysis mutation from hooks/useAnalyses.ts. On successful creation, show success toast and redirect to the analysis detail page. Handle validation errors and API errors gracefully. Show loading state while creating.
```

---

## 📋 Prompt 17: Analysis Detail Page Integration

```
Update the analysis detail page to:
1. Use useAnalysis(id) hook to fetch data
2. Show loading spinner while loading
3. Display error if fetch fails
4. Use useStartAnalysis mutation to start analysis
5. Poll or refetch periodically to check status
6. Show HITL checkpoints if status is 'hitl_pending'
```

---

## 📋 Prompt 18: HITL Checkpoint Component

```
Create a component at components/HITLCheckpoint.tsx that:
1. Displays checkpoint data in a readable format
2. Shows the module type and status
3. Displays the data snapshot
4. Has buttons for: Approve All, Request Revision, Reject
5. Uses useResolveCheckpoint mutation
6. Shows loading state during resolution
7. Refreshes the checkpoint list after resolution
```

---

## 📋 Prompt 19: Export Analysis Button

```
Add an export button to the analysis detail page that:
1. Shows "Export PDF" and "Export Excel" options
2. Opens export URL in new tab: {API_BASE_URL}/api/analyses/{id}/export?format={pdf|excel}
3. Adds authentication headers if needed
4. Shows loading state while exporting
5. Handles errors gracefully
```

---

## 📋 Prompt 20: Preset Selector Component

```
Create a preset selector component that:
1. Uses usePresets hook to fetch available presets
2. Displays presets in a dropdown or list
3. When selected, populates the create analysis form
4. Shows loading while fetching presets
5. Handles errors gracefully
```

---

## 🚀 Quick Start Sequence

**Run these prompts in order for fastest setup:**

1. **Prompt 11** - Environment Variable Setup
2. **Prompt 1** - Environment Configuration  
3. **Prompt 3** - Authentication Hook
4. **Prompt 2** - API Client Service
5. **Prompt 10** - TypeScript Types
6. **Prompt 7** - Connection Test Component

**Then test:**
7. Add APIConnectionTest component to your app
8. Verify it shows ✅ Connected

**Then integrate:**
9. **Prompt 4** - React Query Hooks for Analyses
10. **Prompt 15** - Integration with Existing Components
11. **Prompt 16** - Create Analysis Form Integration

---

## 📝 Customization Notes

- Replace `test-user-123` with your actual user ID from Supabase auth
- For JWT auth, update the API client to use `Authorization: Bearer` header
- Adjust API base URL if using a different deployment
- Customize error messages based on your UI design system

---

## 🧪 Testing Checklist

After setup, verify:
- [ ] Environment variable is set correctly
- [ ] API client can make requests
- [ ] Connection test component shows ✅
- [ ] Can list analyses
- [ ] Can create analysis
- [ ] Can start analysis
- [ ] Can view HITL checkpoints
- [ ] Can resolve checkpoints
- [ ] Can list presets

---

**Copy these prompts into Lovable one at a time, starting with Prompt 11 (Environment Setup)!**
