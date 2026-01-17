# Frontend Integration Guide - Lovable UI ↔ Vercel Backend

## 🌐 Your Backend API URLs

**Production (Vercel):**
- Primary: `https://sas-api-two.vercel.app`
- Alternative: `https://sas-api-koreops-ais-projects.vercel.app`
- Alternative: `https://sas-api-koreopsai-2327-koreops-ais-projects.vercel.app`

**Local Development:**
- `http://localhost:3000` (when running `npm run dev`)

---

## 🔧 Configuration Steps

### Step 1: Set API Base URL in Frontend

In your Lovable UI frontend, set the API base URL:

**For Production:**
```typescript
const API_BASE_URL = 'https://sas-api-two.vercel.app';
```

**For Development:**
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
```

**Environment Variable (Recommended):**
```bash
# .env.local in your frontend project
NEXT_PUBLIC_API_URL=https://sas-api-two.vercel.app
```

---

### Step 2: Configure Authentication

#### Option A: Using JWT (Recommended for Production)

```typescript
// Get Supabase JWT token from your auth
const supabaseToken = await supabase.auth.getSession();

// Add to all API calls
const headers = {
  'Authorization': `Bearer ${supabaseToken.data.session?.access_token}`,
  'Content-Type': 'application/json'
};
```

#### Option B: Using X-User-Id (Development/Testing)

```typescript
const userId = await getUserId(); // Get from your auth system

const headers = {
  'X-User-Id': userId,
  'Content-Type': 'application/json'
};
```

---

### Step 3: Create API Client/Service

Create an API service file in your frontend:

```typescript
// lib/api.ts or services/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://sas-api-two.vercel.app';

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Get auth token
  const supabaseToken = await supabase.auth.getSession();
  const token = supabaseToken.data.session?.access_token;
  
  // Or use X-User-Id for development
  const userId = await getCurrentUserId();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token 
      ? { 'Authorization': `Bearer ${token}` }
      : { 'X-User-Id': userId }
    ),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `API Error: ${response.status}`);
  }

  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }

  return data.data;
}

// API Methods
export const api = {
  // Analyses
  listAnalyses: (limit = 10, offset = 0, status?: string) =>
    apiCall(`/api/analyses?limit=${limit}&offset=${offset}${status ? `&status=${status}` : ''}`),
  
  getAnalysis: (id: string) =>
    apiCall(`/api/analyses/${id}`),
  
  createAnalysis: (data: CreateAnalysisInput) =>
    apiCall('/api/analyses', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updateAnalysis: (id: string, data: Partial<Analysis>) =>
    apiCall(`/api/analyses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  deleteAnalysis: (id: string) =>
    apiCall(`/api/analyses/${id}`, {
      method: 'DELETE',
    }),
  
  startAnalysis: (id: string) =>
    apiCall(`/api/analyses/${id}/start`, {
      method: 'POST',
    }),
  
  getAnalysisModules: (id: string) =>
    apiCall(`/api/analyses/${id}/modules`),
  
  // Presets
  listPresets: () =>
    apiCall('/api/presets'),
  
  getPreset: (id: string) =>
    apiCall(`/api/presets/${id}`),
  
  createPreset: (data: CreatePresetInput) =>
    apiCall('/api/presets', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  updatePreset: (id: string, data: UpdatePresetInput) =>
    apiCall(`/api/presets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  
  deletePreset: (id: string) =>
    apiCall(`/api/presets/${id}`, {
      method: 'DELETE',
    }),
  
  // HITL
  listCheckpoints: () =>
    apiCall('/api/hitl/checkpoints'),
  
  resolveCheckpoint: (id: string, data: HITLResolveInput) =>
    apiCall(`/api/hitl/checkpoints/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  // Export
  exportAnalysis: (id: string, format: 'pdf' | 'excel') =>
    `${API_BASE_URL}/api/analyses/${id}/export?format=${format}`,
};
```

---

### Step 4: Test Connection

Add a test function to verify connection:

```typescript
// Test API connection
export async function testAPIConnection(): Promise<boolean> {
  try {
    const presets = await api.listPresets();
    console.log('✅ API connection successful!', presets);
    return true;
  } catch (error) {
    console.error('❌ API connection failed:', error);
    return false;
  }
}

// Call on app load or in useEffect
testAPIConnection();
```

---

### Step 5: Handle CORS (If Needed)

The backend already has CORS enabled, but if you encounter CORS errors:

**Backend CORS Settings** (already configured):
```typescript
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Id
```

If issues persist, check:
- Frontend is using the correct base URL
- Headers are set correctly
- Preflight OPTIONS requests work

---

## 📋 Integration Checklist

- [ ] Set `NEXT_PUBLIC_API_URL` environment variable
- [ ] Configure authentication (JWT or X-User-Id)
- [ ] Create API service/client
- [ ] Test basic connection (`/api/presets`)
- [ ] Test creating analysis
- [ ] Test starting analysis
- [ ] Handle errors gracefully
- [ ] Add loading states
- [ ] Test HITL workflow

---

## 🧪 Quick Test

Once configured, test with this in your frontend:

```typescript
// In a React component or page
useEffect(() => {
  const testConnection = async () => {
    try {
      const presets = await api.listPresets();
      console.log('Presets:', presets);
    } catch (error) {
      console.error('Connection test failed:', error);
    }
  };
  
  testConnection();
}, []);
```

---

## 🐛 Troubleshooting

### Error: 401 Unauthorized
- **Fix**: Check authentication headers are set correctly
- **Fix**: Verify JWT token is valid (if using JWT)
- **Fix**: Check X-User-Id header (if using that method)

### Error: CORS
- **Fix**: Verify API base URL is correct
- **Fix**: Check backend CORS settings (already enabled)
- **Fix**: Ensure preflight OPTIONS requests work

### Error: Network Error
- **Fix**: Check API URL is accessible
- **Fix**: Verify deployment protection is disabled (for testing)
- **Fix**: Check network connectivity

### Error: 500 Internal Server Error
- **Fix**: Check backend logs: `vercel logs`
- **Fix**: Verify environment variables are set on Vercel
- **Fix**: Check Supabase connection

---

## 🔗 Example React Hook

```typescript
// hooks/useAnalyses.ts
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export function useAnalyses() {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalyses = async () => {
      try {
        setLoading(true);
        const data = await api.listAnalyses();
        setAnalyses(data.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyses();
  }, []);

  return { analyses, loading, error };
}
```

---

## 📞 Next Steps

1. **Set API Base URL** in your frontend environment
2. **Configure Authentication** (JWT or X-User-Id)
3. **Test Basic Connection** with `/api/presets`
4. **Integrate Core Features** (create, start, HITL)
5. **Test End-to-End** user workflow

---

**Ready to connect!** Your backend is live at `https://sas-api-two.vercel.app`
