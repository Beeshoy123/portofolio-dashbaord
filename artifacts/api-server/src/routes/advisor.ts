// Smart Advisor API Route (with Alert System Integration)
// GET /api/advisor/recommendations/:ticker - Get latest recommendation for a holding
// POST /api/advisor/generate - Generate recommendations for all holdings
// GET /api/advisor/recommendations - Get all recommendations for holdings
// POST /api/advisor/generate-opportunities - Generate portfolio opportunities analysis
// GET /api/advisor/opportunities - Get all opportunities (strong unheld, sector gaps)
// GET /api/advisor/alerts-context/:ticker - Get recommendation with alert context

import { Router, Request, Response } from "express";
import { type PoolClient } from "pg";
import { pool } from "../lib/dbPool";
import { judgeAllHoldings, findOpportunities, type OpportunitiesAnalysis } from "../judge/comparisonJudge";
import { generateRecommendation } from "../advisor/generateRecommendation";
import { checkTimeStop } from "../judge/timeStop";
import { checkThesis } from "../judge/thesisCheck";
import { computeDrawdown } from "../judge/drawdownDb";
import { checkAllTimeStops } from "../judge/timeStop";
import { checkAllTheses } from "../judge/thesisCheck";
import { releaseAdvisoryLock, tryAcquireAdvisoryLock } from "../lib/advisoryLock";
import { analyzePortfolioOpportunities, buildOpportunityAnalysisPrompt } from "../advisor/opportunityAnalysis";

const router = Router();

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

