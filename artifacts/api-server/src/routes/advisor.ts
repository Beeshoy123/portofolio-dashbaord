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

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Get latest recommendation for a specific ticker
router.get("/recommendations/:ticker", async (req: Request, res: Response) => {
  try {
    const { ticker } = req.params;

    const result = await pool.query(
      `SELECT ar.id, ar.recommendation_text, ar.model_used, ar.generated_at
       FROM advisor_recommendations ar
       JOIN comparison_watchlist cw ON ar.watchlist_id = cw.id
       WHERE cw.ticker = $1
       ORDER BY ar.generated_at DESC
       LIMIT 1`,
      [ticker.toUpperCase()]
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
    const runId = typeof req.query.runId === "string" ? Number(req.query.runId) : null;
    const runFilter = runId !== null && Number.isInteger(runId) ? "AND ar.run_id = $1" : "";
    const params = runFilter ? [runId] : [];
    const result = await pool.query(
      `SELECT DISTINCT ON (cw.ticker) 
              cw.ticker, ar.recommendation_text, ar.model_used, ar.generated_at
       FROM advisor_recommendations ar
       JOIN comparison_watchlist cw ON ar.watchlist_id = cw.id
       WHERE cw.is_held = true ${runFilter}
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
    const lockResult = await lockClient.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(1844674408) AS locked",
    );
    if (!lockResult.rows[0]?.locked) {
      lockClient.release();
      res.status(409).json({ error: "Recommendation generation already running. Please wait." });
      return;
    }

    const runResult = await pool.query<{ id: number }>(
      `SELECT id FROM bot_runs
       WHERE status IN ('completed', 'partial')
       ORDER BY completed_at DESC NULLS LAST, started_at DESC
       LIMIT 1`,
    );
    if (runResult.rows.length === 0) {
      res.status(409).json({ error: "Run the AI Bot price workflow before generating recommendations." });
      return;
    }

    const runId = Number(runResult.rows[0].id);
    const verdicts = await judgeAllHoldings("return_1y", runId);
    const [timeStops, theses, drawdown] = await Promise.all([
      checkAllTimeStops(runId),
      checkAllTheses(runId),
      computeDrawdown(),
    ]);

    if (verdicts.length === 0) {
      return res.json({ success: true, message: "No holdings to generate recommendations for" });
    }

    const results = [];

    for (const verdict of verdicts) {
      if (verdict.holding_return_percent === null) {
        results.push({
          ticker: verdict.holding_ticker,
          status: "skipped",
          reason: "No return data available",
        });
        continue;
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
          results.push({
            ticker: verdict.holding_ticker,
            status: "failed",
            reason: "Watchlist entry not found",
          });
          continue;
        }

        // Save recommendation
        await pool.query(
          `INSERT INTO advisor_recommendations (watchlist_id, recommendation_text, model_used, run_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (watchlist_id, run_id) WHERE run_id IS NOT NULL DO NOTHING`,
          [watchlistResult.rows[0].id, recommendation.recommendation_text, recommendation.model_used, runId]
        );

        results.push({
          ticker: verdict.holding_ticker,
          status: "success",
          recommendation: recommendation.recommendation_text.substring(0, 200) + "...",
        });
      } catch (err) {
        results.push({
          ticker: verdict.holding_ticker,
          status: "failed",
          reason: String(err),
        });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error("[advisor] POST generate failed:", err);
    res.status(500).json({ error: "Failed to generate recommendations" });
  } finally {
    if (lockClient) {
      await lockClient.query("SELECT pg_advisory_unlock(1844674408)").catch((err) => {
        console.error("[advisor] could not release generation lock", err);
      });
      lockClient.release();
    }
  }
});

// Get recommendation with alert system context
router.get("/alerts-context/:ticker", async (req: Request, res: Response) => {
  try {
    const { ticker } = req.params;
    const upperTicker = ticker.toUpperCase();

    // Fetch latest recommendation
    const recResult = await pool.query(
      `SELECT ar.id, ar.recommendation_text, ar.model_used, ar.generated_at
       FROM advisor_recommendations ar
       JOIN comparison_watchlist cw ON ar.watchlist_id = cw.id
       WHERE cw.ticker = $1
       ORDER BY ar.generated_at DESC
       LIMIT 1`,
      [upperTicker]
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
    const timeStop = await checkTimeStop(watchlistId);
    const thesis = await checkThesis(watchlistId);
    const drawdown = await computeDrawdown();

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
