// Smart Advisor — Run All
//
// For every holding, gets Comparison Judge's verdict, sends it to Gemini,
// and saves the generated recommendation. Run this AFTER
// scraper/runScraper.ts and once comparison_snapshots has real data —
// otherwise verdicts will be mostly "no data" and Gemini will have little
// to work with.
//
// BUG FIX (same category as the runScraper.ts pool.end()/auto-invoke bug
// confirmed in real Replit testing): this file previously called
// `pool.end()` internally and auto-invoked `main()` as a top-level side
// effect — fine for a one-shot CLI script, but breaks the moment this
// file is imported into a long-running server (e.g. a "Generate Advice"
// button route): the pool gets permanently closed after the first run,
// so a second call throws "Cannot use a pool after calling end on the
// pool", and merely importing the file fires an unrequested Gemini API
// call on server startup — worse here than in runScraper.ts, since each
// unrequested call has a real API cost, not just wasted scrape time.
// `main` is now exported and does NOT close the pool; the caller (your
// server, or the standalone CLI usage below) owns the pool's lifecycle.
//
// Standalone CLI usage: `npx tsx advisor/runAdvisor.ts` still works via
// the guarded block at the bottom, which only runs when this file is
// executed directly — not when imported.

import { Pool } from "pg";
import { judgeAllHoldings } from "../judge/comparisonJudge";
import { generateRecommendation } from "./generateRecommendation";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getWatchlistIdForTicker(ticker: string): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM comparison_watchlist WHERE ticker = $1`,
    [ticker]
  );
  if (result.rows.length === 0) {
    throw new Error(`[runAdvisor] No watchlist entry found for ticker ${ticker}`);
  }
  return result.rows[0].id;
}

async function saveRecommendation(
  watchlistId: number,
  text: string,
  model: string
): Promise<void> {
  await pool.query(
    `INSERT INTO advisor_recommendations (watchlist_id, recommendation_text, model_used)
     VALUES ($1, $2, $3)`,
    [watchlistId, text, model]
  );
}

export async function main() {
  const verdicts = await judgeAllHoldings("return_1y");

  if (verdicts.length === 0) {
    console.log("No holdings found (is_held=true) in comparison_watchlist. Nothing to advise on.");
    return;
  }

  console.log(`Generating recommendations for ${verdicts.length} holding(s)...\n`);

  for (const verdict of verdicts) {
    console.log(`--- ${verdict.holding_name} (${verdict.holding_ticker}) ---`);

    if (verdict.holding_return_percent === null) {
      console.warn(
        `  Skipping — no return data for this holding yet. Run scraper/runScraper.ts first.`
      );
      continue;
    }

    try {
      const recommendation = await generateRecommendation(verdict);
      console.log(recommendation.recommendation_text);
      console.log("");

      const watchlistId = await getWatchlistIdForTicker(verdict.holding_ticker);
      await saveRecommendation(
        watchlistId,
        recommendation.recommendation_text,
        recommendation.model_used
      );
    } catch (err) {
      console.error(`  Failed to generate recommendation:`, err);
    }
  }
}

// Only runs when this file is executed directly (`npx tsx
// advisor/runAdvisor.ts`), not when imported by a server route — same
// guard pattern used to fix runScraper.ts. This is the only place that
// owns closing the pool for the standalone CLI case.
if (require.main === module) {
  main()
    .then(() => pool.end())
    .catch((err) => {
      console.error("Advisor run failed:", err);
      process.exit(1);
    });
}
