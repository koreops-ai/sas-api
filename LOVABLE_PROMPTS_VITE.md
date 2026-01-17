# Lovable UI Setup Prompts - Vite Project

Updated prompts for Vite (not Next.js) and Lovable's structure.

---

## ✅ Already Done
- ✅ `src/config/api.ts` created with API_BASE_URL

---

## 📋 Prompt 1: Update API Client to Use Config

```
Update the API client at lib/api.ts or src/lib/api.ts to use API_BASE_URL from src/config/api.ts. Create an apiCall function that:
1. Takes endpoint (string) and options (RequestInit)
2. Prepends API_BASE_URL to endpoint
3. Includes X-User-Id header from authentication
4. Handles JSON requests/responses
5. Throws errors for non-2xx responses
6. Returns data from { success: true, data: ... } response format

Export an api object with these methods:
- api.listPresets()
- api.listAnalyses(limit, offset, status)
- api.getAnalysis(id)
- api.createAnalysis(data)
- api.updateAnalysis(id, data)
- api.deleteAnalysis(id)
- api.startAnalysis(id)
- api.getAnalysisModules(id)
- api.listCheckpoints()
- api.resolveCheckpoint(id, data)
```

---

## 📋 Prompt 2: Create Authentication Hook

```
Create a React hook at hooks/useAuth.ts or src/hooks/useAuth.ts that:
1. Gets the current user ID from your auth system
2. Returns { userId: string | null, loading: boolean, error: Error | null }
3. For now, return a fallback userId: 'test-user-123' for testing
4. If using Supabase later, extract user.id from session

Use useState and useEffect if needed.
```

---

## 📋 Prompt 3: Update API Client to Use Auth Hook

```
Update the API client (lib/api.ts or src/lib/api.ts) to accept userId as a parameter or get it from a context. The apiCall function should automatically include X-User-Id header. If userId is null or undefined, throw an error saying "User not authenticated".

Alternatively, pass userId to each API method and include it in headers.
```

---

## 📋 Prompt 4: Create React Query Hooks for Analyses

```
Create React Query hooks at hooks/useAnalyses.ts or src/hooks/useAnalyses.ts using @tanstack/react-query:
1. useAnalyses(limit, offset, status) - query to list analyses
2. useAnalysis(id) - query to get single analysis
3. useCreateAnalysis() - mutation to create analysis
4. useUpdateAnalysis() - mutation to update analysis
5. useDeleteAnalysis() - mutation to delete analysis
6. useStartAnalysis() - mutation to start analysis

All mutations should invalidate ['analyses'] query on success. Use the API client from lib/api.ts and get userId from useAuth hook.
```

---

## 📋 Prompt 5: Create React Query Hooks for Presets

```
Create React Query hooks at hooks/usePresets.ts or src/hooks/usePresets.ts using @tanstack/react-query:
1. usePresets() - query to list all presets
2. usePreset(id) - query to get single preset
3. useCreatePreset() - mutation to create preset
4. useUpdatePreset() - mutation to update preset
5. useDeletePreset() - mutation to delete preset

All mutations should invalidate ['presets'] query on success. Use the API client from lib/api.ts.
```

---

## 📋 Prompt 6: Create React Query Hooks for HITL

```
Create React Query hooks at hooks/useHITL.ts or src/hooks/useHITL.ts using @tanstack/react-query:
1. useCheckpoints() - query to list pending checkpoints
2. useResolveCheckpoint() - mutation to resolve checkpoint

The resolve mutation should accept:
- checkpointId: string
- action: 'approve_all' | 'request_revision' | 'reject'
- comment?: string
- adjustments?: object

Invalidate ['checkpoints'] query on success. Use the API client from lib/api.ts.
```

---

## 📋 Prompt 7: Create Connection Test Component

