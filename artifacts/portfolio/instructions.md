# Portfolio Dashboard - Development Instructions

## 🚀 TL;DR Quick Start

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

### Frontend Structure (portfolio/)
```
src/
├── components/
│   └── ui/              # shadcn/ui components (accordion, button, card, etc.)
├── hooks/               # Custom React hooks (use-mobile, use-toast)
├── lib/                 # Utility functions & business logic
│   ├── dashboardBehavior.ts
│   ├── dashboardHtml.ts
│   ├── goldFeeSchedule.ts
│   ├── i18n.ts          # Internationalization
│   ├── portfolioMath.ts
│   ├── supabaseClient.ts  # Connects to Supabase for auth
│   ├── usdRealityEngine.ts
│   └── utils.ts
├── pages/
│   └── not-found.tsx
├── App.tsx              # Main app component (imports useGetPortfolio from api-client-react)
├── AuthGate.tsx         # Authentication wrapper (Supabase auth)
├── main.tsx             # Entry point
└── index.css, portfolio.css  # Global styles
```

### Backend Structure (api-server/)
```
src/
├── index.mjs            # Main API server entry point
└── other backend logic
```

The **API server** connects to Supabase database and exposes REST endpoints that the frontend calls.

## Environment Configuration

### Frontend (.env in portfolio/)
```
VITE_SUPABASE_URL=https://gcyuahzdvaodrqijjqba.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_k82IGmc4tBSzGYFBNj30JA__rzwuN4O
```
- These are the **public** Supabase credentials for the frontend
- Used for authentication via Supabase Auth
- The `VITE_` prefix makes them available to the browser

### Backend (.env in api-server/)
```
DATABASE_URL=postgresql://postgres:Bosha%40061196@db.gcyuahzdvaodrqijjqba.supabase.co:5432/postgres
SUPABASE_URL=https://gcyuahzdvaodrqijjqba.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- These are the **private** credentials for the backend
- `DATABASE_URL` connects directly to the Postgres database
- `SUPABASE_SERVICE_ROLE_KEY` is a secret key (keep this secure, never commit!)
- Only the API server should have access to these

### How They Connect
1. **Browser** → Frontend (port 3001)
2. **Frontend** → Supabase Auth (login/session)
3. **Frontend** → API Server (port 3000) to fetch/update portfolio data
4. **API Server** → Supabase Database (via DATABASE_URL)

If the frontend can't reach the API server, you get **HTTP 500 errors**.

## Common Tasks

### Add a New UI Component
UI components are already set up from shadcn/ui. Check `src/components/ui/` to see available components.

### Modify Styling
- Global styles: `src/index.css` or `src/portfolio.css`
- Component-specific styles are in individual component files

### Work with Data
- Check `lib/supabaseClient.ts` for database setup
- Use `lib/portfolioMath.ts` for calculations
- Use `lib/dashboardBehavior.ts` for business logic

### Add Internationalization
- Modify `lib/i18n.ts` to add new languages
- Use translations in components

### Handle Authentication
- Authentication is managed in `AuthGate.tsx`
- Place protected routes/components inside the auth gate

## Development Workflow

1. **Make code changes** in `src/` folder
2. **Vite hot-reloads** automatically - just save and check the browser
3. **Check the browser** at http://localhost:3001/
4. **If something breaks**, check terminal for error messages

## Building for Production

```bash
npm run build
```

Output will be in the `dist/` folder.

## Dependencies

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **shadcn/ui** - Pre-built components
- **Supabase** - Backend/Database
- **Sonner** - Toast notifications (see `components/ui/sonner.tsx`)

## Troubleshooting

### "Couldn't load your portfolio" - HTTP 500 Internal Server Error

**Cause:** The backend API server is NOT running.

**Fix:** Start the API server in a separate terminal:

Terminal 1:
```bash
cd '/g/tp/ai/portofolio-dashbaord/artifacts/api-server'
pnpm run build  # Build the dist/ folder if not present
PORT=8080 pnpm run start
```

Wait for: `Server listening` on port 8080

Then refresh the frontend.

### Tailwind CSS Native Binding Error

**Error:** `Error: Cannot find native binding. npm has a bug related to optional dependencies`

**Cause:** The `@tailwindcss/oxide` native module isn't properly built for Windows.

**Fix:** Clear node_modules and reinstall:
```bash
cd '/g/tp/ai/portofolio-dashbaord'
rm -rf node_modules  # Clear all modules
pnpm install --no-frozen-lockfile --force
```

Then try starting the dev server again.

### Frontend Won't Start with Git Bash

If the frontend still won't start, make sure the API server is running first (port 8080), then try:

```bash
cd '/g/tp/ai/portofolio-dashbaord/artifacts/portfolio'
PORT=3000 pnpm run dev
```

### Port Already in Use

- **Port 3000** (Frontend): Vite will try port 3001, 3002, etc. if 3000 is taken
- **Port 8080** (Backend): Kill the process on port 8080 or use a different PORT variable

### Module Not Found or Build Errors

Always run from the **root directory** `g:\tp\ai\portofolio-dashbaord` to use the monorepo setup:

```bash
cd '/g/tp/ai/portofolio-dashbaord'
pnpm install
```

### Blank Page / Loading Forever
1. Check browser console (F12) for JavaScript errors
2. Check terminal output for both servers for error messages
3. Verify both servers are running:
   - Backend: Port 8080 should show `Server listening`
   - Frontend: Port 3000 should show Vite ready message
4. Make sure `.env` files exist in both `artifacts/portfolio/` and `artifacts/api-server/` directories
5. Try refreshing the page (Ctrl+Shift+R for hard refresh)

## Tips for Model Assistance

When asking for help:
1. Describe what component you're working on
2. Mention if it's a UI issue, logic issue, or styling issue
3. Check the relevant file in `lib/` or `components/`
4. For authentication issues, mention `AuthGate.tsx`

## Next Steps

- Review the UI components in `src/components/ui/` for available building blocks
- Check `lib/` files to understand the business logic
- Explore `App.tsx` to understand the main app structure
- Look at `AuthGate.tsx` for authentication flow
