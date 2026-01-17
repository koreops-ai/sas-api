# Where to Run Tests - Quick Guide

## 🎯 Option 1: Browser Console (Easiest - Start Here!)

### Step 1: Open Browser DevTools (Mac)
1. Open your Lovable app in browser
2. Press `Cmd + Option + I` (Chrome/Edge) or `Cmd + Option + C` (Safari) or `Right-click → Inspect`
3. Click the **Console** tab

**Mac Keyboard Shortcuts:**
- **Chrome/Edge**: `Cmd + Option + I`
- **Safari**: `Cmd + Option + C` (then enable Develop menu if needed)
- **Firefox**: `Cmd + Option + K`
- **Or**: Right-click on page → "Inspect" or "Inspect Element"

### Step 2: Run Tests in Console

**Test 1: API Connection**
```javascript
// Copy-paste this in console
import('@/lib/api').then(({ api }) => {
  api.listPresets()
    .then(data => console.log('✅ API Works!', data))
    .catch(err => console.error('❌ API Failed:', err));
});
```

**OR simpler - Direct fetch:**
```javascript
// Test API directly
fetch('https://sas-api-two.vercel.app/api/presets', {
  headers: { 'X-User-Id': 'test-user-123' }
})
  .then(r => r.json())
  .then(d => console.log('✅ API Works!', d))
  .catch(e => console.error('❌ API Failed:', e));
```

**Expected:** ✅ See presets data in console

---

## 🎯 Option 2: Create a Test Component (Recommended)

### Step 1: Create Test Component

**In Lovable, create a new component:**

```
Create a component at src/components/TestIntegration.tsx or pages/TestPage.tsx that shows all the test results on screen. Use React hooks and console.log to display results.
```

**Or use this prompt:**
```
Create a test page at src/pages/TestPage.tsx that:
1. Uses useAuth hook to show userId
2. Uses usePresets hook to show presets count
3. Uses useAnalyses hook to show analyses count
4. Has a button to test api.listPresets() directly
5. Shows all results on screen with ✅ or ❌ indicators
6. Displays any errors in red
```

### Step 2: Add to Your App

Add the test page to your routing:
- Navigate to `/test` to see test results
- Or add `<TestPage />` to your main app component temporarily

### Step 3: Check Results - Step by Step

**After creating the TestPage component, here's how to check results:**

#### Step 3a: Navigate to Test Page
1. **If you added routing**: Navigate to `/test` in your browser URL bar
   - Example: `http://localhost:5173/test` (Vite default port)
   - Or: `https://your-app.vercel.app/test`
2. **If you added to main app**: Look for the test section on your home/dashboard page

#### Step 3b: Look at the Screen
Check the TestPage component on screen. You should see:

**✅ Working (Success):**
- Green checkmarks (✅) next to items
- "User ID: test-user-123" (or your actual userId)
- "Presets: X" (where X is a number > 0)
- "Analyses: X" (where X is a number >= 0)
- Button shows "Test API Call" and works when clicked
- All text is visible and readable

**❌ Not Working (Errors):**
- Red error messages
- "User ID: None" or "Loading..." stuck
- "Presets: 0" (but you know there are presets)
- "Error: ..." messages in red
- Button doesn't work or shows error
- Blank screen or component won't render

#### Step 3c: Check Browser Console (Mac)
1. Press `Cmd + Option + I` to open DevTools
2. Click the **Console** tab
3. Look for:
   - ✅ **Success messages**: Green/white text like "✅ API Call Success:", "✅ API Works!"
   - ❌ **Error messages**: Red text like "❌ API Call Failed:", "Error:", "Failed to fetch"

**What to look for in Console:**
- ✅ `✅ API Call Success:` with data = API works!
- ✅ `User ID: test-user-123` = Auth works!
- ✅ `Found X presets` = Presets hook works!
- ❌ `Failed to fetch` = API URL wrong or network issue
- ❌ `401 Unauthorized` = Authentication issue
- ❌ `404 Not Found` = Endpoint doesn't exist
- ❌ `500 Internal Server Error` = Backend error

#### Step 3d: Check Network Tab (If API fails)
1. Stay in DevTools (Cmd + Option + I)
2. Click **Network** tab
3. Click the "Test API Call" button again
4. Find the request (should be `/api/presets` or similar)
5. Click on it
6. Check:
   - **Status**: Should be `200` (success) not `401`, `404`, `500`
   - **Headers**: Should include `X-User-Id: test-user-123`
   - **Response**: Should show JSON data, not error

#### Step 3e: Interpret Results

**Everything Works ✅:**
```
User ID: test-user-123 ✅
Presets: 5 ✅
Analyses: 3 ✅
[Test API Call button works] ✅
```
**→ Continue to next prompt!**

**Some Issues ⚠️:**
```
User ID: test-user-123 ✅
Presets: 0 ⚠️ (but console shows error)
Analyses: Error loading ⚠️
```
**→ Check console for specific errors, fix them**

