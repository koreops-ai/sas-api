# Environment Variables Setup

## Supabase Connection - ✅ Already Configured

Your Supabase project is set up and ready:
- **Project Name:** SAS MARKET VALIDATION PLATFORM
- **Project URL:** `https://ufxvqmbfevbpvfqqysjr.supabase.co`
- **Database:** Ready and configured

---

## Environment Variables Needed

The backend needs these environment variables:

### Required for Backend API

1. **`SUPABASE_URL`**
   - Value: `https://ufxvqmbfevbpvfqqysjr.supabase.co`
   - Location: Supabase Dashboard → Settings → API → Project URL

2. **`SUPABASE_SERVICE_KEY`**
   - Value: Your service role key (starts with `eyJ...`)
   - Location: Supabase Dashboard → Settings → API → `service_role` key (secret!)
   - ⚠️ **IMPORTANT:** This is the service role key, NOT the anon key. It bypasses Row Level Security.

3. **`ANTHROPIC_API_KEY`**
   - Value: Your Anthropic Claude API key
   - Location: Anthropic Console → API Keys

4. **`OPENAI_API_KEY`**
   - Value: Your OpenAI API key
   - Location: OpenAI Dashboard → API Keys

5. **`GEMINI_API_KEY`**
   - Value: Your Google Gemini API key
   - Location: Google AI Studio → API Keys

4. **`OPENAI_API_KEY`**
   - Value: Your OpenAI API key
   - Location: OpenAI Platform → API Keys

5. **`GEMINI_API_KEY`**
   - Value: Your Google Gemini API key
   - Location: Google AI Studio → API Keys

---

## How to Set Environment Variables

### For Local Development

Create a `.env.local` file in the project root:

```bash
# .env.local
SUPABASE_URL=https://ufxvqmbfevbpvfqqysjr.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
OPENAI_API_KEY=your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
GEMINI_API_KEY=your_gemini_key_here
```

**Note:** `.env.local` is gitignored - never commit this file!

### For Vercel Deployment

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables

2. Add these variables:
   - `SUPABASE_URL` = `https://ufxvqmbfevbpvfqqysjr.supabase.co`
   - `SUPABASE_SERVICE_KEY` = (your service role key)
   - `ANTHROPIC_API_KEY` = (your Anthropic key)
   - `OPENAI_API_KEY` = (your OpenAI key)
   - `GEMINI_API_KEY` = (your Gemini key)

3. Or use Vercel CLI:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_SERVICE_KEY
   vercel env add ANTHROPIC_API_KEY
   vercel env add OPENAI_API_KEY
   vercel env add GEMINI_API_KEY
   ```

---

## Supabase Client Configuration

The Supabase client is already configured in `src/lib/supabase.ts`:

```typescript
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
```

✅ **Configuration is correct** - Uses service role key for server-side operations.

---

## Database Tables Used

The code connects to these Supabase tables:

1. **`analyses`** - Main analysis records
2. **`analysis_modules`** - Individual module execution records
3. **`hitl_checkpoints`** - Human-in-the-loop review checkpoints
4. **`users`** - User accounts
5. **`presets`** - Saved analysis templates
6. **`credit_transactions`** - Credit usage history
7. **`evidence`** - Screenshots/files from scraping

All database operations are implemented in `src/lib/supabase.ts`:
- ✅ 22 database functions ready
- ✅ All CRUD operations for analyses, modules, HITL, users, presets
- ✅ Credit management functions
- ✅ Evidence storage functions

---

## Testing the Connection

To test if Supabase connection works:

```bash
# Set environment variables first
export SUPABASE_URL="https://ufxvqmbfevbpvfqqysjr.supabase.co"
export SUPABASE_SERVICE_KEY="your_service_role_key"

# Run dev server
npm run dev

# Test an endpoint
curl http://localhost:3000/api/analyses \
  -H "X-User-Id: test-user-id"
```

---

## Status: ✅ Ready

- ✅ Supabase project is configured
- ✅ Database tables exist
- ✅ Backend code is ready to connect
- ⏭️ Just need to set environment variables in Vercel/local

---

## Getting Your Service Role Key

1. Go to: https://supabase.com/dashboard/project/ufxvqmbfevbpvfqqysjr
2. Navigate to: **Settings** → **API**
3. Find: **Project API keys** section
4. Copy: **`service_role`** key (secret, starts with `eyJ...`)
5. ⚠️ **Never share this key publicly!** It has full database access.

---

**Next Step:** Set environment variables in Vercel for deployment!
