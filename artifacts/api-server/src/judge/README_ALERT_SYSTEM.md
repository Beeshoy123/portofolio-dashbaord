# V2 Alert System — Regulatory Engine for Smart Advisor

The Alert System is a multi-layered validator that monitors your portfolio for stagnant signals, reversed theses, and drawdowns. It works as a **regulator** for Smart Advisor recommendations, adding critical context that changes confidence levels and caveats.

## Architecture Flow

```
Comparison Judge → verdict_history (logged)
        ↓
    ┌───┴────────────────────────┐
    ↓                            ↓
Time Stop              Thesis Check        Drawdown
(stagnation)           (reversal)         (volatility)
    ↓                            ↓                ↓
  ┌─────────────────────────────────────────────┐
  │      Alert System (Regulatory Layer)        │
  │  (flags, context, confidence modifiers)     │
  └─────────────────────────────────────────────┘
    ↓
Smart Advisor (uses alerts to calibrate recommendations)
    ↓
Recommendation with caveats
```

## Components

### 1. **Verdict History** (Table + Logging)
- Migration: `004_verdict_history.sql`
- Logs every Comparison Judge verdict over time
- Used by Time Stop and Thesis Check to compare "now vs. before"
- Auto-populated when `comparisonJudge.judgeHolding()` runs
- Stores: watchlist_id, signal, flags, return_percent, raw_verdict JSON

### 2. **Time Stop** (Stagnation Alert)
- File: `judge/timeStop.ts`
- Flags verdicts that haven't changed for `STALE_DAYS` (21 days default)
- Alerts on: Signal + flags combo staying exactly the same
- Returns: `is_stagnant`, `current_signal`, `stagnant_days`, `stagnant_since`
- **Smart Advisor Impact:** Reduces confidence if signal is stagnant; suggests the market may have already priced in this view

### 3. **Thesis Check** (Reversal Alert)
- File: `judge/thesisCheck.ts`
- Compares latest verdict to closest snapshot ≥30 days old
- Flags when: new flags appeared OR signal weakened (Strong→Mixed/Weak)
- Returns: `has_reversal`, `newly_appeared_flags`, `signal_degraded`, `compared_at`
- **Smart Advisor Impact:** Adds urgency if thesis reversed; highlights specific reasons why (newly appeared flags)

### 4. **Drawdown** (Volatility Alert)
- Migration: `005_portfolio_value_history.sql`
- File: `judge/drawdown.ts`
- Tracks max portfolio value over time
- Computes: current drawdown % below peak, max historical drawdown
- Returns: `current_drawdown_percent`, `max_drawdown_percent`, `peak_at`
- **Smart Advisor Impact:** Contextualizes individual recommendation within broader portfolio stress; suggests caution if portfolio is deep in drawdown

### 5. **Alert Routes** (API)
- File: `routes/alerts.ts`
- Exposes all alert checks via REST endpoints

## API Endpoints

### Get Single Alert Check

```bash
# Time Stops (stagnation)
GET /api/alerts/time-stops
→ [{ ticker, is_stagnant, stagnant_days, current_signal, ... }, ...]

# Thesis Checks (reversals)
GET /api/alerts/thesis-checks
→ [{ ticker, has_reversal, newly_appeared_flags, signal_degraded, ... }, ...]

# Portfolio Drawdown
GET /api/alerts/drawdown
→ { current_drawdown_percent, max_drawdown_percent, peak_at, ... }
```

### Get All Alerts for a Ticker

```bash
GET /api/alerts/all/:ticker
→ {
  ticker: "CAEIF",
  timeStop: { is_stagnant, stagnant_days, ... },
  thesis: { has_reversal, newly_appeared_flags, ... },
  portfolio: { drawdown: { current_drawdown_percent, ... } }
}
```

### Get Alert Summary (for Dashboard)

```bash
GET /api/alerts/summary
→ {
  generatedAt: "2026-08-15T20:15:00Z",
  alerts: {
    CAEIF: { timeStop: {...}, thesis: {...} },
    NBKE: { timeStop: {...}, thesis: {...} },
    ...
  },
  portfolio: { drawdown: {...} }
}
```

## Smart Advisor Integration

### 1. **Recommendation with Alert Context**

```bash
GET /api/advisor/alerts-context/:ticker
→ {
  recommendation: {
    recommendation_text: "CAEIF has outperformed...",
    model_used: "gemini-2.0-flash",
    generated_at: "2026-08-15T20:00:00Z"
  },
  alerts: {
    timeStop: { is_stagnant: true, stagnant_days: 42, ... },
    thesis: { has_reversal: false, ... },
    drawdown: { current_drawdown_percent: 5.2, ... }
  }
}
```

### 2. **Alert Context in Recommendation Generation**

When generating recommendations, Smart Advisor optionally receives alert context via `buildDataBlock()`:

```typescript
const verdict = await judgeOneHolding(ticker, "return_1y");
const alerts = {
  timeStop: await checkTimeStop(watchlistId),
  thesis: await checkThesis(watchlistId),
  drawdown: await computeDrawdown()
};

const recommendation = await generateRecommendation(verdict, alerts);
```

The alert context is added to the Gemini prompt as:
```
ALERT SYSTEM CONTEXT:
⚠ STAGNANT SIGNAL: This verdict has not changed for 42 days. Consider mentioning this in your confidence level.
⚠ THESIS REVERSAL: The holding's signal or flags have changed since 30 days ago (newly appeared: losing_to_sector_peer). Mention this context shift.
⚠ PORTFOLIO DRAWDOWN: The total portfolio is currently 5.2% below its peak. Acknowledge broader portfolio context.
```