function formatStructuredRecommendation(row: any) {
  if (!row.decision && row.confidence === null && !row.evidence && !row.thesis_risk && !row.watch_trigger) {
    return null;
  }
  return {
    decision: row.decision,
    confidence: row.confidence !== null && row.confidence !== undefined ? Number(row.confidence) : 0,
    summary: row.recommendation_text,
    thesis_risk: row.thesis_risk || '',
    evidence: Array.isArray(row.evidence) ? row.evidence : [],
    risks: Array.isArray(row.risks) ? row.risks : [],
    next_review_days: row.next_review_days !== null && row.next_review_days !== undefined ? Number(row.next_review_days) : 14,
    watch_trigger: row.watch_trigger || '',
    do_not_act_reasons: Array.isArray(row.do_not_act_reasons) ? row.do_not_act_reasons : [],
  };
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
      `SELECT ar.id, ar.recommendation_text, ar.model_used, ar.generated_at,
              ar.decision, ar.confidence, ar.thesis_risk, ar.evidence, ar.risks, ar.next_review_days,
              ar.watch_trigger, ar.do_not_act_reasons
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

    const row = result.rows[0];
    return res.json({
      id: row.id,
      ticker: ticker.toUpperCase(),
      recommendation_text: row.recommendation_text,
      model_used: row.model_used,
      generated_at: row.generated_at,
      structured: formatStructuredRecommendation(row),
    });
  } catch (err) {
    console.error("[advisor] GET recommendations/:ticker failed:", err);
    return res.status(500).json({ error: "Failed to fetch recommendation" });
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
              cw.ticker, ar.recommendation_text, ar.model_used, ar.generated_at,
             ar.decision, ar.confidence, ar.thesis_risk, ar.evidence, ar.risks, ar.next_review_days,
              ar.watch_trigger, ar.do_not_act_reasons
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

    const rows = result.rows.map((row) => ({
      ticker: row.ticker,
      recommendation_text: row.recommendation_text,
      model_used: row.model_used,
      generated_at: row.generated_at,
      structured: formatStructuredRecommendation(row),
    }));

    return res.json(rows);
  } catch (err) {
    console.error("[advisor] GET recommendations failed:", err);
    return res.status(500).json({ error: "Failed to fetch recommendations" });
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
          `INSERT INTO advisor_recommendations (watchlist_id, recommendation_text, model_used, run_id, decision, confidence, thesis_risk, evidence, risks, next_review_days, watch_trigger, do_not_act_reasons)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
           ON CONFLICT (watchlist_id, run_id) WHERE run_id IS NOT NULL
           DO UPDATE SET recommendation_text = EXCLUDED.recommendation_text,
                         model_used = EXCLUDED.model_used,
                         decision = EXCLUDED.decision,
                         confidence = EXCLUDED.confidence,
                         thesis_risk = EXCLUDED.thesis_risk,
                         evidence = EXCLUDED.evidence,
                         risks = EXCLUDED.risks,
                         next_review_days = EXCLUDED.next_review_days,
                         watch_trigger = EXCLUDED.watch_trigger,
                         do_not_act_reasons = EXCLUDED.do_not_act_reasons,
                         generated_at = EXCLUDED.generated_at`,
          [
            watchlistResult.rows[0].id,
            recommendation.recommendation_text,
            recommendation.model_used,
            runId,
            recommendation.structured.decision,
            recommendation.structured.confidence,
            recommendation.structured.thesis_risk,
            JSON.stringify(recommendation.structured.evidence),
            JSON.stringify(recommendation.structured.risks),
            recommendation.structured.next_review_days,
            recommendation.structured.watch_trigger,
            JSON.stringify(recommendation.structured.do_not_act_reasons),
          ]
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

    return res.json({ success: true, results });
  } catch (err) {
    console.error("[advisor] POST generate failed:", err);
    return res.status(500).json({ error: "Failed to generate recommendations" });
  } finally {
    if (lockClient) {
      await releaseAdvisoryLock(lockClient, 1844674408).catch((err) => {
        console.error("[advisor] could not release generation lock", err);
      });
      lockClient.release();
    }
  }
});

const OPPORTUNITY_RATE_LIMIT_MS = 60_000;
let lastOpportunityRefreshTime = 0;
const lastOpportunityRefreshByRun = new Map<number, number>();

function checkOpportunityRateLimit(runId?: number): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const globalElapsed = now - lastOpportunityRefreshTime;
  if (globalElapsed < OPPORTUNITY_RATE_LIMIT_MS) {
    const retryAfter = Math.ceil((OPPORTUNITY_RATE_LIMIT_MS - globalElapsed) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }
  if (runId !== undefined) {
    const runTime = lastOpportunityRefreshByRun.get(runId) ?? 0;
    const runElapsed = now - runTime;
    if (runElapsed < OPPORTUNITY_RATE_LIMIT_MS) {
      const retryAfter = Math.ceil((OPPORTUNITY_RATE_LIMIT_MS - runElapsed) / 1000);
      return { allowed: false, retryAfterSeconds: retryAfter };
    }
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function recordOpportunityRefresh(runId?: number): void {
  const now = Date.now();
  lastOpportunityRefreshTime = now;
  if (runId !== undefined) {
    lastOpportunityRefreshByRun.set(runId, now);
  }
}

// On-demand force refresh of opportunities
router.post("/opportunities/refresh", async (req: Request, res: Response) => {
  try {
    const rawRunId = req.body?.runId ?? req.query.runId;
    let runId = parseRunId(rawRunId);
    if (runId === null) {
      runId = await getLatestRunId();
    }
    if (runId === null) {
      return res.status(400).json({ error: "No bot runs available for opportunity analysis" });
    }

    const rateLimit = checkOpportunityRateLimit(runId);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: `Opportunity refresh rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds} seconds before requesting another scan.`,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      });
    }

    const opportunities = await findOpportunities(runId);
    recordOpportunityRefresh(runId);

    return res.json(opportunities);
  } catch (err) {
    console.error("[advisor] POST /opportunities/refresh failed:", err);
    return res.status(500).json({ error: "Failed to perform on-demand opportunity analysis" });
  }
});

// Get all opportunities (or force on-demand refresh if force=true)
router.get("/opportunities", async (req: Request, res: Response) => {
  try {
    const isForce = req.query.force === "true";
    if (isForce) {
      let runId = parseRunId(req.query.runId);
      if (runId === null) {
        runId = await getLatestRunId();
      }
      if (runId === null) {
        return res.status(400).json({ error: "No bot runs available for opportunity analysis" });
      }

      const rateLimit = checkOpportunityRateLimit(runId);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          error: `Opportunity refresh rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds} seconds before requesting another scan.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        });
      }

      const opportunities = await findOpportunities(runId);
      recordOpportunityRefresh(runId);

      return res.json(opportunities);
    }

    const runId = parseRunId(req.query.runId);
    if (runId === null) return res.status(400).json({ error: "runId is required" });

    const result = await pool.query(
      `SELECT DISTINCT ON (cw.ticker, ao.opportunity_type)
              cw.ticker, cw.name, ao.opportunity_text, ao.model_used, ao.generated_at, ao.opportunity_type
       FROM advisor_opportunities ao
       JOIN comparison_watchlist cw ON ao.watchlist_id = cw.id
       WHERE ao.run_id = $1
         AND cw.ticker <> 'ABR'
         AND COALESCE(cw.funds_table_key, '') <> 'abr'
         AND lower(cw.name) NOT LIKE '%bareeq%'
       ORDER BY cw.ticker, ao.opportunity_type, ao.generated_at DESC`,
      [runId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("[advisor] GET opportunities failed:", err);
    return res.status(500).json({ error: "Failed to fetch opportunities" });
  }
});

