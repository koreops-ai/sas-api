## One‑Click Checklist (Next Session)

### Backend
- [ ] Open GitHub Desktop → repo **sas-api** → Commit on Main → Push origin
- [ ] Vercel → **sas-api** → Deployments → Redeploy → Status **Ready**
- [ ] Open `https://sas-api-two.vercel.app/api/chat` → Expect **Method Not Allowed**

### Frontend
- [ ] Open `https://market-insights-hub-48.vercel.app/test`
- [ ] Click **Test /api/chat (JSON blocks)** → Expect ✅ success
- [ ] Open `https://market-insights-hub-48.vercel.app/research`
- [ ] Run a prompt → Canvas populates (bullets + table + chart)

### If anything fails
- [ ] Check Vercel **Deployments → Build Logs**
- [ ] Confirm backend env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`
