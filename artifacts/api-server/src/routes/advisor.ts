// Smart Advisor API Route (with Alert System Integration)
// GET /api/advisor/recommendations/:ticker - Get latest recommendation for a holding
// POST /api/advisor/generate - Generate recommendations for all holdings
// GET /api/advisor/alerts-context/:ticker - Get recommendation with alert context

import { Router, Request, Response } from "express";
import { Pool, type PoolClient } from "pg";
import { judgeAllHoldings } from "../judge/comparisonJudge";
import { generateRecommendation } from "../advisor/generateRecommendation";
import { checkTimeStop } from "../judge/timeStop";
import { checkThesis } from "../judge/thesisCheck";
import { computeDrawdown } from "../judge/drawdown";
import { checkAllTimeStops } from "../judge/timeStop";
import { checkAllTheses } from "../judge/thesisCheck";
import { releaseAdvisoryLock, tryAcquireAdvisoryLock } from "../lib/advisoryLock";

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex++;
        results[index] = await worker(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

// Get latest recommendation for a specific ticker
router.get("/recommendations/:ticker", async (req: Request, res: Response) => {
  try {
    const ticker = String(req.params.ticker);
    const runId = parseRunId(req.query.runId);
    if (runId === null) {
      return res.status(400).json({ error: "runId is required" });
    }

    const result = await pool.query(
      `SELECT ar.id, ar.recommendation_text, ar.model_used, ar.generated_at
       FROM advisor_recommendations ar
       JOIN comparison_watchlist cw ON ar.watchlist_id = cw.id
      WHERE cw.ticker = $1 AND ar.run_id = $2
       ORDER BY ar.generated_at DESC
       LIMIT 1`,
      [ticker.toUpperCase(), runId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No recommendation found for this ticker" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("[advisor] GET recommendations/:ticker failed:", err);
    res.status(500).json({ error: "Failed to fetch recommendation" });
  }
});

// Get all latest recommendations
router.get("/recommendations", async (req: Request, res: Response) => {
  try {
    const runId = parseRunId(req.query.runId);
    if (runId === null) return res.status(400).json({ error: "runId is required" });
    const runFilter = "AND ar.run_id = $1";
    const params = [runId];
    const result = await pool.query(
      `SELECT DISTINCT ON (cw.ticker) 
              cw.ticker, ar.recommendation_text, ar.model_used, ar.generated_at
       FROM advisor_recommendations ar
       JOIN comparison_watchlist cw ON ar.watchlist_id = cw.id
       WHERE cw.is_held = true
         AND cw.ticker <> 'ABR'
         AND COALESCE(cw.funds_table_key, '') <> 'abr'
         AND lower(cw.name) NOT LIKE '%bareeq%'
         AND ar.recommendation_text NOT LIKE '%STRICT RULES%'
         AND ar.recommendation_text NOT LIKE '%Plain, direct, warm%'
         AND ar.recommendation_text NOT LIKE '%Write the recommendation now%'
         ${runFilter}
       ORDER BY cw.ticker, ar.generated_at DESC`
      , params
    );

    res.json(result.rows);
  } catch (err) {
    console.error("[advisor] GET recommendations failed:", err);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// Generate recommendations for all holdings (can be called manually)
router.post("/generate", async (req: Request, res: Response) => {
  let lockClient: PoolClient | null = null;
  try {
    lockClient = await pool.connect();
    const acquired = await tryAcquireAdvisoryLock(lockClient, 1844674408);
    if (!acquired) {
      lockClient.release();
      res.status(409).json({ error: "Recommendation generation already running. Please wait." });
      return;
    }

    const runId = parseRunId(req.query.runId);
    if (runId === null) {
      res.status(400).json({ error: "runId is required" });
      return;
    }
    const runResult = await pool.query<{ id: number }>(
      `SELECT id FROM bot_runs
       WHERE id = $1 AND status IN ('completed', 'partial')`,
      [runId],
    );
    if (runResult.rows.length === 0) {
      res.status(409).json({ error: "Run the AI Bot price workflow before generating recommendations." });
      return;
    }

    const requestedTicker = typeof req.query.ticker === "string"
      ? req.query.ticker.trim().toUpperCase()
      : null;
    const allVerdicts = await judgeAllHoldings("return_1y", runId);
    const verdicts = requestedTicker
      ? allVerdicts.filter((verdict) => verdict.holding_ticker === requestedTicker)
      : allVerdicts;
    const [timeStops, theses, drawdown] = await Promise.all([
      checkAllTimeStops(runId),
      checkAllTheses(runId),
      computeDrawdown(runId),
    ]);

    if (verdicts.length === 0) {
      return res.status(requestedTicker ? 404 : 200).json({
        success: requestedTicker ? false : true,
        message: requestedTicker
          ? `No eligible holding found for ${requestedTicker}`
          : "No holdings to generate recommendations for",
      });
    }

    const results = await mapWithConcurrency(verdicts, 3, async (verdict) => {
      if (verdict.holding_return_percent === null) {
        return {
          ticker: verdict.holding_ticker,
          status: "skipped",
          reason: "No return data available",
        };
      }

      try {
        const recommendation = await generateRecommendation(verdict, {
          timeStop: timeStops.find((alert) => alert.ticker === verdict.holding_ticker),
          thesis: theses.find((alert) => alert.ticker === verdict.holding_ticker),
          drawdown,
        });

        // Get watchlist ID
        const watchlistResult = await pool.query<{ id: number }>(
          `SELECT id FROM comparison_watchlist WHERE ticker = $1`,
          [verdict.holding_ticker]
        );

        if (watchlistResult.rows.length === 0) {
          return {
            ticker: verdict.holding_ticker,
            status: "failed",
            reason: "Watchlist entry not found",
          };
        }

        // Save recommendation
        await pool.query(
          `INSERT INTO advisor_recommendations (watchlist_id, recommendation_text, model_used, run_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (watchlist_id, run_id) WHERE run_id IS NOT NULL
           DO UPDATE SET recommendation_text = EXCLUDED.recommendation_text,
                         model_used = EXCLUDED.model_used,
                         generated_at = EXCLUDED.generated_at`,
          [watchlistResult.rows[0].id, recommendation.recommendation_text, recommendation.model_used, runId]
        );

        return {
          ticker: verdict.holding_ticker,
          status: "success",
          recommendation: recommendation.recommendation_text.substring(0, 200) + "...",
        };
      } catch (err) {
        return {
          ticker: verdict.holding_ticker,
          status: "failed",
          reason: String(err),
        };
      }
    });

    res.json({ success: true, results });
  } catch (err) {
    console.error("[advisor] POST generate failed:", err);
    res.status(500).json({ error: "Failed to generate recommendations" });
  } finally {
    if (lockClient) {
      await releaseAdvisoryLock(lockClient, 1844674408).catch((err) => {
        console.error("[advisor] could not release generation lock", err);
      });
      lockClient.release();
    }
  }
});

// Get recommendation with alert system context
router.get("/alerts-context/:ticker", async (req: Request, res: Response) => {
  try {
    const ticker = String(req.params.ticker);
    const upperTicker = ticker.toUpperCase();
    const runId = parseRunId(req.query.runId);
    if (runId === null) return res.status(400).json({ error: "runId is required" });

    // Fetch latest recommendation
    const recResult = await pool.query(
      `SELECT ar.id, ar.recommendation_text, ar.model_used, ar.generated_at
       FROM advisor_recommendations ar
       JOIN comparison_watchlist cw ON ar.watchlist_id = cw.id
      WHERE cw.ticker = $1 AND ar.run_id = $2
       ORDER BY ar.generated_at DESC
       LIMIT 1`,
      [upperTicker, runId]
    );

    if (recResult.rows.length === 0) {
      return res.status(404).json({ error: "No recommendation found for this ticker" });
    }

    // Fetch watchlist ID for alert context
    const watchlistResult = await pool.query<{ id: number }>(
      `SELECT id FROM comparison_watchlist WHERE ticker = $1`,
      [upperTicker]
    );

    if (watchlistResult.rows.length === 0) {
      return res.status(404).json({ error: "Ticker not found in watchlist" });
    }

    const watchlistId = watchlistResult.rows[0].id;

    // Fetch alert context
    const timeStop = await checkTimeStop(watchlistId, runId);
    const thesis = await checkThesis(watchlistId, runId);
    const drawdown = await computeDrawdown(runId);

    res.json({
      recommendation: recResult.rows[0],
      alerts: {
        timeStop,
        thesis,
        drawdown,
      },
    });
  } catch (err) {
    console.error(`[advisor] GET alerts-context/:${req.params.ticker} failed:`, err);
    res.status(500).json({ error: "Failed to fetch recommendation with alerts" });
  }
});

export default router;

function parseRunId(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const runId = Number(value);
  return Number.isSafeInteger(runId) && runId > 0 ? runId : null;
}
