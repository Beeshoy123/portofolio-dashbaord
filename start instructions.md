# START HERE: Instructions

> ⚡ **IMPORTANT:** After starting the servers, check [`to do list.md`](to%20do%20list.md) in the project root for the immediate next steps to enable stock data fetching from Yahoo Finance.

---

# Portfolio Dashboard - Development Instructions
## 🔑 Environment Setup

### 1. Create `.env` files for both frontend and backend

**Backend (.env in `artifacts/api-server/`):**
```env
DATABASE_URL=postgresql://username:password@db.supabase.co:5432/postgres
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
GOOGLE_GENAI_API_KEY=your-gemini-api-key
PORT=8080
NODE_ENV=development
```

**Frontend (.env in `artifacts/portfolio/`):**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 2. Get Your Supabase Credentials
1. Go to your Supabase project dashboard
2. Click **Settings** → **Database**
3. Copy connection string → paste into `DATABASE_URL`
4. Go to **Settings** → **API**
5. Copy **URL** and **Anon Key** → paste into the .env files

### 3. Get Your Google Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Paste into `GOOGLE_GENAI_API_KEY` in api-server `.env`

---
## � Prerequisites - Install Dependencies (Run FIRST)

Before starting servers, install all workspace dependencies from the project root:

```bash
# From: g:\tp\ai\portofolio-dashbaord\
cd g:\tp\ai\portofolio-dashbaord

# Install all packages (backend + frontend)
pnpm install

# OR if you prefer npm:
npm install --workspaces
```

This sets up both `@workspace/api-server` and `@workspace/portfolio` packages.

---

## �🚀 TL;DR Quick Start

**Backend API Server (WORKING):**
```bash
# Terminal 1 - Backend on port 8080
& "C:\Program Files\Git\bin\bash.exe" -c "cd '/g/tp/ai/portofolio-dashbaord/artifacts/api-server' && PORT=8080 pnpm run start"
```

**Frontend (HAS ISSUES - See status below):**
```bash
# Terminal 2 - Frontend on port 3000
& "C:\Program Files\Git\bin\bash.exe" -c "cd '/g/tp/ai/portofolio-dashbaord/artifacts/portfolio' && PORT=3000 pnpm run dev"
```

**App URL:** http://localhost:3000/

---

## 📋 Smart Advisor Integration Progress

### ✅ Step 1: Database Tables (COMPLETED)
Created schema for AI recommendation storage:
- **File:** `lib/db/src/schema/advisor.ts` - Drizzle ORM schema
- **SQL:** `migrations/006_advisor_recommendations.sql` - Direct SQL migration
- **Table:** `advisor_recommendations` with fields:
  - `id` (serial primary key)
  - `watchlist_id` (foreign key to comparison_watchlist)
  - `recommendation_text` (AI-generated advice)
  - `model_used` (e.g., 'gemini-2.0-flash')
  - `generated_at` & `updated_at` (timestamps)

**To apply in Supabase:**
```sql
-- Copy and run this in your Supabase SQL editor:
CREATE TABLE IF NOT EXISTS "advisor_recommendations" (
  "id" serial PRIMARY KEY,
  "watchlist_id" integer NOT NULL REFERENCES "comparison_watchlist"("id") ON DELETE CASCADE,
  "recommendation_text" text NOT NULL,
  "model_used" text NOT NULL,
  "generated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_watchlist_generated" 
  ON "advisor_recommendations"("watchlist_id", "generated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_generated_at" 
  ON "advisor_recommendations"("generated_at" DESC);
```

### ✅ Step 2: Frontend UI Component (COMPLETED)
Built Smart Advisor dashboard panel with:
- **File:** `src/components/SmartAdvisorPanel.tsx`
- **Integration:** Added to `src/App.tsx` as a sidebar panel (w-96)
- **Features:**
  - Display AI-generated recommendations for each holding
  - Real-time alerts (Time Stop, Thesis Check, Portfolio Drawdown)
  - Refresh button to manually trigger `POST /api/advisor/generate`
  - Auto-refresh every 5 minutes
  - Error handling with user feedback
  - Loading states
  - Styled with shadcn/ui Card component to match the rest of the app

**What it does:**
1. Fetches recommendations from `/api/advisor/recommendations`
2. Fetches alerts from `/api/alerts/summary`
3. Displays ticker + recommendation text + alert badges
4. Shows alert details (days stagnant, thesis status, drawdown %)
5. Has "Generate" button to manually run Gemini-based recommendations