**Major Issues ❌:**
```
User ID: None ❌
Presets: Error ❌
Analyses: Error ❌
Button doesn't work ❌
```
**→ Stop here, debug systematically. Check:**
- API base URL is correct
- Authentication hook works
- API client is set up correctly

#### Step 3f: Quick Verification Checklist

**Run through this checklist:**

- [ ] Page loads without crashing
- [ ] User ID shows (not "None" or "Loading...")
- [ ] Presets count shows (even if 0, that's OK if loading)
- [ ] Analyses count shows
- [ ] "Test API Call" button is clickable
- [ ] Clicking button shows result (check console)
- [ ] No red error messages on screen
- [ ] Console shows success messages (or specific errors)
- [ ] Network tab shows 200 status (if you check it)

**If all ✅ → Continue to Prompt 16**
**If any ❌ → Fix issues first**

---

## 🎯 Option 3: Use Existing Components

### Test in Any Existing Component

**Add test code to any component you already have:**

```typescript
// In any component (e.g., HomePage, Dashboard, etc.)
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { usePresets } from '@/hooks/usePresets';

export function YourComponent() {
  const { userId } = useAuth();
  const { data: presets } = usePresets();

  useEffect(() => {
    // Test API
    api.listPresets()
      .then(data => console.log('✅ API Works!', data))
      .catch(err => console.error('❌ API Failed:', err));
  }, []);

  return (
    <div>
      {/* Your existing UI */}
      
      {/* Add test info temporarily */}
      <div style={{ padding: '20px', background: '#f0f0f0' }}>
        <h3>Test Results:</h3>
        <p>User ID: {userId}</p>
        <p>Presets: {presets?.length || 0}</p>
        <p>Check console for API test results</p>
      </div>
    </div>
  );
}
```

**Check:**
- Browser console for API test results
- On-screen for userId and presets count

---

## 🎯 Option 4: Create a Test Button

### Add Test Button to Existing Page

**In Lovable, use this prompt:**
```
Add a "Run Tests" button to the home/dashboard page that:
1. Tests api.listPresets() when clicked
2. Shows result in an alert or toast
3. Logs results to console
4. Displays ✅ or ❌ on the button based on result
```

**Or manually add:**
```typescript
const handleTest = async () => {
  try {
    const data = await api.listPresets();
    alert('✅ API Works! Check console for details');
    console.log('✅ API Works!', data);
  } catch (error) {
    alert('❌ API Failed! Check console');
    console.error('❌ API Failed:', error);
  }
};

<button onClick={handleTest}>Run API Test</button>
```

---

## 📋 Quick Testing Checklist

### Method 1: Browser Console (Fastest) ⚡
1. Open DevTools (F12)
2. Go to Console tab
3. Paste test code
4. See results immediately

### Method 2: Test Component (Best for UI) ✅
1. Create TestPage component
2. Add to routing
3. Navigate to `/test`
4. See all test results on screen

### Method 3: Existing Component (Quick Check)
1. Add test code to existing component
2. Check console on page load
3. Remove test code when done

---

## 🧪 Recommended: Start with Console

**Fastest way to test right now:**

1. **Open your app** in browser
2. **Press F12** (open DevTools)
3. **Click Console tab**
4. **Paste this:**

```javascript
// Test API Connection
fetch('https://sas-api-two.vercel.app/api/presets', {
  headers: { 'X-User-Id': 'test-user-123' }
})
  .then(r => r.json())
  .then(d => {
    console.log('✅ API Connection Works!');
    console.log('Response:', d);
  })
  .catch(e => {
    console.error('❌ API Connection Failed!');
    console.error('Error:', e);
  });
```

5. **Press Enter**
6. **Check result:**
   - ✅ Success = See response data
   - ❌ Error = See error message

**Then test your React hooks:**
- Add `<TestPage />` to your app
- Navigate to it
- Check screen for results

---

## 🎯 Where Each Test Should Go

| Test | Where to Run |
|------|-------------|
| **API Connection** | Browser Console OR Test Component |
| **Auth Hook** | Any React Component (use useAuth) |
| **Presets Hook** | Any React Component (use usePresets) |
| **Analyses Hook** | Any React Component (use useAnalyses) |
| **Create Analysis** | In your create form component |
| **Detail Page** | In your analysis detail page |

---

## 💡 Pro Tip

**Best Practice:**
1. **Quick test** → Browser Console (5 seconds)
2. **Full test** → Create TestPage component (5 minutes)
3. **Integration** → Test in real components

**Start with console, then create test component if you want visual results!**

---

## 🚀 Quick Start Command

**Right now (Mac):**
1. Open your Lovable app in browser
2. Press `Cmd + Option + I` (or Right-click → Inspect) → Console tab
3. Copy-paste the fetch code above
4. Press Enter
5. See ✅ or ❌ in console

**Mac Shortcuts:**
- `Cmd + Option + I` - Open DevTools (Chrome/Edge)
- `Cmd + Option + C` - Open Console (Safari)
- `Right-click → Inspect` - Works in all browsers

That's it! Takes 10 seconds.
