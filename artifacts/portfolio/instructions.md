# Portfolio Dashboard - Development Instructions

## 📚 IMPORTANT: CHECK MEMORY FILES FIRST

**Before starting development, check if there are active notes about this project:**

### Memory Files to Check (if they exist)
1. **`/memories/session/frontend-startup-progress.md`** 
   - Session-specific notes about current setup/issues
   - Contains troubleshooting steps from this conversation
   
2. **`/memories/repo/yahoo-finance-issue.md`**
   - Repository-scoped notes about Yahoo Finance integration
   - Documents missing implementations and compatibility issues
   
3. **`/memories/` (root memory folder)**
   - User preferences and general project patterns
   - Persistent notes across all conversations

**How to Access Them:**
- Session memory notes are stored locally in VS Code workspace
- Check the debug logs folder: `c:\Users\HP\AppData\Roaming\Code\User\workspaceStorage\26c1860b74c214b7d620eb50dd285d02\GitHub.copilot-chat\debug-logs\`
- Or ask Copilot to read memory files directly using the `memory` tool

**If Memory Files Exist:** Read them first! They contain:
- Previously discovered issues and solutions
- Environment setup quirks
- Dependencies that have already been debugged
- API/Backend issues already documented

---

## � AI MODEL STARTUP CHECKLIST (DO THIS FIRST)

**Every AI session should start with these steps:**

- [ ] **1. Read memory files** - Check `/memories/session/`, `/memories/repo/`, `/memories/`
- [ ] **2. Read this file** - Especially [Environment Requirements](#environment-requirements-must-have) & [MOST COMMON ISSUES](#most-common-issues)
- [ ] **3. Check Node version** - Run: `node --version` (must be v22+)
- [ ] **4. Check pnpm version** - Run: `pnpm --version` (must be v11.17.0+)
- [ ] **5. Check Git Bash** - Ensure using Git Bash, NOT PowerShell
- [ ] **6. Identify the actual issue** - Use [🆘 MOST COMMON ISSUES](#most-common-issues) table to find matching error

**If the issue isn't in the table:**
1. Document it in memory files
2. Research the root cause
3. **ADD THE SOLUTION TO THIS FILE** before ending the session
4. Update the [🆘 MOST COMMON ISSUES](#most-common-issues) table

---

### Update Instructions.md While Working
**If you discover NEW issues or solutions while working, ADD THEM TO THIS FILE immediately:**

1. **Found a new bug/issue?** → Add to the [🆘 MOST COMMON ISSUES](#most-common-issues) table
2. **Discovered a better fix?** → Update the relevant solution section
3. **Encountered a Windows-specific error?** → Add to [Windows-Specific Issues](#windows-specific-issues-encountered) table
4. **Fixed a dependency problem?** → Document it in [Troubleshooting](#troubleshooting) section

**Examples of things to document:**
- "Version X of pnpm doesn't work with this setup" → Add to requirements
- "This flag solved the EPERM error" → Add to troubleshooting
- "This environment variable must be set" → Add to environment section
- "This Node.js version causes issues" → Update version requirements

### Why This Matters
- The instructions.md file is the **single source of truth** for this project
- It saves future developers hours of debugging
- It prevents the same issues being solved repeatedly
- Future AI sessions read this file to understand past solutions

### Update Format
```markdown
### Issue: "[Problem description]" (NEW - YYYY-MM-DD)
**Root Cause**: [Why it happens]
**Symptoms**: [What you see when this happens]
**Solution**:
[Step-by-step fix]
**Status**: [Fixed/Workaround/Investigating]
```

### Memory File Coordination
- Keep **instructions.md** for permanent solutions and setup guide
- Use **memory files** (`/memories/`) for session-specific notes and investigation progress
- When investigation concludes, move the solution TO this instructions.md

### How to Edit This File (For AI Models)
**When adding new content to this file:**

1. **For new issues:** Add to the [🆘 MOST COMMON ISSUES](#most-common-issues) table
   - Format: `| Issue Name | Root Cause | Fix |`
   - Keep it concise and scannable

2. **For new solutions:** Create a new subsection in [Troubleshooting](#troubleshooting)
   - Use format: `### Issue: "[Problem]" (NEW - DATE)`
   - Always include Root Cause, Symptoms, Solution, Status