```
Create a test component at components/APIConnectionTest.tsx or src/components/APIConnectionTest.tsx that:
1. Tests the API connection when mounted
2. Calls GET /api/presets endpoint using the API client
3. Shows loading state while testing
4. Displays green checkmark and "Connected" message if successful
5. Displays red error message if failed
6. Shows the API base URL being tested (from src/config/api.ts)
7. Has a "Retry" button to test again
8. Uses React Query's useQuery for the test call

Style it nicely with Tailwind classes or your design system.
```

---

## 📋 Prompt 8: Create TypeScript Types

```
Create TypeScript types at types/api.ts or src/types/api.ts based on backend API responses. Include:

- type ApiResponse<T> = { success: boolean; data?: T; error?: string; message?: string }

- type Analysis = { id, user_id, name, company_name, product_name, description, target_market, status, progress, selected_modules, social_platforms, preset_id, estimated_cost, actual_cost, created_at, updated_at, completed_at }

- type AnalysisModule = { id, analysis_id, module_type, status, progress, started_at, completed_at, cost, data, error }

- type Preset = { id, name, description, user_id, team_id, is_system, modules, social_platforms, created_at }

- type HITLCheckpoint = { id, analysis_id, module_id, module_type, status, data_snapshot, reviewer_id, reviewer_comment, action, adjustments, created_at, resolved_at }

- type CreateAnalysisInput = { name, company_name, product_name?, description?, target_market?, selected_modules, social_platforms?, preset_id? }

- type CreatePresetInput = { name, description?, team_id?, modules, social_platforms? }

- type UpdatePresetInput = { name?, description?, modules?, social_platforms? }
```

---

## 📋 Prompt 9: Error Handling Utility

```
Create an error handling utility at lib/api-errors.ts or src/lib/api-errors.ts that:
1. Takes an error (Error or Response) and formats it into user-friendly message
2. Handles HTTP status codes: 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 500 (Server Error)
3. Extracts error message from API response { error: string }
4. Provides default messages for unknown errors
5. Logs full error details to console in development mode
6. Returns formatted error message string

Export function: formatApiError(error: unknown): string
```

---

## 📋 Prompt 10: Update API Client with Error Handling

```
Update the API client (lib/api.ts or src/lib/api.ts) to use the error handling utility. Wrap all fetch calls in try-catch. Use formatApiError from lib/api-errors.ts to format errors before throwing. Make sure errors are properly typed and logged.
```

---

## 📋 Prompt 11: Loading Spinner Component

```
Create a reusable loading spinner component at components/LoadingSpinner.tsx or src/components/LoadingSpinner.tsx that:
1. Shows a centered spinner/loading animation
2. Accepts optional text prop for message
3. Accepts size prop: 'sm' | 'md' | 'lg' (default: 'md')
4. Accepts className prop for custom styling
5. Uses Tailwind CSS or your design system
6. Shows a nice loading animation (spinner, dots, or pulse)
```

---

## 📋 Prompt 12: Test Connection on App Load

```
Add API connection test to the main App component or root component that:
1. Uses the APIConnectionTest component or makes a test API call
2. Shows a toast/notification if connection fails
3. Allows user to retry if failed
4. Stores connection status in context or state
5. Only shows error notification if connection fails (not while loading)
6. Optionally shows a small status indicator in the UI
```

---

## 📋 Prompt 13: Integrate Analysis List Component

```
Update the existing analysis list component to:
1. Use useAnalyses hook from hooks/useAnalyses.ts
2. Replace any hardcoded mock data with real API data
3. Show LoadingSpinner while loading
4. Display error message using formatApiError if fetch fails
5. Show empty state if no analyses found
6. Make each analysis item clickable to navigate to detail page
7. Add refetch functionality
```

---

## 📋 Prompt 14: Create Analysis Form Integration

```
Update the create analysis form to:
1. Use useCreateAnalysis mutation from hooks/useAnalyses.ts
2. Show LoadingSpinner while creating
3. On success: show success toast/notification and redirect to the analysis detail page (using the returned analysis ID)
4. On error: show error message using formatApiError
5. Handle validation errors from API (400 status)
6. Disable submit button while creating
7. Reset form on success
```

---

## 📋 Prompt 15: Analysis Detail Page Integration