## Setup Steps

### Step 1: Run Migrations

Execute these in your Replit Postgres database (in order):

```sql
-- From: src/lib/migrations/004_verdict_history.sql
CREATE TABLE IF NOT EXISTS verdict_history (
  id SERIAL PRIMARY KEY,
  watchlist_id INTEGER NOT NULL REFERENCES comparison_watchlist(id),
  signal TEXT NOT NULL,
  flags TEXT[] NOT NULL DEFAULT '{}',
  return_percent NUMERIC(8,4),
  raw_verdict JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verdict_history_watchlist_time
  ON verdict_history (watchlist_id, recorded_at);

-- From: src/lib/migrations/005_portfolio_value_history.sql
CREATE TABLE IF NOT EXISTS portfolio_value_history (
  id SERIAL PRIMARY KEY,
  total_cost_basis NUMERIC(14,2) NOT NULL,
  total_market_value NUMERIC(14,2) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_value_history_time
  ON portfolio_value_history (recorded_at);
```

### Step 2: Auto-Logging on Judge Runs

The `comparisonJudge.judgeHolding()` function already logs verdicts to `verdict_history` automatically. No additional wiring needed.

### Step 3: Populate Portfolio History

When you fetch portfolio data, insert into `portfolio_value_history`:

```typescript
// In your portfolio calculation code (e.g., /api/portfolio)
const totalMarketValue = portfolio.gold.currentValue + portfolio.funds.reduce(...);
const totalCostBasis = portfolio.gold.costBasis + portfolio.funds.reduce(...);

await pool.query(
  `INSERT INTO portfolio_value_history (total_cost_basis, total_market_value)
   VALUES ($1, $2)`,
  [totalCostBasis, totalMarketValue]
);
```

### Step 4: Build & Deploy

```bash
node build.mjs
```

Restart your API server. The alert endpoints are now available.

## Usage Examples

### Dashboard Widget

Show alerts alongside holdings:

```
CAEIF
├─ Current Return: 12.3%
├─ Signal: Mixed
├─ ⚠ Time Stop: Stagnant for 42 days
├─ ✓ Thesis: No reversal
└─ Recommendation: Hold (with caveat about stagnation)

NBKE
├─ Current Return: 8.1%
├─ Signal: Strong
├─ ✓ Time Stop: Changing regularly
├─ ⚠ Thesis: Reversal detected (lost sector leadership)
└─ Recommendation: Watch (thesis shift warrants review)
```

### Alert Summaries

Email or notify user when:
- A holding's signal becomes stagnant (> 21 days unchanged)
- A thesis reverses (new warning flag or signal downgrade)
- Portfolio drawdown exceeds 10% from peak

### Recommendation Confidence

Smart Advisor adjusts confidence language based on alerts:

```
WITHOUT ALERTS:
"CAEIF has outperformed its sector by 2.3pp. Recommendation: Hold."

WITH STAGNANT ALERT:
"CAEIF has outperformed its sector by 2.3pp, but this verdict has not changed for 42 days, suggesting the market may have already priced in this view. Recommendation: Hold, but watch for the next quarterly refresh."

WITH THESIS REVERSAL:
"CAEIF has outperformed its sector, but recently lost its sector leadership advantage (new flag as of 30 days ago). The signal shift suggests a potential rotation window. Recommendation: Watch closely; consider researching sector peers."
```

## Tuning

### Stagnation Threshold

```typescript
// In judge/timeStop.ts
const STALE_DAYS = 21; // Adjust based on your update cadence
```

### Reversal Lookback

```typescript
// In judge/thesisCheck.ts
const LOOKBACK_DAYS = 30; // How far back to compare verdicts
```

### Signal Strength Ranking

```typescript
// In judge/thesisCheck.ts
const SIGNAL_RANK = { Weak: 0, Mixed: 1, Strong: 2 };
// Adjust if you use different signal labels
```

## Data Completeness & Caveats

- **Verdict History** needs at least 2 rows to compute Time Stop (stagnation requires history)
- **Thesis Check** needs ≥30-day-old snapshot; returns `has_enough_history: false` if not available yet
- **Drawdown** needs ≥2 portfolio_value_history rows; will be ~0% until you have history
- All alert checks handle empty history gracefully (return false/empty, not errors)

## Troubleshooting

### No verdicts appearing in verdict_history

- Make sure Comparison Judge is running (via `/api/rotation-verdicts`)
- Check that `comparisonJudge.ts` lines logging to `verdict_history` executed without error
- Verify watchlist entries exist with `is_held = true`

### Time Stop always returns `is_stagnant: false`

- Verdict history is too short (need at least 2 verdicts, days apart)
- Run Comparison Judge on at least 2 separate dates, 21+ days apart
- Check `STALE_DAYS` constant — might be too high for your test

### Thesis Check shows `has_enough_history: false`

- Verdict history is < 30 days old (normal for new portfolios)
- Run Comparison Judge for 30+ calendar days, then check again
- No error; just means insufficient lookback data yet

### Drawdown always null

- `portfolio_value_history` is empty — make sure you're inserting into it
- Check that your portfolio calculation code calls the INSERT query
- Verify the table exists: `SELECT * FROM portfolio_value_history;`

## Future Enhancements

- **Email Alerts** — Notify user when thresholds crossed (stagnation > 60 days, drawdown > 15%)
- **Hit Rate Tracking** — Store `raw_verdict` JSON and analyze how often reversals predicted downturns
- **Pattern Detection** — Flag holdings with cyclical stagnation/reversal patterns
- **Sector-Wide Alerts** — "Your whole sector is stagnant" warnings
