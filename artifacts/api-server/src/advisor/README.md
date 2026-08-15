# Smart Advisor Engine

The Smart Advisor is an AI-powered recommendation engine that sits after Comparison Judge in your portfolio pipeline. It takes structured verdicts from Comparison Judge and uses Gemini to generate clear, actionable investment recommendations.

## Architecture Flow

```
Scraper → Comparison Snapshots → Comparison Judge → Smart Advisor (NEW)
                                      ↓
                                  HoldingVerdict
                                      ↓
                                 buildDataBlock()
                                      ↓
                                  Gemini API
                                      ↓
                                   Recommendation
                                      ↓
                                  Database
```

## Components

### 1. **buildPrompt.ts** — Prompt Builder
- Converts `HoldingVerdict` (from Comparison Judge) into a structured Gemini prompt
- Sends only key numbers/signals, not raw data tables (keeps costs low)
- Separates system rules from data using Gemini's `systemInstruction` field
- Enforces strict constraints: no guesswork, no hype, educational format

### 2. **generateRecommendation.ts** — Gemini Caller
- Sends structured data block + system rules to Gemini 2.0 Flash
- Handles API errors with diagnostic info (safety filters, token limits, etc.)
- Returns clean `AdvisorRecommendation` object with text + metadata

### 3. **runAdvisor.ts** — Orchestrator
- Iterates over all held positions
- Gets verdict from Comparison Judge for each
- Generates recommendation via Gemini
- Saves to database
- Exported function (not auto-invoked on import) — safe for server routes

### 4. **advisor.ts** — API Routes (NEW)
- `GET /api/advisor/recommendations/:ticker` — Latest recommendation for a holding
- `GET /api/advisor/recommendations` — All latest recommendations for held positions
- `POST /api/advisor/generate` — Manually trigger recommendation generation for all holdings

### 5. **003_create_advisor_recommendations.sql** — Database Schema
- Stores generated recommendations
- Indexes on `watchlist_id` and `generated_at` for fast lookup

## Setup

### Step 1: Run Database Migration

Execute this in your Replit database:
```sql
-- From: src/lib/migrations/003_create_advisor_recommendations.sql
CREATE TABLE IF NOT EXISTS "advisor_recommendations" (
	"id" serial PRIMARY KEY,
	"watchlist_id" integer NOT NULL REFERENCES "comparison_watchlist"("id"),
	"recommendation_text" text NOT NULL,
	"model_used" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_advisor_watchlist_id" ON "advisor_recommendations" ("watchlist_id");
CREATE INDEX IF NOT EXISTS "idx_advisor_generated_at" ON "advisor_recommendations" ("generated_at");
```

### Step 2: Set Environment Variable

Make sure `GEMINI_API_KEY` is set in your `.env` file (same key your app already uses, if applicable).

### Step 3: Build & Deploy

```bash
node build.mjs
```

Then restart your API server.

## Usage

### CLI — Generate All Recommendations

```bash
npx tsx advisor/runAdvisor.ts
```

This:
1. Fetches all verdicts from Comparison Judge
2. Sends each to Gemini
3. Saves recommendations to database
4. Logs success/failure for each

Run this after:
- You've scraped fresh market data (`runScraper.ts`)
- You have at least one verdict from Comparison Judge

### API — Fetch Recommendations

**Get recommendation for a specific ticker:**
```bash
curl http://localhost:3000/api/advisor/recommendations/CAEIF
```

Response:
```json
{
  "id": 42,
  "recommendation_text": "CAEIF has outperformed its sector by 2.3pp over 1Y, with computed risk tier Medium. The outperformance is consistent across peer comparisons. Recommendation: Hold. The fund's stable tracking relative to its benchmark suggests no rotation is needed at this time.",
  "model_used": "gemini-2.0-flash",
  "generated_at": "2026-08-15T20:15:30.123Z"
}
```

**Get all latest recommendations:**
```bash
curl http://localhost:3000/api/advisor/recommendations
```

Returns array of all held positions + their latest recommendations.

### API — Trigger Generation

```bash
curl -X POST http://localhost:3000/api/advisor/generate \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "results": [
    {
      "ticker": "CAEIF",
      "status": "success",
      "recommendation": "CAEIF has outperformed its sector..."
    },
    {
      "ticker": "NBKE",
      "status": "success",
      "recommendation": "NBKE's performance lags EGX30..."
    },
    {
      "ticker": "REIT",
      "status": "skipped",
      "reason": "No return data available"
    }
  ]
}
```

## Key Design Rules

All enforced via `SYSTEM_INSTRUCTIONS` in buildPrompt.ts:

1. **Zero Guesswork** — Only numbers explicitly in the data
2. **No Hype** — Always mention downside/risk alongside upside
3. **Educational Format** — Explain concept → show numbers → recommend action → show math
4. **Plain Tone** — No emojis, no exclamation marks, 3-5 sentences typical
5. **No Inflation Talk** — Dashboard uses nominal returns only
6. **Rotation Splits** (when appropriate) — Only clean fractions (75/25, 60/40, etc.) + actual EGP amounts
7. **Risk Parity** — Never suggest higher-risk asset without explicit mention of increased risk

## Gemini Configuration

- **Model:** `gemini-2.0-flash` (adjust in `generateRecommendation.ts` if needed)
- **Temperature:** 0.4 (low — factual task, not creative)
- **Max Tokens:** 650 (room for rotation split breakdowns)
- **SystemInstruction:** Separated from data for better rule adherence

## Troubleshooting

### No GEMINI_API_KEY error
- Check `.env` file has `GEMINI_API_KEY` set
- Make sure it matches whatever variable name your existing Gemini integration uses

### "Gemini blocked the prompt"
- Holding name/ticker tripped a safety filter
- Check `promptFeedback.blockReason` in response
- This is rare but can happen with certain company names

### No recommendations returned
- Run scraper first (`runScraper.ts`) to populate market data
- Run Comparison Judge to generate verdicts
- Then run Smart Advisor to generate recommendations

### Database migration fails
- Make sure `comparison_watchlist` table exists first (from Comparison Judge setup)
- Check that Postgres user has CREATE TABLE permission

## Next Steps

1. **Frontend Integration** — Add a recommendations section to your portfolio UI
2. **Scheduled Generation** — Add a cron job to regenerate recommendations daily/weekly
3. **Refinement** — Adjust system rules in `SYSTEM_INSTRUCTIONS` based on recommendation quality
4. **Alerts** — Add email/notification when a recommendation changes (e.g., hold → sell)