```
Update the analysis detail page to:
1. Use useAnalysis(id) hook to fetch analysis data
2. Show LoadingSpinner while loading
3. Display error message if fetch fails (404 or other errors)
4. Use useStartAnalysis mutation to start analysis
5. Show start button only if status is 'draft' or 'hitl_pending'
6. Poll or refetch periodically to check status updates
7. Show HITL checkpoints section if status is 'hitl_pending'
8. Display progress percentage
9. Show module status for each selected module
```

---

## 📋 Prompt 16: HITL Checkpoint Component

```
Create a component at components/HITLCheckpoint.tsx or src/components/HITLCheckpoint.tsx that:
1. Takes a checkpoint object as prop
2. Displays module type, status, and data snapshot in readable format
3. Shows buttons for: "Approve All", "Request Revision", "Reject"
4. Uses useResolveCheckpoint mutation
5. Shows loading state on the button while resolving
6. Displays success/error toast after resolution
7. Refreshes checkpoints list after successful resolution
8. Formats the data snapshot nicely (JSON viewer or formatted display)
```

---

## 📋 Prompt 17: Export Analysis Buttons

```
Add export buttons to the analysis detail page that:
1. Shows "Export PDF" and "Export Excel" buttons
2. Opens export URL in new tab: {API_BASE_URL}/api/analyses/{id}/export?format={pdf|excel}
3. Includes authentication headers (X-User-Id) if needed
4. Shows loading state while exporting
5. Handles errors gracefully with error message
6. Uses the API_BASE_URL from src/config/api.ts
```

---

## 📋 Prompt 18: Preset Selector Component

```
Create a preset selector component at components/PresetSelector.tsx or src/components/PresetSelector.tsx that:
1. Uses usePresets hook to fetch available presets
2. Displays presets in a dropdown, select, or card list
3. When a preset is selected, calls onChange callback with preset data
4. Shows LoadingSpinner while fetching presets
5. Displays error message if fetch fails
6. Shows "No presets available" message if list is empty
7. Optionally groups by: System Presets, My Presets, Team Presets
```

---

## 📋 Prompt 19: Update Create Form with Preset Selector

```
Update the create analysis form to:
1. Include the PresetSelector component
2. When a preset is selected, populate form fields with preset data:
   - selected_modules from preset.modules
   - social_platforms from preset.social_platforms
   - Optionally pre-fill other fields
3. Allow user to modify the preset values before submitting
4. Clear preset selection to start fresh if needed
```

---

## 📋 Prompt 20: Analysis Modules Display Component

```
Create a component at components/AnalysisModules.tsx or src/components/AnalysisModules.tsx that:
1. Takes analysisId as prop
2. Uses useAnalysisModules or api.getAnalysisModules to fetch modules
3. Displays modules in a grid or list
4. Shows each module's: type, status, progress percentage
5. Uses color coding for status (pending, running, completed, failed)
6. Shows progress bars for running modules
7. Displays error messages for failed modules
8. Makes completed modules expandable to show data
9. Shows loading state while fetching
```

---

## 🚀 Recommended Execution Order

1. ✅ **Already done**: `src/config/api.ts` created
2. **Prompt 2** - Create Authentication Hook
3. **Prompt 1** - Update API Client to use config and auth
4. **Prompt 8** - Create TypeScript Types
5. **Prompt 7** - Create Connection Test Component
6. **Test connection** - Add APIConnectionTest to app and verify ✅

**Then continue:**
7. **Prompt 4** - React Query Hooks for Analyses
8. **Prompt 13** - Integrate Analysis List Component
9. **Prompt 14** - Create Analysis Form Integration
10. **Prompt 15** - Analysis Detail Page Integration

---

## 📝 Notes

- Use `src/` directory structure (Vite convention)
- API_BASE_URL is in `src/config/api.ts` (already created)
- No .env files needed - API URL is public
- Use Vite environment variables with `VITE_` prefix if needed later
- All prompts assume Vite + React + TypeScript setup

---

**Continue with Prompt 2 (Authentication Hook) next!**