// Generate opportunities (portfolio-level analysis)
router.post("/generate-opportunities", async (req: Request, res: Response) => {
  let lockClient: PoolClient | null = null;
  try {
    lockClient = await pool.connect();
    const acquired = await tryAcquireAdvisoryLock(lockClient, 1844674409); // Different lock ID
    if (!acquired) {
      lockClient.release();
      res.status(409).json({ error: "Opportunities generation already running. Please wait." });
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
      res.status(409).json({ error: "Run the AI Bot price workflow before generating opportunities." });
      return;
    }

    // Get all verdicts (including unheld)
    const allVerdicts = await judgeAllHoldings("return_1y", runId, true); // includeAllEntities=true

    if (allVerdicts.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No entities to analyze for opportunities",
        results: [],
      });
    }

    // Calculate deterministic opportunity analysis
    const analysis = analyzePortfolioOpportunities(allVerdicts);
    const analysisPrompt = buildOpportunityAnalysisPrompt(analysis);

    const results = [];

    // 1. Save strong unheld entities as opportunity candidates
    for (const strongUnheld of analysis.strong_unheld_entities) {
      try {
        const watchlistResult = await pool.query<{ id: number }>(
          `SELECT id FROM comparison_watchlist WHERE ticker = $1`,
          [strongUnheld.ticker]
        );

        if (watchlistResult.rows.length === 0) {
          results.push({
            ticker: strongUnheld.ticker,
            status: "failed",
            reason: "Watchlist entry not found",
          });
          continue;
        }

        const opportunityText = `Strong performer not currently in portfolio. Return: ${strongUnheld.return_percent !== null ? strongUnheld.return_percent.toFixed(1) + '%' : 'unavailable'}. Risk tier: ${strongUnheld.risk_tier || 'unknown'}. Worth considering for portfolio diversification based on comparison analysis.`;

        await pool.query(
          `INSERT INTO advisor_opportunities (watchlist_id, opportunity_text, model_used, run_id, opportunity_type)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (watchlist_id, run_id, opportunity_type) WHERE run_id IS NOT NULL
           DO UPDATE SET opportunity_text = EXCLUDED.opportunity_text,
                         model_used = EXCLUDED.model_used,
                         generated_at = EXCLUDED.generated_at`,
          [watchlistResult.rows[0].id, opportunityText, "deterministic-analysis", runId, "strong_unheld"]
        );

        results.push({
          ticker: strongUnheld.ticker,
          status: "success",
        });
      } catch (err) {
        results.push({
          ticker: strongUnheld.ticker,
          status: "failed",
          reason: String(err),
        });
      }
    }

    // 2. Save sector gap opportunities
    for (const sectorGap of analysis.sectors_no_strong_exposure) {
      for (const opportunity of sectorGap.unheld_strong_entities) {
        try {
          const watchlistResult = await pool.query<{ id: number }>(
            `SELECT id FROM comparison_watchlist WHERE ticker = $1`,
            [opportunity.ticker]
          );

          if (watchlistResult.rows.length === 0) continue;

          const opportunityText = `${opportunity.ticker} is a strong performer in the ${sectorGap.sector} sector, where your portfolio currently has no strong holdings. Return: ${opportunity.return_percent !== null ? opportunity.return_percent.toFixed(1) + '%' : 'unavailable'}. Consider for sector diversification.`;

          await pool.query(
            `INSERT INTO advisor_opportunities (watchlist_id, opportunity_text, model_used, run_id, opportunity_type)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (watchlist_id, run_id, opportunity_type) WHERE run_id IS NOT NULL
             DO UPDATE SET opportunity_text = EXCLUDED.opportunity_text,
                           model_used = EXCLUDED.model_used,
                           generated_at = EXCLUDED.generated_at`,
            [watchlistResult.rows[0].id, opportunityText, "deterministic-analysis", runId, "sector_gap"]
          );

          results.push({
            ticker: opportunity.ticker,
            status: "success",
          });
        } catch (err) {
          results.push({
            ticker: opportunity.ticker,
            status: "failed",
            reason: String(err),
          });
        }
      }
    }

    // 3. Save underrepresented sector opportunities
    for (const underrep of analysis.underrepresented_sectors) {
      for (const opportunity of underrep.unheld_strong_entities) {
        try {
          const watchlistResult = await pool.query<{ id: number }>(
            `SELECT id FROM comparison_watchlist WHERE ticker = $1`,
            [opportunity.ticker]
          );

          if (watchlistResult.rows.length === 0) continue;

          // Check if not already saved as strong_unheld or sector_gap
          const existing = await pool.query(
            `SELECT id FROM advisor_opportunities 
             WHERE watchlist_id = $1 AND run_id = $2 AND opportunity_type IN ('strong_unheld', 'sector_gap')`,
            [watchlistResult.rows[0].id, runId]
          );

          if (existing.rows.length > 0) continue; // Already saved

          const opportunityText = `${opportunity.ticker} is strong in ${underrep.sector}, a sector where your portfolio has limited strong exposure (${underrep.held_strong_count} strong holding${underrep.held_strong_count !== 1 ? 's' : ''}). Return: ${opportunity.return_percent !== null ? opportunity.return_percent.toFixed(1) + '%' : 'unavailable'}. Consider for sector strengthening.`;

          await pool.query(
            `INSERT INTO advisor_opportunities (watchlist_id, opportunity_text, model_used, run_id, opportunity_type)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (watchlist_id, run_id, opportunity_type) WHERE run_id IS NOT NULL
             DO UPDATE SET opportunity_text = EXCLUDED.opportunity_text,
                           model_used = EXCLUDED.model_used,
                           generated_at = EXCLUDED.generated_at`,
            [watchlistResult.rows[0].id, opportunityText, "deterministic-analysis", runId, "underrepresented"]
          );

          results.push({
            ticker: opportunity.ticker,
            status: "success",
          });
        } catch (err) {
          results.push({
            ticker: opportunity.ticker,
            status: "failed",
            reason: String(err),
          });
        }
      }
    }

    return res.json({ success: true, results, analysis_summary: analysisPrompt });
  } catch (err) {
    console.error("[advisor] POST generate-opportunities failed:", err);
    return res.status(500).json({ error: "Failed to generate opportunities" });
  } finally {
    if (lockClient) {
      await releaseAdvisoryLock(lockClient, 1844674409).catch((err) => {
        console.error("[advisor] could not release opportunities lock", err);
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

    return res.json({
      recommendation: recResult.rows[0],
      alerts: {
        timeStop,
        thesis,
        drawdown,
      },
    });
  } catch (err) {
    console.error(`[advisor] GET alerts-context/:${req.params.ticker} failed:`, err);
    return res.status(500).json({ error: "Failed to fetch recommendation with alerts" });
  }
});

export default router;

function parseRunId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const runId = Number(value);
  return Number.isSafeInteger(runId) && runId > 0 ? runId : null;
}

async function getLatestRunId(): Promise<number | null> {
  const result = await pool.query<{ id: number }>(
    `SELECT id FROM bot_runs ORDER BY id DESC LIMIT 1`
  );
  if (result.rows.length === 0) return null;
  return Number(result.rows[0].id);
}

