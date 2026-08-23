# Ownership Audit — Multi-Tenant Readiness Assessment

**Current State:** Single-user only. No `owner_id` columns on any per-user data tables. No ownership filters applied to any queries.

## Per-User Data Tables

All of the following tables store data tied to a specific user's portfolio and must eventually support `owner_id`:

### 1. `comparison_watchlist`
- **Purpose:** Investment universe (funds, stocks, indices) and holdings (is_held=true)
- **Sensitive Columns:** `is_held`, `funds_table_key` (identifies user's actual holdings)
- **Queries Without Ownership Filter:**
  - `routes/aiBot.ts`: `SELECT id FROM comparison_watchlist WHERE ticker = $1` (multiple places)
  - `routes/advisor.ts`: Joins on watchlist for recommendation lookups
  - `routes/verdicts.ts`: `judgeAllHoldings()` queries all held positions
  - `routes/scraper.ts`: `GET /api/scraper/snapshots` returns all watchlist entities
  - `judge/comparisonJudge.ts`: `judgeAllHoldings()` core loop reads all holdings
  - `judge/timeStop.ts`: `checkTimeStop()` queries verdict_history for one watchlist_id
  - `judge/thesisCheck.ts`: `checkThesis()` queries verdict_history for one watchlist_id

### 2. `comparison_snapshots`
- **Purpose:** Price, returns, and metrics scraped per watchlist entity per run
- **Sensitive Columns:** `nav_or_price`, `return_*_percent` (reveals performance data)
- **Run-Linked:** `run_id` foreign key to `bot_runs`
- **Queries Without Ownership Filter:**
  - `routes/scraper.ts`: `GET /api/scraper/snapshots` returns snapshots with optional run_id filter but no owner filter
  - `judge/comparisonJudge.ts`: `SELECT FROM comparison_snapshots WHERE watchlist_id = ...` (queries by watchlist_id only)
  - `migrations/009_bot_runs.sql`: Bulk update via `UPDATE comparison_snapshots SET run_id = ... WHERE run_id IS NULL`
  - `migrations/010_engine_run_links.sql`: Legacy data backfill without owner context

### 3. `advisor_recommendations`
- **Purpose:** AI-generated recommendations from Gemini per holding per run
- **Sensitive Columns:** `recommendation_text`, `decision`, `confidence`, `evidence` (JSONB), `risks` (JSONB) (reveals AI strategy)
- **Run-Linked:** `run_id` foreign key to `bot_runs`
- **Queries Without Ownership Filter:**
  - `routes/advisor.ts`: `GET /api/advisor/recommendations/:ticker` joins watchlist but does not verify owner
  - `routes/advisor.ts`: `GET /api/advisor/recommendations` returns all recommendations without owner filter
  - `routes/advisor.ts`: `POST /api/advisor/generate` queries all verdicts and all recommendations
  - `routes/advisor.ts`: `GET /api/advisor/alerts-context/:ticker` joins watchlist without owner verification
  - `routes/aiBot.ts`: INSERT queries assume all tickers are this user's holdings
  - `migrations/010_engine_run_links.sql`: ON CONFLICT resolution does not check owner

### 4. `bot_runs`
- **Purpose:** Execution context and status for each AI Bot pipeline run
- **Sensitive Columns:** `status`, `started_at`, `completed_at`, `error_message` (reveals when user ran bot, what errors occurred)
- **Queries Without Ownership Filter:**
  - `routes/aiBot.ts`: `INSERT INTO bot_runs (status) VALUES ('running')` creates run for current user (assumes single user)
  - `routes/aiBot.ts`: `UPDATE bot_runs SET status = ...` updates runs without owner check
  - `routes/aiBot.ts`: `SELECT * FROM bot_runs ORDER BY id DESC LIMIT 1` fetches latest run globally
  - `routes/advisor.ts`: `SELECT id FROM bot_runs WHERE id = $1 AND status IN (...)` checks run status without owner verification

### 5. `verdict_history`
- **Purpose:** Time-series log of signal changes per holding (used by Time Stop and Thesis Check alerts)
- **Sensitive Columns:** `signal`, `flags`, `return_percent`, `raw_verdict` (JSONB) (reveals AI decision history)
- **Run-Linked:** `run_id` foreign key to `bot_runs`
- **Queries Without Ownership Filter:**
  - `judge/timeStop.ts`: `SELECT * FROM verdict_history WHERE watchlist_id = $1` (queries by watchlist_id only)
  - `judge/thesisCheck.ts`: `SELECT * FROM verdict_history WHERE watchlist_id = $1` (queries by watchlist_id only)
  - `judge/signalTrend.ts`: `SELECT * FROM verdict_history WHERE watchlist_id = $1` (queries by watchlist_id only)
  - `routes/aiBot.ts`: Indirectly via `judgeAllHoldings()` which logs verdicts to this table
  - `migrations/010_engine_run_links.sql`: Bulk update via `UPDATE verdict_history SET run_id = ... WHERE run_id IS NULL`

### 6. `portfolio_value_history`
- **Purpose:** Portfolio total value snapshots over time (used by Drawdown alert)
- **Sensitive Columns:** `total_cost_basis`, `total_market_value` (reveals user's total wealth)
- **Run-Linked:** `run_id` foreign key to `bot_runs`
- **Queries Without Ownership Filter:**
  - `judge/drawdown.ts`: `SELECT * FROM portfolio_value_history WHERE run_id = $1 ORDER BY recorded_at DESC` (queries by run_id only, but runs are not owned)
  - `routes/aiBot.ts`: Calls `capturePortfolioValue(runId)` which inserts to this table without owner context
  - `migrations/010_engine_run_links.sql`: Bulk update via `UPDATE portfolio_value_history SET run_id = ... WHERE run_id IS NULL`

### 7. `stock_fundamentals`
- **Purpose:** Fundamentals data (PE ratio, dividend yield, etc.) from stockanalysis.com per stock per run
- **Sensitive Columns:** All columns (market cap, revenue, net income, earnings, debt, etc. reveal financial health analysis)
- **Run-Linked:** `run_id` foreign key to `bot_runs`
- **Queries Without Ownership Filter:**
  - `routes/scraper.ts`: Joins fundamentals in snapshot query without owner filter
  - `judge/comparisonJudge.ts`: `getLatestFundamentals()` queries for sector comparisons without owner context
  - `migrations/010_engine_run_links.sql`: Bulk update via `UPDATE stock_fundamentals SET run_id = ... WHERE run_id IS NULL`

### 8. `technical_signals`
- **Purpose:** Candlestick trends and technical patterns per holding per run (used by Chart Reader stage)
- **Sensitive Columns:** `trend`, `patterns` (JSONB), `confidence`, `candles` (JSONB) (reveals technical analysis inputs)
- **Run-Linked:** `run_id` foreign key to `bot_runs`; `watchlist_id` foreign key to comparison_watchlist
- **Queries Without Ownership Filter:**
  - `routes/technical.ts`: `GET /api/technical-signals` queries without owner filter
  - `routes/aiBot.ts`: Called by `runTechnicalAnalysis(runId)` which stores signals without owner context
  - `judge/comparisonJudge.ts`: May read technical signals for comparison context

---

## Query Chains Requiring Owner Verification

### Chain 1: AI Bot Pipeline (routes/aiBot.ts)
```
POST /api/ai-bot/run
  → INSERT bot_runs (no owner_id)
  → runScraper() 
    → INSERT comparison_snapshots (no owner_id, run_id only)
  → runTechnicalAnalysis()
    → INSERT technical_signals (no owner_id, run_id only)
  → judgeAllHoldings()
    → SELECT all held positions from comparison_watchlist (no owner filter)
    → INSERT verdict_history (no owner_id)
  → Smart Advisor
    → generateRecommendation()
    → INSERT advisor_recommendations (no owner_id)
```
**Blast Radius:** All 6 tables created/updated in one unowned transaction

### Chain 2: Advisor Recommendation Routes (routes/advisor.ts)
```
GET /api/advisor/recommendations/:ticker
  → SELECT from advisor_recommendations (no owner filter)

GET /api/advisor/recommendations
  → SELECT from advisor_recommendations (no owner filter, only run_id)

POST /api/advisor/generate
  → SELECT from bot_runs (no owner verification)
  → judgeAllHoldings() (queries all held positions)
  → INSERT advisor_recommendations (no owner_id)
```
**Blast Radius:** Can read/write recommendations for any ticker in the system

### Chain 3: Alert Checks (routes/alerts.ts)
```
GET /api/alerts/time-stops
  → checkAllTimeStops(runId)
    → SELECT all verdicts from verdict_history (no owner filter)

GET /api/alerts/thesis-checks
  → checkAllTheses(runId)
    → SELECT all verdicts from verdict_history (no owner filter)

GET /api/alerts/drawdown
  → computeDrawdown(runId)
    → SELECT from portfolio_value_history (no owner filter)
```
**Blast Radius:** Returns all portfolio alerts regardless of ownership

---

## Recommendations for Future Implementation

When adding `owner_id` support:

1. **Add `owner_id` columns** to all 8 tables (NOT NULL, with FK to future users table)
2. **Index ownership queries**: `CREATE INDEX ON table_name(owner_id, ...)` for fast filtering
3. **Update all queries** to include `WHERE owner_id = $n` in SELECT/UPDATE/DELETE
4. **Protect the AI Bot pipeline** (routes/aiBot.ts):
   - Extract current user from request context or environment
   - Pass `ownerId` through all stages
   - Include `owner_id = $n` in every INSERT/UPDATE
5. **Protect advisor routes** (routes/advisor.ts):
   - Verify ownership of bot_run before returning its recommendations
   - Verify user owns the watchlist before returning its verdict history
6. **Protect alert routes** (routes/alerts.ts):
   - Verify ownership of bot_run before computing alerts
7. **Update migrations**:
   - Add `owner_id` in `ALTER TABLE` statements
   - Assign `owner_id` in backfill `UPDATE` queries
8. **Use database transactions** to ensure owner_id consistency across related tables in pipeline stages

---

## Current Vulnerability

**Any authenticated user can:**
- View all bot runs, recommendations, verdicts, and alerts created by ANY user
- Trigger new bot runs (creating new records for ANY held position)
- Query portfolio value history (seeing others' total wealth)
- Access technical signals and fundamentals for all entities

**Multi-tenant separation is 0% complete.** This is acceptable for single-user deployment; it is a critical security issue for any shared environment.
