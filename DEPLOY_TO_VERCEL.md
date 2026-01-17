# Deploying to Vercel - Step by Step Guide

## Prerequisites
- ✅ Vercel CLI installed
- ✅ Environment variables ready in `.env.local`
- ✅ Project builds successfully (`npm run build`)

## Deployment Steps

### Option 1: Interactive Deployment (Recommended First Time)

1. **Login to Vercel** (if not already logged in):
```bash
vercel login
```

2. **Deploy to Vercel**:
```bash
vercel
```

This will prompt you:
- **Set up and deploy?** → Yes
- **Which scope?** → Select your account
- **Link to existing project?** → No (or Yes if you have one)
- **Project name?** → `sas-market-validation-api` (or your choice)
- **Directory?** → `./` (current directory)
- **Override settings?** → No

3. **Set Environment Variables** after deployment:
```bash
# After first deploy, set your environment variables
vercel env add SUPABASE_URL
# Paste: https://ufxvqmbfevbpvfqqysjr.supabase.co

vercel env add SUPABASE_SERVICE_KEY
# Paste: your_service_role_key_here

vercel env add SUPABASE_ANON_KEY
# Paste: your_anon_key_here

vercel env add ANTHROPIC_API_KEY
# Paste: your_anthropic_api_key_here
```

4. **Redeploy with environment variables**:
```bash
vercel --prod
```

### Option 2: Non-Interactive (Quick Deploy)

If you're already linked:
```bash
vercel --prod
```

### Option 3: Via Vercel Dashboard

1. Go to https://vercel.com/new
2. Import your Git repository (if you have one)
   - Or drag & drop the project folder
3. Configure:
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `SUPABASE_ANON_KEY`
   - `ANTHROPIC_API_KEY`
5. Deploy!

## Testing Deployed Endpoints

After deployment, you'll get a URL like:
`https://sas-market-validation-api.vercel.app`

Test endpoints:
```bash
# Replace with your actual Vercel URL
BASE_URL="https://your-project.vercel.app"

# Test presets endpoint
curl -H "X-User-Id: test-user-123" \
  ${BASE_URL}/api/presets

# Test creating analysis
curl -X POST \
  -H "X-User-Id: test-user-123" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Analysis",
    "company_name": "Test Company",
    "selected_modules": ["market_demand"]
  }' \
  ${BASE_URL}/api/analyses
```

## View Logs

```bash
# View deployment logs
vercel logs

# View logs in real-time
vercel logs --follow
```

## Troubleshooting

### Build Fails
- Check that `npm run build` works locally
- Ensure all dependencies are in `package.json`
- Check TypeScript errors: `npm run build`

### Environment Variables Not Working
- Make sure you added them: `vercel env ls`
- Redeploy after adding: `vercel --prod`
- Check they're set for production: `vercel env pull .env.vercel`

### Function Timeout
- Check `vercel.json` has `maxDuration: 300` (5 minutes)
- For longer operations, consider background jobs

## Quick Reference

```bash
# Deploy preview
vercel

# Deploy to production
vercel --prod

# View deployments
vercel ls

# View logs
vercel logs

# Open dashboard
vercel dashboard

# Remove deployment
vercel remove
```