### ✅ Step 4: Auto-generation Wiring (COMPLETED)
Smart Advisor now automatically generates recommendations when:
- **Dashboard first loads** — if no recommendations exist yet
- **Cooldown period passes** — once per hour max (configurable in SmartAdvisorPanel.tsx)
- **User clicks Generate button** — manual trigger always available

**Implementation details:**
- Uses `localStorage` to track `advisor_last_generation_time`
- Prevents spam with 1-hour cooldown between auto-generations
- Shows "Last generated" timestamp and "Next auto-generation" countdown
- Maintains manual "Generate" button for on-demand updates

---

## ✅ ALL STEPS COMPLETE
Need to connect: Frontend → `/api/advisor/recommendations` & `/api/alerts/summary`

### ⏳ Step 4: Auto-generation (NOT STARTED)
Need to wire: Dashboard lifecycle → `POST /api/advisor/generate` trigger

---

## ⚠️ CURRENT STATUS

### ✅ Working
- **API Backend Server** - Running on port 8080
  - Started with: `& "C:\Program Files\Git\bin\bash.exe" -c "cd '/g/tp/ai/portofolio-dashbaord/artifacts/api-server' && PORT=8080 pnpm run start"`
  - Successfully fetching market data (USD/EGP rates, gold prices, etc.)

### ❌ Issue
- **Frontend** - Dependency installation issues with native modules (Rollup, Tailwind oxide)
  - This is a Windows + pnpm lockfile compatibility issue
  - Native modules not properly installed for Windows x64

### 🔧 SOLUTION OPTIONS

**Option 1: Use the VSCode Tasks (Recommended)**
1. Open Command Palette: `Ctrl+Shift+P`
2. Type "Run Task"
3. Select one of the start tasks if available

**Option 2: Use Docker** (If available)
The monorepo likely has Docker support. Check for `Dockerfile` or `docker-compose.yml`.

**Option 3: Manual Fix**
1. Delete lock files and reinstall from root:
```bash
cd g:\tp\ai\portofolio-dashbaord
rm -r node_modules pnpm-lock.yaml
pnpm install --no-frozen-lockfile
pnpm run --filter @workspace/portfolio dev
```

2. Or try with npm workspace:
```bash
cd g:\tp\ai\portofolio-dashbaord
npm install --workspaces
npm run --workspace=@workspace/portfolio dev
```

**Option 4: Use Previous Working Vite Setup**
The initially started Vite server on port 3001 was working. Try:
```bash
cd g:\tp\ai\portofolio-dashbaord\artifacts\portfolio
npm install
npm run dev
```

## Quick Start - EASIEST METHOD

Run the `.bat` files from root directory `g:\tp\ai\portofolio-dashbaord\`:

### Terminal 1: Start Backend
```batch
start-backend.bat
```

Waits for: `Server listening on http://localhost:8080`

### Terminal 2: Start Frontend  
```batch
start-frontend.bat
```

Frontend will start at:
- **Local:** http://localhost:3000/
- **Network:** Check terminal output for the address

## Alternative - Manual Start with Git Bash

If `.bat` files don't work, use Git Bash directly:

### Terminal 1: Backend
```bash
cd '/g/tp/ai/portofolio-dashbaord/artifacts/api-server'
PORT=8080 pnpm run start
```

### Terminal 2: Frontend
```bash
cd '/g/tp/ai/portofolio-dashbaord/artifacts/portfolio'
PORT=3000 pnpm run dev
```

## Alternative - Direct PowerShell (if pnpm works)

If you have pnpm installed and working in PowerShell:

### Terminal 1: Backend
```powershell
cd g:\tp\ai\portofolio-dashbaord
& pnpm run --filter @workspace/api-server start
```

### Terminal 2: Frontend
```powershell
cd g:\tp\ai\portofolio-dashbaord  
& pnpm run --filter @workspace/portfolio dev
```

## Project Structure

### Workspace Layout
```
/artifacts/
├── portfolio/           # Frontend app (React/Vite)
├── api-server/          # Backend API server (Node.js)
└── mockup-sandbox/
```

---

## 🎯 What to Expect After Startup

### Backend is Ready When You See:
```
Server listening on http://localhost:8080
```

**Then test:** Visit `http://localhost:8080/api/health` in your browser
- Should return a health status JSON response