3. **For environment changes:** Update [Environment Requirements](#environment-requirements-must-have)
   - Keep checklist format with ✅ and ❌
   - Add version numbers with dates

4. **For complex fixes:** Create new section with header
   - Use clear hierarchy (### for issues, #### for substeps)
   - Include code blocks with ```bash for commands
   - Include comments explaining WHY it works

5. **For quick notes:** Use session memory files first
   - Move to instructions.md when solution is verified

**Tools to use:**
- Use `replace_string_in_file` tool to update specific sections
- Use `multi_replace_string_in_file` for multiple edits at once
- ALWAYS include 3-5 lines of context before/after your edits

---

## ⚡ QUICKEST START (60 seconds)

### App Start Rule
**When the user asks to start the app, the backend must be started first as part of the same workflow.**
- Backend: `artifacts/api-server` on port `8080`
- Frontend: `artifacts/portfolio` on port `3001`
- This should happen automatically whenever the app is launched from this repo unless the user explicitly says otherwise.

### Windows Users - SETUP GIT BASH FIRST
**⚠️ CRITICAL: PowerShell WILL NOT WORK - you must use Git Bash**

**Step 1: Set Git Bash as default terminal in VS Code**
1. Open VS Code terminal: `Ctrl + ~`
2. Click the dropdown arrow next to "+" in the terminal panel
3. Select "Git Bash" (if not listed, click "Select Default Profile" and choose Git Bash)
4. Close current terminal (`Ctrl + Shift + ~`) and open new one (`Ctrl + ~`)
5. Verify prompt shows `$` (bash), NOT `>` (PowerShell)

**Step 2: Setup (run ONCE in Git Bash)**
```bash
cd '/g/tp/ai/portofolio-dashbaord'
pnpm install --ignore-scripts --shamefully-hoist --no-frozen-lockfile --prefer-offline
pnpm rebuild  # Critical for Windows: compiles native modules like esbuild
```

**Step 3: BACKEND FIRST - Terminal 1 (REQUIRED - runs on port 8080)**
⚠️ **START THIS FIRST - Frontend won't work without it!**
```bash
cd '/g/tp/ai/portofolio-dashbaord/artifacts/api-server'
# Clear inherited values so dotenv loads the repository Supabase configuration.
unset DATABASE_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY
PORT=8080 node --enable-source-maps ./dist/index.mjs
```
✅ Wait for this output before starting frontend:
```
Server listening port: 8080
gold-price-cache: scraped fresh prices
```
✅ Also confirm the backend log says `Using database host` with the Supabase host, not `localhost`.

The backend automatically loads `../../.secrets/api-server.env`. That file must contain the real
`DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` values. Do not put these secrets in
`artifacts/portfolio/.env` or commit them to the repository.

**Step 4: FRONTEND - Terminal 2 (runs on port 3001)**
```bash
cd '/g/tp/ai/portofolio-dashbaord/artifacts/portfolio'
PORT=3001 pnpm run dev
```

**App URL:** http://localhost:3001/
⚠️ **BOTH servers must be running simultaneously**

⚠️ **IMPORTANT**: Use **Git Bash ONLY**!
- PowerShell has execution policy blocking npm/pnpm commands
- Git Bash has `sh` support for the preinstall script
- If you see PowerShell `>` prompt, your terminal is wrong - change it in VS Code settings

---

## 🆘 MOST COMMON ISSUES

| Issue | Cause | Fix |
|-------|-------|-----|
| SmartAdvisor Token Limit Issue (Groq API) | SmartAdvisor API request too large for Groq model | See [SmartAdvisor Token Limit Issue](#smartadvisor-token-limit-issue-new-2026-08-16) |
| "The server does not support SSL connections" | Database can't connect to Supabase over SSL (Windows firewall issue) | See [Database SSL Connection Issue](#database-ssl-connection-issue-new-2026-08-16) |
| "Couldn't load your portfolio. HTTP 500 Internal Server Error" | Backend API not running OR database SSL error | **Start backend FIRST**: `cd artifacts/api-server && PORT=8080 node --enable-source-maps ./dist/index.mjs` (see [QUICKEST START](#-quickest-start-60-seconds)) |
| Dashboard shows zeros or "database is empty" | An inherited `DATABASE_URL` points to an empty local database | In the backend terminal run `unset DATABASE_URL SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY`, then restart the backend so it loads `../../.secrets/api-server.env` |
| "running scripts is disabled on this system" | Using PowerShell instead of Git Bash | **Set Git Bash as default terminal in VS Code** (see [QUICKEST START](#-quickest-start-60-seconds)) |
| "Cannot find native binding" | Native modules not compiled | `pnpm install --shamefully-hoist --force` |
| "Cannot find package esbuild" | pnpm using nested modules | Add `--shamefully-hoist` flag |
| "Unsupported URL Type catalog:" | Using npm instead of pnpm | Use `pnpm.cmd` or `pnpm` |
| "sh is not recognized" | Preinstall script uses `sh` | Use `pnpm install --ignore-scripts` or Git Bash |
| Port already in use | Another app on same port | `PORT=4000 pnpm run dev` |
| EPERM: operation not permitted (esbuild) | Antivirus/Windows blocking file ops | Close other terminals; try `pnpm install --prefer-offline` |

---

## SmartAdvisor Token Limit Issue (NEW - 2026-08-16)

### Problem
When portfolio loads, the SmartAdvisor panel throws: 
```
Error handling model response
Request too large for model 'llama-3.3-70b-version-3' context_length_exceeded
```

### Root Cause
The backend's SmartAdvisor feature generates AI recommendations using Groq's Llama 3.3 API. When analyzing portfolio data, the context (portfolio state + analysis prompt) exceeds Llama 3.3's token limit of 12,000 tokens.

**Current state:** Request size = 16,733 tokens (4,733 tokens over limit)

### Solutions

**Option 1: Disable SmartAdvisor (QUICKEST - recommended for now)**
1. Edit [src/App.tsx](src/App.tsx#L183)
2. Comment out or remove the `<SmartAdvisorPanel />` line
3. Frontend will load portfolio data without advisor recommendations

**Option 2: Reduce context size in SmartAdvisor**
- Edit [src/components/SmartAdvisorPanel.tsx](src/components/SmartAdvisorPanel.tsx#L60)
- Reduce the number of holdings analyzed or simplify the analysis prompt
- Target: reduce context to <10,000 tokens

**Option 3: Switch to different AI model** (requires backend changes)
- Update backend API to use Groq's Llama 3.1 405B (larger context: 131k tokens)
- Or switch to Claude 3.5 Sonnet via Anthropic API
- Requires adding API key configuration to `.env`

### Status
**Investigating** - Will need to decide whether to:
1. Remove SmartAdvisor as non-essential feature
2. Rewrite to work within token limits
3. Switch to larger-context model

---

## Database SSL Connection Issue (NEW - 2026-08-16)

### Problem
Backend API shows repeated errors:
```
Error: Failed query: select "id", "cashback_per_gram" from "gold_settings"
caused by: Error: The server does not support SSL connections
```
Portfolio data fails to load with **HTTP 500 Internal Server Error**.

### Root Cause
This is a **Windows firewall / SSL certificate validation issue** when connecting to remote Supabase PostgreSQL database. 

The backend tries to connect via: `postgresql://postgres:PASSWORD@db.gcyuahzdvaodrqijjqba.supabase.co:5432/postgres`

Attempted fixes that didn't work:
- ❌ `?sslmode=disable` - Still fails with SSL error
- ❌ `?sslmode=require` - Still fails with SSL error  
- ❌ Restarting backend - Error persists

This suggests the issue is at the OS/network level, not the connection string.

### Why This Matters
**The app cannot run without database access** - every feature (portfolio data, gold prices, fund holdings, certificates, transactions) requires querying the Supabase database.

### Solutions

**Option 1: Use Local PostgreSQL** (RECOMMENDED for development)
1. Install PostgreSQL 15+ on Windows
2. Create a local database matching schema in `artifacts/api-server/src/lib/migrations/`
3. Update `.env`: `DATABASE_URL=postgresql://postgres:password@localhost:5432/portfolio`
4. Run migrations to set up tables

**Option 2: Disable Windows Firewall** (RISKY - for testing only)
- Temporarily disable Windows Defender Firewall or allow Node.js through it
- `Settings → Privacy & Security → Windows Security → Firewall → Allow apps through firewall`
- Add Node.js and Git to allowed apps

**Option 3: Use Windows Proxy/VPN** (If behind corporate firewall)
- Configure proxy in `.env` or Node environment:
  ```bash
  set HTTP_PROXY=http://proxy-server:port
  set HTTPS_PROXY=http://proxy-server:port
  ```

**Option 4: Test from Different Network**
- Try running on WiFi, different PC, or mobile hotspot to isolate if it's network-specific

### Status
**BLOCKED** - Database connectivity required to proceed. Need to implement one of the above solutions before portfolio can load.

⚠️ **BACKEND MUST RUN FIRST - Frontend depends on it for portfolio data**

**Terminal 1 - Backend API Server (REQUIRED - port 8080):**
```bash
cd g:\tp\ai\portofolio-dashbaord\artifacts\api-server
PORT=8080 node --enable-source-maps ./dist/index.mjs
```
✅ Wait for: `Server listening port: 8080`

**Terminal 2 - Frontend (port 3001):**
```bash
cd g:\tp\ai\portofolio-dashbaord\artifacts\portfolio
PORT=3001 pnpm run dev
```

**App URL:** http://localhost:3001/

**BOTH must be running simultaneously or you'll see "HTTP 500 Internal Server Error"**

---

## � LESSONS LEARNED & NOTES FOR NEXT TIME

### Why This Setup is Complicated
This is a **monorepo** (multiple packages in one repo) managed by **pnpm** with these constraints:
1. **Native modules**: Tailwind CSS uses Rust-compiled bindings (@tailwindcss/oxide, esbuild, Rollup)
   - Must compile for Windows x64 specifically
   - Antivirus/Windows file locks can prevent installation
2. **pnpm catalog system**: Uses custom `catalog:` URLs for version syncing
   - npm doesn't understand this (only pnpm does)
   - Must use `pnpm` or `pnpm.cmd`, never `npm`
3. **Nested node_modules by default**: pnpm uses strict dependency isolation
   - Build tools can't find each other's dependencies
   - Need `--shamefully-hoist` flag to flatten the tree

### Installation Order (CRITICAL)
```bash
# ✅ CORRECT ORDER (Windows with preinstall script issue):
1. cd g:\tp\ai\portofolio-dashbaord
2. pnpm install --ignore-scripts --shamefully-hoist --no-frozen-lockfile --prefer-offline
3. pnpm rebuild                    # ← CRITICAL: Rebuild native modules (esbuild, etc)
4. cd artifacts/portfolio
5. pnpm run dev

# OR (if no 'sh' error, standard flow):
1. cd g:\tp\ai\portofolio-dashbaord
2. pnpm install --shamefully-hoist
3. cd artifacts/portfolio
4. pnpm run dev

# ❌ WRONG (will fail):
1. cd g:\tp\ai\portofolio-dashbaord\artifacts\portfolio
2. npm install       # ← Will fail with "Unsupported URL Type catalog:"
3. pnpm run dev
```

### Windows-Specific Issues Encountered
| Issue | Why | Solution |
|-------|-----|----------|
| Preinstall script fails with "'sh' is not recognized" | Windows doesn't have `sh` by default; script in package.json runs bash | Use `pnpm install --ignore-scripts` first, then `pnpm rebuild` to compile native modules |
| "@esbuild/win32-x64 could not be found" | Using `--ignore-scripts` skips postinstall compilation | After `--ignore-scripts` install, run `pnpm rebuild` to compile platform-specific binaries |
| EPERM on esbuild rename | File locks / antivirus blocking file operations | Use `--prefer-offline` flag or close other terminals |
| PowerShell "execution policy" error | Windows security policy blocks npm scripts | Use `cmd.exe`, `pnpm.cmd`, or Git Bash |
| Git Bash unavailable in VS Code environment | This machine exposes PowerShell terminals only | Use `pnpm.cmd` from PowerShell; set `$env:PORT` before starting each service |
| "Cannot find package" errors | Missing `--shamefully-hoist` flag | Always add this flag when installing |

### Startup Verification (2026-08-22)
- Node.js `v24.18.0` and pnpm `v11.17.0` satisfy the documented requirements.
- Git Bash was not available, and PowerShell blocked the `pnpm.ps1` shim. `pnpm.cmd` worked correctly.
- Backend started successfully on port `8080` with live EUR/EGP, USD/EGP, XAU/USD, and gold-price cache updates.
- Frontend started successfully on port `3001` at http://localhost:3001/.
- Backend reachability was verified through `/api/portfolio`, which returned the expected `401` without a Supabase session; this build does not register `/healthz`.
- After rebuilding with host-aware SSL normalization, the backend no longer reports the SSL connection error. `PORTFOLIO_OWNER_USER_ID` was set to the Supabase user UUID, and unauthenticated portfolio probes now correctly return `401` instead of `503`.
- The dashboard showed zeros because an inherited `DATABASE_URL` selected an empty local database. The backend was restarted with the Supabase URL from `artifacts/api-server/.env`, and `start-backend.bat` now clears the inherited value so dotenv loads the configured Supabase database.
- The direct Supabase host then failed with `getaddrinfo ENOTFOUND`: this Windows network exposes only an IPv6 record for the direct database host, while PostgreSQL port `5432` is unreachable. Use the IPv4-compatible Supabase pooler URL from the project Connect dialog, preferably port `6543`, instead of changing SSL flags.
- The Supabase Session pooler connection was applied and verified on 2026-08-22: host `aws-1-eu-west-1.pooler.supabase.com`, port `5432`, database `postgres`, user `postgres.gcyuahzdvaodrqijjqba`. The API now starts with this host and an unauthenticated `/api/portfolio` probe returns `401` rather than DNS/SSL `500`.
- For this project, use the Session pooler URI format `postgresql://postgres.gcyuahzdvaodrqijjqba:<encoded-password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`. Never commit or paste the password; percent-encode special characters.
- The pooler then returned `EADDRNOTALLOWED address not in tenant allow_list: {41, 234, 244, 139}`. This means Supabase Network Restrictions are blocking the current public IP, not that the URI or SSL is wrong. In Supabase, open **Project Settings -> Database -> Network Restrictions**, add the current public IPv4 as an allowed address (or temporarily allow all IPv4 addresses for testing), save, then restart the API.
- After the IPv4 restriction was added, the pooler reached Supabase but rejected the database credentials with `ECIRCUITBREAKER: too many authentication failures, new connections are temporarily blocked`. The allow-list is therefore fixed; reset the database password in Supabase, copy the new Session pooler URI, percent-encode special characters, update `artifacts/api-server/.env`, and restart the API.
- The reset Session pooler credential was applied locally and verified with `SELECT 1`; the API now starts successfully against the pooler. Keep the credential in ignored local environment files only, never in GitHub.
- AI Insights previously showed `Run failed (503)` because Supabase lacked `bot_runs` and `portfolio_value_history`. The existing schema migrations were applied in dependency order without the watchlist seed, so the AI route now has its required tables without adding portfolio data.
- The next AI run also required comparison entities: `comparison_watchlist` was empty, so Price Checker had zero entities and displayed a misleading all-failed state. Public watchlist migrations `002` and `004` were applied; Supabase now has 60 comparison entities and no personal portfolio values were added.
- Migration audit completed: the authoritative root migration set passed twice in dependency order, all required tables exist, and no duplicate advisor run keys block migration `011`. The legacy overlapping migration directory under `artifacts/api-server/src/lib/migrations` should not be applied to this database.
- Scraper source map: StockAnalysis provides stock prices, fundamentals, and available historical returns; FoudaLens provides fund NAVs and index levels, plus comparison-only stock fields not exposed by StockAnalysis.
- Stock history retrieval checks multiple StockAnalysis history pages for 30-day, YTD, and one-year comparison dates. A dash means StockAnalysis did not provide sufficient history; Yahoo Finance is not used as a fallback.
- StockAnalysis overview pages expose chart reference prices (`price1m`, `priceYTD`, `price1y`) in embedded data; the parser now uses these to calculate period returns, including YTD, before falling back to history rows.
- Final Gemini audit: the screenshot scanner fallback now starts with `gemini-3.6-flash`, matching Smart Advisor; the retired `gemini-2.0-flash` model is no longer actively used.
- AI Scanner no longer displays a Set API Key prompt or sends client credentials. Configure `GEMINI_API_KEY` only in repository-root `.secrets/api-server.env`; restart the API after changing it.
- The reviewed dated order import completed directly in Supabase: 10 new transactions were inserted and 4 duplicates were skipped. Temporary import scripts were deleted and no personal amounts were documented in source files.
- StockAnalysis currently has no supported pages for `EGX30`, `EGX70 EWI`, or `EGX100 EWI`; those indices remain on the FoudaLens index page. Do not invent StockAnalysis index URLs or substitute company prices for index levels.
- The AI Bot requires the server-side `GEMINI_API_KEY` environment variable. Put it in ignored `.secrets/api-server.env`; a browser/localStorage key does not configure the backend.
- The backend secret file must be at repository root `.secrets/api-server.env`, not `artifacts/portfolio/.secrets/api-server.env`; after correcting this location the API loaded the secrets and `/api/portfolio` returned `200`.
- If Smart Advisor reports Gemini API `404` for `gemini-2.0-flash`, the model is retired; the backend now uses `gemini-3.6-flash`.
- A page error `ERR_CONNECTION_REFUSED` on port `3001` means the local dev server is stopped. Restart the API on `8080` and frontend on `3001`; the sorting change itself did not cause this error.
- After the password reset, direct authenticated database access was verified with `SELECT 1`. The portfolio tables in the selected Supabase database currently contain no rows (`gold_transactions`, `gold_settings`, `portfolio_settings`, `funds`, `certificates`, `transactions`, and `growth_snapshots` all returned zero), so the remaining empty dashboard is missing data rather than a connection failure. Do not create placeholder values; import the real portfolio backup into this same Supabase database or select the database that contains the records.
- Privacy check: no portfolio balances or transactions are stored in browser `localStorage`, `sessionStorage`, or IndexedDB. Browser storage is limited to non-financial preferences/advisor timestamps and an optional Gemini key; financial figures are fetched from the API database. Do not restore real values from local files or add client-side financial fallbacks.
- Start the backend first, then the frontend. Keep both terminals running together.

### Performance Tips
- First install takes 5-10 minutes (downloading/compiling native modules)
- Subsequent installs are much faster (~30 seconds)
- Use `--prefer-offline` if network is slow or flaky
- On slow machines, `pnpm install --prefer-offline --shamefully-hoist` works best

### Environment Requirements (MUST HAVE)
✅ Node.js v22+ (or v24.18.0 as installed)
✅ pnpm v11.17.0+
✅ Windows x64 (required for native module compilation)
❌ npm will NOT work (use pnpm only)
❌ Older Node versions <v22 incompatible with yahoo-finance2

### Files to Know
- `pnpm-workspace.yaml` - Monorepo configuration, catalog versions, supply-chain settings
- `package.json` (root) - Workspace scripts, root dependencies
- `artifacts/portfolio/package.json` - Frontend dependencies (using catalog: URLs)
- `artifacts/portfolio/vite.config.ts` - Vite build config with React, Tailwind, plugins
- `tsconfig.base.json` - Shared TypeScript config for entire monorepo

---
## 🤖 AI MODEL EXPECTATIONS & RESPONSIBILITIES

**When an AI model (like Copilot) works on this project, they MUST:**

### BEFORE Starting Work
1. ✅ **Read this instructions.md file** - Understand project constraints and setup
2. ✅ **Check memory files** - Look for session/repo notes about known issues
3. ✅ **Verify environment** - Confirm Node v22+, pnpm v11.17.0+
4. ✅ **Document discoveries** - Add findings to this file or memory files

### WHILE Working on This Project
1. ✅ **Update instructions.md immediately** when discovering:
   - New errors or issues not in this file
   - Better solutions to existing problems
   - New environment quirks or incompatibilities
   - Version conflicts or dependency issues
   
2. ✅ **Create/update memory files** for:
   - Session-specific investigation progress (`/memories/session/`)
   - Repository-scoped findings (`/memories/repo/`)
   - User preferences (`/memories/`)

3. ✅ **Test on Windows** - This is a Windows-first project:
   - Use Git Bash, not PowerShell
   - Consider antivirus/file lock issues
   - Test with proper environment variable handling

4. ✅ **Communicate clearly** - Document:
   - Why a solution works (not just HOW to do it)
   - Environment constraints and requirements
   - Known incompatibilities
   - Future developers' gotchas

### WHEN Encountering NEW Issues
1. **Don't guess** - Search/verify the root cause
2. **Document it** - Add to instructions.md or memory files
3. **Test the fix** - Verify solution works before moving on
4. **Update this file** - Leave traces for next developer

### Quality Standards for Documentation
- ❌ DON'T: "Fixed error by running command X"
- ✅ DO: "Error was caused by [root cause]. Fixed with [command]. Works because [explanation]"

- ❌ DON'T: "Use pnpm instead of npm"
- ✅ DO: "Use pnpm (not npm) because pnpm-workspace.yaml uses custom `catalog:` URLs that npm doesn't understand"

- ❌ DON'T: "Run with --shamefully-hoist flag"
- ✅ DO: "Run with --shamefully-hoist because pnpm's strict dependency isolation prevents build tools from finding each other. This flag flattens the node_modules tree."

---
## �📋 Smart Advisor Integration Progress

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

## ⚠️ CURRENT STATUS (2026-08-16)

### ✅ Working
- **API Backend Server** - Running on port 8080 ✅
  - All endpoints operational (healthz, portfolio, advisor, etc.)
  - Successfully fetching market data (USD/EGP rates, gold prices, XAU/USD)
  - Database connection established to Supabase
  - Authentication middleware requiring valid Supabase JWT tokens

- **Frontend Dev Server** - Running on port 3000 ✅  
  - Vite dev server running with hot module reloading
  - Tailwind CSS Rust compiler working (@tailwindcss/oxide)
  - Native module bindings resolved (esbuild, Rollup, Lightning CSS)
  - Vite proxy configured to forward `/api/*` requests to `http://localhost:8080`

### 🔧 CURRENT ISSUE - Authentication Required

**Status**: Frontend starts successfully but shows "Loading your portfolio..." then fails with 401 UNAUTHENTICATED

**Root Cause**: No authenticated Supabase user session available

**What's Happening:**
1. Frontend loads and checks for Supabase session via AuthGate
2. If a session exists in localStorage/cookies, it bypasses the login screen
3. App.tsx calls `/api/portfolio` endpoint
4. Backend requires Authorization header with valid Supabase JWT token
5. If token is invalid/expired, API returns 401

**Solution - Create Test User in Supabase:**

You must create a test user account in Supabase before the app will work:

```
1. Go to: https://app.supabase.com/
2. Log in with your Supabase account
3. Open project: gcyuahzdvaodrqijjqba
4. Navigate to: Authentication → Users
5. Click "Add user" 
6. Create test user:
   - Email: test@example.com
   - Password: TestPassword123!
7. Copy the user ID and save it

Then log in to http://localhost:3000/ with these credentials.
```

**Alternative - Clear Session and Log In:**
If there's an old session, clear browser storage:
```
Open browser DevTools (F12)
→ Application → Local Storage → Clear All
→ Application → Cookies → Delete portfolio cookies
→ Refresh page
→ Log in with valid Supabase credentials
```

**Verification:**
Once logged in, you should see:
- Portfolio data loading
- No more "Loading..." message
- Dashboard with funds, gold holdings, transaction history
- Smart Advisor panel with recommendations

## ⚙️ ENVIRONMENT & DEPENDENCIES

### Node.js & Package Manager
- **Node.js**: v24.18.0 (or v22+)
  - Requirement: Node 22+ for yahoo-finance2 v4 compatibility
  - Check: `node --version`
- **pnpm**: v11.17.0+ (required - npm will fail with monorepo)
  - Check: `pnpm --version`
  - Location: `C:\Users\HP\AppData\Roaming\npm\pnpm.cmd`
  - Why: This is a monorepo with `pnpm-workspace.yaml` catalog system
  - npm will complain about `catalog:` URLs (unsupported protocol)

### Key Dependencies with Native Bindings
⚠️ These require proper Windows x64 installation:
1. **@tailwindcss/oxide** - Tailwind CSS Rust-compiled native module
2. **@rollup/rollup-win32-x64-msvc** (v4.62.2) - Rollup Windows binary
3. **esbuild** - JavaScript/TypeScript bundler with native bindings
4. **lightningcss-win32-x64-msvc** - Lightning CSS native Windows module

### Installation Flags (IMPORTANT)
```bash
# Use --shamefully-hoist to flatten node_modules
pnpm install --shamefully-hoist

# This merges nested pnpm stores into root node_modules
# Required for: Vite, Tailwind, and build tools to find each other
```

### TypeScript Configuration
- **tsconfig.json**: Root config with monorepo base paths
- **tsconfig.base.json**: Shared base configuration
- **artifacts/portfolio/tsconfig.json**: Frontend-specific config
- Vite uses TypeScript config automatically (vite.config.ts)

### Port Configuration
- **Frontend (Portfolio)**: PORT=3000 (configurable via env)
- **Backend (API Server)**: PORT=8080 (configurable via env)
- Vite runs with `--host 0.0.0.0` to allow network access

---

## 🚀 WORKING START METHODS (2026-08-16)

### Method 1: pnpm (RECOMMENDED - What Works)
```bash
# REQUIRED: Full install with shamefully-hoist flag
cd g:\tp\ai\portofolio-dashbaord
pnpm install --shamefully-hoist

# Terminal 1: Backend
cd artifacts/api-server
pnpm run start   # Uses PORT=8080 by default

# Terminal 2: Frontend
cd artifacts/portfolio
pnpm run dev     # Uses PORT=3000 by default
```

### Method 2: Git Bash (Workaround for PowerShell restrictions)
```bash
# Use Git Bash if PowerShell has execution policy issues

# Terminal 1: Backend
"C:\Program Files\Git\bin\bash.exe" -c "cd '/g/tp/ai/portofolio-dashbaord/artifacts/api-server' && PORT=8080 pnpm run start"

# Terminal 2: Frontend
"C:\Program Files\Git\bin\bash.exe" -c "cd '/g/tp/ai/portofolio-dashbaord/artifacts/portfolio' && PORT=3000 pnpm run dev"
```

### Method 3: cmd.exe (Bypass PowerShell)
```cmd
# Use cmd.exe if PowerShell execution policy is blocking

cd /d g:\tp\ai\portofolio-dashbaord\artifacts\portfolio
pnpm.cmd run dev

# Or with explicit port
cd /d g:\tp\ai\portofolio-dashbaord\artifacts\portfolio && SET PORT=3000 && pnpm.cmd run dev
```

### Method 4: Batch Files (From root)
```batch
cd g:\tp\ai\portofolio-dashbaord

# Terminal 1
start-backend.bat    # Runs on port 8080

# Terminal 2  
start-frontend.bat   # Runs on port 3000
```

---

## 🔍 TROUBLESHOOTING CHECKLIST

### Issue: "Cannot find native binding" errors
**Root Cause**: Native modules (@tailwindcss/oxide, Rollup, esbuild) not compiled for Windows x64
**Solution**:
```bash
cd g:\tp\ai\portofolio-dashbaord
rm -rf node_modules artifacts/*/node_modules
pnpm install --shamefully-hoist --force
```

### Issue: "Cannot find package esbuild/rollup/tailwind"
**Root Cause**: pnpm strict dependency resolution (uses nested node_modules)
**Solution**:
```bash
pnpm install --shamefully-hoist  # Flatten dependency tree
```

### Issue: "Unsupported URL Type 'catalog:'"
**Root Cause**: Using npm instead of pnpm (npm doesn't understand pnpm catalog references)
**Solution**: Use `pnpm.cmd` instead of `npm`

### Issue: PowerShell execution policy error
**Root Cause**: Windows PowerShell security policy blocking npm/pnpm scripts
**Solutions**:
- Use `cmd.exe` or Git Bash instead
- Or: Use batch files (start-backend.bat, start-frontend.bat)
- Or: Run `pnpm.cmd` explicitly instead of `pnpm`

### Issue: Port already in use
**Solution**:
```bash
# Use custom ports
PORT=4000 pnpm run dev    # Frontend on 4000
PORT=9000 pnpm run start  # Backend on 9000
```

### Issue: "EPERM: operation not permitted" (esbuild/Windows)
**Root Cause**: Windows file system or antivirus blocking rename operations during esbuild installation
**Symptoms**: Error during `pnpm install`, file rename fails for esbuild package
**Solutions** (in order of effectiveness):
1. **Close other terminals and IDE instances**
   - Close VSCode, close other PowerShell/cmd terminals
   - This releases file locks that may block the operation
2. **Use offline mode to skip re-downloading**
   ```bash
   pnpm install --prefer-offline
   ```
3. **Full clean reinstall with retry**
   ```bash
   cd g:\tp\ai\portofolio-dashbaord
   pnpm install --shamefully-hoist --force --no-frozen-lockfile
   ```
4. **Disable Windows antivirus temporarily**
   - Some antivirus software (McAfee, Norton, Avast) block file operations
   - Try temporarily disabling real-time protection
5. **If all else fails: Use Docker or remote dev environment**
   - pnpm works reliably on Linux/Mac
   - Consider using WSL2 (Windows Subsystem for Linux)

### ⚠️ TROUBLESHOOTING IF STUCK (Step-by-Step Recovery)

**If installation fails with "sh is not recognized", follow these steps:**

The root `package.json` has a preinstall script that uses `sh` (shell), which doesn't exist on Windows by default.

**Solution: Disable preinstall script temporarily**

```bash
# Use --ignore-scripts flag to skip the problematic preinstall
pnpm install --ignore-scripts --shamefully-hoist --no-frozen-lockfile --prefer-offline

# Then verify installation
pnpm list --depth=0

# Start frontend
cd artifacts/portfolio
pnpm run dev
```

**If that doesn't work, use Git Bash or WSL2:**
```bash
# Git Bash handles the sh -c command natively
"C:\Program Files\Git\bin\bash.exe" -c "cd '/g/tp/ai/portofolio-dashbaord' && pnpm install --shamefully-hoist"
```

---

**If installation fails with ANY other error, follow this checklist:**

```bash
# Step 1: Stop all running processes
# Close all Terminal/PowerShell/cmd/VSCode windows
# Wait 10 seconds

# Step 2: Check for file locks
# Open Task Manager → find "node.exe", "pnpm", "npm" → End Task
# Close VSCode completely (it may be locking files)

# Step 3: Clean everything
cd g:\tp\ai\portofolio-dashbaord
pnpm store prune        # Clean pnpm cache
rm -r node_modules      # Delete node_modules (use PowerShell)

# If PowerShell fails, use cmd.exe:
cmd /c "cd /d g:\tp\ai\portofolio-dashbaord && rmdir /s /q node_modules"

# Step 4: Full fresh install
pnpm install --shamefully-hoist --no-frozen-lockfile --prefer-offline

# Step 5: Verify installation
pnpm list --depth=0    # Should show all packages installed

# Step 6: Start frontend
cd g:\tp\ai\portofolio-dashbaord\artifacts\portfolio
pnpm run dev           # Should see "VITE vX.X.X ready in XXXms"
```

**If you still get errors:**

1. Try from a **fresh cmd.exe window** (right-click → "Run as administrator")
2. Use `pnpm.cmd` explicitly instead of `pnpm`
3. Check if antivirus is running → disable it temporarily
4. Verify Node version: `node --version` (should be v22+)
5. Clear pnpm global cache: `pnpm config set store-dir %APPDATA%\pnpm-store`
6. As last resort: Use WSL2 or Docker (pnpm works perfectly on Linux)

---

## ✅ VERIFICATION & DEBUGGING

### How to Verify Frontend is Running
```bash
# Check if Vite dev server started
# Look for output like:
#   VITE v7.x.x ready in XXX ms
#   ➜  Local:   http://localhost:3000/
#   ➜  Network: http://192.168.x.x:3000/

# Browser should load at: http://localhost:3000/
# If page doesn't load, check:
1. Terminal output for errors
2. Node version: node --version (should be v22+)
3. pnpm version: pnpm --version (should be v11.17.0+)
4. Port 3000 is free: netstat -ano | findstr :3000
```

### Enable Debug Logging (if needed)
```bash
# Set debug environment to see what pnpm is doing
DEBUG=pnpm:* pnpm run dev

# Or for Vite specifically
DEBUG=vite pnpm run dev
```

### Check Installation Status
```bash
# Verify all dependencies are installed
pnpm list    # Shows all installed packages
pnpm list --depth=0  # Show only top-level packages

# Check for broken dependencies
pnpm install --check-files
```

---

## 📦 MONOREPO STRUCTURE & CONFIGURATION

### pnpm Workspace Setup
```yaml
# pnpm-workspace.yaml defines:
packages:
  - artifacts/*    (portfolio, api-server, mockup-sandbox)
  - lib/*          (shared libraries)
  - lib/integrations/*
  - scripts

# Catalog system (synchronized versions)
- All @vitejs, @replit, @tailwindcss, @tanstack deps use catalog versions
- Prevents version mismatches across workspace packages
```

### Vite Configuration (artifacts/portfolio/vite.config.ts)
```typescript
// Environment variables:
- PORT: Custom port (default: 3001)
- BASE_PATH: URL base path (default: '/')
- NODE_ENV: 'production' | 'development'
- REPL_ID: Replit environment detection

// Plugins:
- @vitejs/plugin-react: Fast Refresh
- @tailwindcss/vite: Tailwind compilation (uses native oxide)
- @replit/vite-plugin-runtime-error-modal: Dev error overlay
- @replit/vite-plugin-cartographer: File explorer (Replit only)
- @replit/vite-plugin-dev-banner: Replit dev banner
```

### Build Commands (from artifacts/portfolio/package.json)
```json
"dev":       "vite --config vite.config.ts --host 0.0.0.0"
"build":     "vite build --config vite.config.ts"
"serve":     "vite preview --config vite.config.ts --host 0.0.0.0"
"typecheck": "tsc -p tsconfig.json --noEmit"
```

---

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

---

## 📦 COMPLETE DEPENDENCY & INSTALLATION GUIDE

### System Prerequisites (MUST INSTALL FIRST)

Before installing any npm/pnpm packages, ensure you have these installed on your system:

| Requirement | Version | Status | Command |
|-------------|---------|--------|---------|
| **Node.js** | v24.18.0 (or v22+) | ✅ Required | `node --version` |
| **pnpm** | v11.17.0+ | ✅ Required | `pnpm --version` |
| **Git Bash** | Latest | ✅ Recommended | Check: `C:\Program Files\Git\bin\bash.exe` |
| **TypeScript** | v5.9.3+ | ✅ Included as devDep | Auto-installed via pnpm |
| **Visual Studio Build Tools** | Latest | ⚠️ For native modules | Only if installation fails on native modules |

**Important Notes:**
- ❌ **DO NOT USE npm** - This project uses pnpm-workspace.yaml with `catalog:` URLs that npm doesn't understand
- ❌ **DO NOT USE PowerShell directly** - Use `pnpm.cmd`, Git Bash, or cmd.exe instead
- ⚠️ **Windows x64 only** - Native modules are compiled for Windows x64 MSVC platform

### Root Workspace Dependencies

**Location:** `g:\tp\ai\portofolio-dashbaord\package.json`

**Runtime Dependencies:**
- `@replit/connectors-sdk` (v0.4.2) - Replit connector utilities for workspace integration

**Dev Dependencies:**
- `prettier` (v3.9.6) - Code formatter for entire workspace
- `typescript` (v5.9.3) - TypeScript compiler, shared across all packages

**Native Modules (Windows x64):**
- `@tailwindcss/oxide-win32-x64-msvc` (v4.3.3) - Tailwind CSS Rust-compiled binary for Windows

**Purpose:** Root package.json manages the monorepo workspace and shared dependencies.

### Frontend (Portfolio) Dependencies

**Location:** `g:\tp\ai\portofolio-dashbaord\artifacts\portfolio\package.json`

**UI Framework & React Ecosystem:**
- `react` (catalog: from pnpm-workspace.yaml) - React library
- `react-dom` (catalog:) - React DOM renderer
- `@vitejs/plugin-react` (catalog:) - Vite plugin for React JSX
- `@types/react` (catalog:) - TypeScript types for React
- `@types/react-dom` (catalog:) - TypeScript types for React DOM

**Vite & Build Tools:**
- `vite` (catalog:) - Frontend build tool and dev server
- `@tailwindcss/vite` (catalog:) - Tailwind CSS Vite plugin (integrates @tailwindcss/oxide)
- `tailwindcss` (catalog:) - Tailwind CSS utility framework
- `lightningcss-win32-x64-msvc` (v1.33.0) - Lightning CSS Windows x64 native module
- `@rollup/rollup-win32-x64-msvc` (v4.62.2) - Rollup bundler Windows x64 native module

**UI Components (Radix UI):**
- `@radix-ui/react-*` (v1.x & v2.x) - Unstyled, accessible component primitives:
  - Accordion, Alert Dialog, Aspect Ratio, Avatar, Badge, Breadcrumb
  - Checkbox, Collapsible, Command, Context Menu, Dialog, Drawer
  - Dropdown Menu, Hover Card, Label, Menubar, Navigation Menu
  - Popover, Progress, Radio Group, Scroll Area, Select, Separator
  - Slider, Switch, Tabs, Toast, Toggle, Tooltip
- `@radix-ui/react-slot` (v1.2.0) - Slot composition pattern

**Forms & Validation:**
- `react-hook-form` (v7.55.0) - React form state management
- `@hookform/resolvers` (v3.10.0) - Validation resolvers for react-hook-form (Zod, Yup, etc.)
- `zod` (catalog:) - TypeScript-first schema validation
- `cmdk` (v1.1.1) - Command menu component

**State Management & Data:**
- `@tanstack/react-query` (catalog:) - Server state management, caching, synchronization
- `wouter` (v3.3.5) - Router for React (lightweight alternative to React Router)

**Styling & Animations:**
- `tailwind-merge` (catalog:) - Merge Tailwind CSS classes without conflicts
- `class-variance-authority` (catalog:) - Create component variants with Tailwind
- `clsx` (catalog:) - Conditional className utility
- `framer-motion` (catalog:) - Animation library for React
- `tw-animate-css` (v1.4.0) - Tailwind CSS animation utilities
- `@tailwindcss/typography` (v0.5.15) - Typography plugin for Tailwind

**Data Display & Charts:**
- `recharts` (v2.15.2) - React charts library
- `embla-carousel-react` (v8.6.0) - Carousel component

**Utilities & Components:**
- `react-icons` (v5.4.0) - Icon library (Font Awesome, Feather, etc.)
- `lucide-react` (catalog:) - Icon library (curated SVG icons)
- `sonner` (v2.0.7) - Toast notification library
- `react-day-picker` (v9.11.1) - Calendar day picker component
- `input-otp` (v1.4.2) - One-Time Password input component
- `react-resizable-panels` (v2.1.7) - Resizable panel layout
- `vaul` (v1.1.2) - Drawer/modal component
- `date-fns` (v3.6.0) - Date manipulation library
- `next-themes` (v0.4.6) - Theme management (dark/light mode)

**Backend Integration:**
- `@workspace/api-client-react` (workspace:*) - Local monorepo package for API client React hooks
- `@supabase/supabase-js` (v2.45.0) - Supabase JavaScript client library

**TypeScript & Types:**
- `@types/node` (catalog:) - TypeScript types for Node.js APIs

**Dev-only (Vite plugins):**
- `@replit/vite-plugin-cartographer` (catalog:) - Maps function definitions for debugging
- `@replit/vite-plugin-dev-banner` (catalog:) - Development mode banner
- `@replit/vite-plugin-runtime-error-modal` (catalog:) - Runtime error modal overlay

### Backend (API Server) Dependencies

**Location:** `g:\tp\ai\portofolio-dashbaord\artifacts/api-server/package.json`

The backend uses Express and includes database/API utilities. Full dependencies are managed in api-server/package.json.

### Monorepo Structure (pnpm-workspace.yaml)

This project uses **pnpm monorepo** with:

**Workspaces (9 total):**
- `artifacts/portfolio` - Frontend React application (Vite)
- `artifacts/api-server` - Backend Express API server
- `artifacts/mockup-sandbox` - Development sandbox/testing
- `lib/*` - Shared libraries and utilities
- `scripts/*` - Automation scripts

**Catalog System (Version Management):**
The `pnpm-workspace.yaml` uses a `catalog:` system to sync versions across workspaces:

```yaml
catalog:
  vite: "^7.3.6"
  react: "^18.3.1"
  "@types/react": "^18.3.0"
  tailwindcss: "^4.3.3"
  # ... (many more dependencies)
```

**Why this matters:**
- Using `"vite": "catalog:"` instead of `"vite": "^7.3.6"` in package.json
- Ensures all workspaces use the same version
- Prevents version conflicts across monorepo
- npm doesn't understand `catalog:` syntax (only pnpm does)

### Critical Native Modules (Windows x64)

These packages require platform-specific binaries compiled for Windows x64 MSVC:

| Package | Version | Purpose | Binary Path |
|---------|---------|---------|------------|
| **@tailwindcss/oxide** | 4.3.3 | Tailwind CSS Rust engine | `node_modules/@tailwindcss/oxide-win32-x64-msvc/` |
| **@rollup/rollup-win32-x64-msvc** | 4.62.2 | Rollup bundler binary | `node_modules/@rollup/rollup-win32-x64-msvc/` |
| **esbuild** | v0.27.3+ | JS/TS bundler binary | `node_modules/@esbuild/win32-x64/` |
| **lightningcss-win32-x64-msvc** | 1.33.0 | CSS engine binary | `node_modules/lightningcss-win32-x64-msvc/` |

**Installation Tips:**
- These are optional dependencies automatically installed for your platform
- If missing, run: `pnpm install --shamefully-hoist --force`
- They must be compiled AFTER installation (not downloaded pre-compiled)

### Installation Steps (Complete Guide)

**Step 1: Verify Prerequisites**
```bash
node --version       # Must show v22+ (e.g., v24.18.0)
pnpm --version      # Must show v11.17.0 or higher
```

**Step 2: Navigate to Root**
```bash
cd g:\tp\ai\portofolio-dashbaord
```

**Step 3: Install All Dependencies**
```bash
# Standard installation (recommended):
pnpm install --shamefully-hoist

# OR if you encounter 'sh is not recognized' error:
pnpm install --ignore-scripts --shamefully-hoist --no-frozen-lockfile --prefer-offline

# The --shamefully-hoist flag is CRITICAL:
# - Flattens nested pnpm store into root node_modules
# - Allows build tools to find each other's dependencies
# - Required for Vite, Tailwind, esbuild, Rollup to work
```

**Step 4: Verify Installation**
```bash
# Check root workspace packages
pnpm list --depth=0

# Should show:
# @workspace/portfolio@0.0.0
# @workspace/api-server@0.0.0
# ... (other workspaces)

# Check frontend dependencies
cd artifacts/portfolio
pnpm list --depth=0
```

**Step 5: Build Frontend (Optional)**
```bash
cd g:\tp\ai\portofolio-dashbaord\artifacts\portfolio
pnpm run build      # Compiles to dist/ folder
```

**Step 6: Build Backend (Optional)**
```bash
cd g:\tp\ai\portofolio-dashbaord\artifacts/api-server
pnpm run build      # Compiles to dist/ folder (uses esbuild)
```

### Installation Flags Explained

| Flag | Purpose | When to Use |
|------|---------|-----------|
| `--shamefully-hoist` | Flatten node_modules tree | **ALWAYS** - Required for build tools |
| `--ignore-scripts` | Skip preinstall/postinstall scripts | When preinstall fails (sh not found) |
| `--force` | Re-download and reinstall everything | When native modules are broken |
| `--prefer-offline` | Use cache first, network only if needed | On slow internet or if EPERM errors occur |
| `--no-frozen-lockfile` | Update lockfile if needed | When lockfile conflicts occur |

### Troubleshooting Installation

**Error: "Cannot find native binding"**
```bash
# Solution: Force rebuild native modules
pnpm install --shamefully-hoist --force
```

**Error: "sh is not recognized"**
```bash
# Solution: Skip preinstall script, then rebuild
pnpm install --ignore-scripts --shamefully-hoist --no-frozen-lockfile
```

**Error: "EPERM: operation not permitted" (esbuild/Windows)**
```bash
# Solution: Use offline mode or clean rebuild
pnpm install --prefer-offline --shamefully-hoist
# OR
pnpm store prune
pnpm install --shamefully-hoist --force
```

**Error: Unsupported URL Type "catalog:"**
```bash
# Solution: Use pnpm, NOT npm
# ❌ Wrong:  npm install
# ✅ Correct: pnpm install
```

### Dependency Update Strategy

The monorepo uses pnpm catalog for centralized version management:

**To update a shared dependency:**
1. Edit `pnpm-workspace.yaml` in the `catalog:` section
2. Run: `pnpm install`
3. All workspaces automatically use the new version

**To update workspace-specific dependency:**
1. Go to that workspace: `cd artifacts/portfolio`
2. Run: `pnpm add package@version`
3. It automatically uses `catalog:` format if available

---

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

### Production Build Steps
```bash
cd g:\tp\ai\portofolio-dashbaord\artifacts\portfolio

# Build the app (creates dist/ folder)
pnpm run build

# Verify build succeeded (check for errors)
# Output should show: "✓ built in XXXms"

# Preview production build locally (optional)
pnpm run serve
# Will run on http://localhost:4173/
```

### Build Output
- **Location**: `artifacts/portfolio/dist/` folder
- **Contents**: 
  - `index.html` - Main entry point
  - `assets/` - JavaScript bundles (minified & optimized)
  - `*.js`, `*.css` - Compiled assets
  - Ready to deploy to any static hosting (Netlify, Vercel, GitHub Pages, etc.)

### Build Performance Tips
- Build takes 30-60 seconds on first run (compiles TypeScript, bundles React, etc.)
- Subsequent builds are faster (cached)
- Build will fail if TypeScript errors exist - fix them with `pnpm run typecheck`

### Environment Variables for Production
Create `.env.production` or set before building:
```bash
# Set production API server URL
VITE_API_URL=https://api.example.com  # Production API endpoint

# Build with custom env
VITE_API_URL=https://api.example.com pnpm run build
```

### Deployment (Examples)

**Netlify/Vercel:**
1. Connect GitHub repository
2. Set build command: `pnpm run build`
3. Set publish directory: `dist`
4. Deploy automatically on push to `main` branch

**Manual Static Hosting:**
```bash
# Build locally
pnpm run build

# Upload `dist/` folder contents to your web server
# All files serve as static assets
```

**Docker Deployment:**
```dockerfile
# Create Dockerfile in root
FROM node:24-alpine
WORKDIR /app
COPY . .
RUN pnpm install --shamefully-hoist
RUN pnpm run build
EXPOSE 3000
CMD ["pnpm", "run", "serve"]
```

---

## Dependencies

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **shadcn/ui** - Pre-built components
- **Supabase** - Backend/Database
- **Sonner** - Toast notifications (see `components/ui/sonner.tsx`)

## Troubleshooting

### "Refresh Prices" Returns 0 Results / Yahoo Finance Returns Fail (FIXED 2026-08-16)

**Error:** `Call const yahooFinance = new YahooFinance() first. Upgrading from v2?`

**Cause:** Import path was wrong in scraper:
- Was importing old file: `artifacts/api-server/judge/enrichReturnsFromYahoo.ts` (v2 API, incompatible)
- Should import new file: `artifacts/api-server/src/judge/enrichReturnsFromYahoo.ts` (v4 HTTP-based, works)

**Fix Applied:**
1. ✅ Changed import in `artifacts/api-server/src/scraper/runScraper.ts` line 19:
   - From: `import { enrichReturnsFromYahoo } from "../../judge/enrichReturnsFromYahoo";`
   - To: `import { enrichReturnsFromYahoo } from "../judge/enrichReturnsFromYahoo";`

2. ✅ Deleted the old incompatible file: `artifacts/api-server/judge/enrichReturnsFromYahoo.ts`

**Why it works now:**
- New implementation uses direct HTTP fetch to Yahoo's quoteSummary endpoint
- No library version conflicts
- Compatible with yahoo-finance2 v4+

**To test:** Run `npx tsx src/scraper/runScraper.ts` in the api-server folder

**Note:** Stocks still won't show in the UI until they're marked `is_held = true` in the database

---

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