### Frontend is Ready When You See:
```
VITE v... ready in ... ms
```

**Then open:** http://localhost:3000/
- You should see the Portfolio Dashboard with a list of holdings/funds

---

## 🚀 Key Features

### Smart Advisor Panel (Right Sidebar)
- **Auto-generates** AI recommendations when dashboard loads
- **Shows alerts**: Time Stop (stagnant positions), Thesis Check (signal reversed), Drawdown alerts
- **Manual refresh** button to generate new recommendations
- **Auto-refreshes** every 5 minutes

### Price Refresh
- Click "Refresh Prices" in the dashboard to run the scraper
- Fetches fund NAVs from FoudaLens (works ✅)
- Fetches stock prices from Yahoo Finance (requires yahoo_ticker mapping — **see `to do list.md`**)

### Comparison Judge
- Analyzes portfolio rotation verdicts
- Compares holdings against benchmarks
- Generates buy/sell/hold signals

---

## ⚠️ Stock Data Issue - IMPORTANT

**Problem:** Egyptian stocks (ETEL, EGCH, AMOC, etc.) show dashes in price column
- FoudaLens works for Canadian funds but not Egyptian stocks
- Stock prices must come from Yahoo Finance

**Solution:** See [`to do list.md`](to%20do%20list.md) for the 3 steps to map Egyptian tickers to Yahoo Finance

**File created:** `artifacts/api-server/src/judge/enrichReturnsFromYahoo.ts` handles the Yahoo integration

---

## 🔍 Troubleshooting

### "Cannot find @tailwindcss/oxide"
**Cause:** Windows + pnpm native module issue
**Fix:**
```bash
cd g:\tp\ai\portofolio-dashbaord
rm -r node_modules pnpm-lock.yaml
pnpm install --no-frozen-lockfile
```

### "Port 3000 already in use"
**Fix:** Change port in the start command:
```bash
PORT=3001 pnpm run dev
```

### "Port 8080 already in use"
**Fix:** Kill the existing process or use a different port:
```bash
PORT=8081 pnpm run start
```

### "Cannot connect to Supabase"
**Check:**
1. Is `DATABASE_URL` in `.env` correct?
2. Is your Supabase project active?
3. Is your IP whitelisted in Supabase firewall settings?
4. Try: `psql $DATABASE_URL -c "SELECT 1"` to test connection

### "AI recommendations not generating"
**Check:**
1. Is `GOOGLE_GENAI_API_KEY` set in backend `.env`?
2. Is API key valid on Google AI Studio?
3. Check backend logs for errors

### "Stock prices still showing dashes"
**Solution:** Complete the 3 steps in [`to do list.md`](to%20do%20list.md) to set up yahoo_ticker mappings

---

## 📝 Database Migrations

Before using the dashboard, apply these migrations in Supabase SQL editor:

### 1. Smart Advisor Table (Required for recommendations)
```sql
-- Copy the SQL from migrations/006_advisor_recommendations.sql
-- Paste into Supabase SQL editor and execute
```

### 2. Stock Yahoo Ticker Mapping (Required for stock prices)
```sql
-- Add yahoo_ticker column if missing
ALTER TABLE comparison_watchlist 
ADD COLUMN IF NOT EXISTS yahoo_ticker VARCHAR(20);

-- Then populate with Egyptian stock mappings (see to do list.md)
```

---

## 📞 Quick Reference

| Component | Port | Status | Start Command |
|-----------|------|--------|----------------|
| Frontend | 3000 | 🔴 Issues | `cd portfolio && pnpm run dev` |
| Backend | 8080 | ✅ Working | `cd api-server && PORT=8080 pnpm run start` |
| Supabase | 5432 | ✅ Connected | Use DATABASE_URL in .env |

---

## 🔗 Important Files

- **Frontend App:** `artifacts/portfolio/src/App.tsx`
- **Smart Advisor Component:** `artifacts/portfolio/src/components/SmartAdvisorPanel.tsx`
- **Backend Server:** `artifacts/api-server/src/index.ts`
- **Scraper Logic:** `artifacts/api-server/src/scraper/runScraper.ts`
- **Yahoo Enrichment:** `artifacts/api-server/src/judge/enrichReturnsFromYahoo.ts` (newly created)
- **Setup Guide:** `start instructions.md` (this file)
- **Next Steps:** `to do list.md` (MUST READ after startup)
