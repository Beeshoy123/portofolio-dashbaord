import { Router } from "express";
import { type PoolClient } from "pg";
import { pool } from "../lib/dbPool";
import { runScraper } from "../scraper/runScraper";
import { judgeAllHoldings, findOpportunities, type OpportunitiesAnalysis } from "../judge/comparisonJudge";
import { checkAllTimeStops } from "../judge/timeStop";
import { checkAllTheses } from "../judge/thesisCheck";
import { getRecentSignalTrend } from "../judge/signalTrend";
import { capturePortfolioValue, computeDrawdown } from "../judge/drawdownDb";
import { generatePortfolioSummary, generateRecommendation } from "../advisor/generateRecommendation";
import { runBotPipeline } from "../aiBot/pipeline";
import { runTechnicalAnalysis } from "../technical/technicalAnalysis";
import { releaseAdvisoryLock, tryAcquireAdvisoryLock } from "../lib/advisoryLock";

const router = Router();
const BOT_LOCK_ID = 1844674410;

type StageState = "waiting" | "running" | "completed" | "failed";
type BotStatus = {
  running: boolean;
  runId: number | null;
  startedAt: string | null;
  error: string | null;
  stages: {
    priceChecker: StageState;
    chartReader: StageState;
    comparisonJudge: StageState;
    alerts: StageState;
    smartAdvisor: StageState;
  };
};

let status: BotStatus = {
  running: false,
  runId: null,
  startedAt: null,
  error: null,
  stages: {
    priceChecker: "waiting",
    chartReader: "waiting",
    comparisonJudge: "waiting",
    alerts: "waiting",
    smartAdvisor: "waiting",
  },
};

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        await worker(item);
      }
    },
  );
  await Promise.all(workers);
}

async function runBot(lockClient: PoolClient, runId: number): Promise<void> {
  status = {
    running: true,
    runId,
    startedAt: new Date().toISOString(),
    error: null,
    stages: {
      priceChecker: "running",
      chartReader: "waiting",
      comparisonJudge: "waiting",
      alerts: "waiting",
      smartAdvisor: "waiting",
    },
  };

  try {
    const summary = await runBotPipeline({
      runPriceChecker: async () => {
        const result = await runScraper(runId);
        status.stages.priceChecker = result.failed === result.total ? "failed" : "completed";
        return result;
      },
      runChartReader: async (runId) => {
        status.stages.chartReader = "running";
        try {
          const result = await runTechnicalAnalysis(runId);
          status.stages.chartReader = "completed";
          return result;
        } catch (error) {
          status.stages.chartReader = "failed";
          console.error("[ai-bot] Chart Reader failed", error);
          return { succeeded: 0, failed: 0, total: 0 };
        }
      },
      runComparisonJudge: async (runId) => {
        status.stages.comparisonJudge = "running";
        try {
          const result = await judgeAllHoldings("return_1y", runId);
          status.stages.comparisonJudge = "completed";
          return result;
        } catch (error) {
          status.stages.comparisonJudge = "failed";
          console.error("[ai-bot] Comparison Judge failed", error);
          return [];
        }
      },
      runAlerts: async (runId) => {
        status.stages.alerts = "running";
        try {
          await capturePortfolioValue(runId);
          const result = await Promise.all([
            checkAllTimeStops(runId),
            checkAllTheses(runId),
            computeDrawdown(runId),
          ]);
          status.stages.alerts = "completed";
          return result;
        } catch (error) {
          status.stages.alerts = "failed";
          console.error("[ai-bot] Alerts failed", error);
          return [];
        }
      },
      runSmartAdvisor: async (runId, rawVerdicts, rawAlerts) => {
        status.stages.smartAdvisor = "running";
        try {
          const verdicts = rawVerdicts as Awaited<ReturnType<typeof judgeAllHoldings>>;
          const [timeStops, theses, drawdown] = rawAlerts as [
            Array<{ ticker: string; is_stagnant: boolean; stagnant_days?: number | null }>,
            Array<{ ticker: string; has_reversal: boolean; newly_appeared_flags?: string[] }>,
            { current_drawdown_percent?: number | null } | undefined,
          ];
          let portfolioSummaryContext: {
            summary_text: string;
            strong_count: number;
            mixed_count: number;
            weak_count: number;
            insufficient_data_count: number;
          } | undefined;

          // Portfolio Summary must succeed — it's essential for per-holding context
          const counts = verdicts.reduce(
            (result, verdict) => {
              if (verdict.signal === "Strong") result.strong++;
              else if (verdict.signal === "Mixed") result.mixed++;
              else if (verdict.signal === "Weak") result.weak++;
              else if (verdict.signal === "Insufficient Data") result.insufficientData++;

              if (verdict.flags && verdict.flags.length > 0) {
                result.flaggedCount++;
              }
              if (typeof verdict.coverage_percent === "number" && Number.isFinite(verdict.coverage_percent)) {
                result.coverageSum += verdict.coverage_percent;
                result.coverageCount++;
              }
              if (verdict.technical_signal?.reversal_risk === "elevated") {
                result.reversalRiskCount++;
              }
              if (verdict.flags && verdict.flags.includes("technical_divergence")) {
                result.divergenceCount++;
              }

              return result;
            },
            {
              strong: 0,
              mixed: 0,
              weak: 0,
              insufficientData: 0,
              flaggedCount: 0,
              coverageSum: 0,
              coverageCount: 0,
              reversalRiskCount: 0,
              divergenceCount: 0,
            },
          );

          const avgCoveragePercent = counts.coverageCount > 0
            ? Number((counts.coverageSum / counts.coverageCount).toFixed(1))
            : null;
          try {
            // Discover opportunities periodically (every 5th run) to balance freshness vs. performance
            // Each run evaluates ~59 entities instead of ~8-10 held ones, so we throttle to reduce load
            let opportunities: OpportunitiesAnalysis | undefined;
            if (runId && runId % 5 === 0) {
              try {
                opportunities = await findOpportunities(runId);
                console.log("[ai-bot] Opportunities discovery ran for runId", runId);
              } catch (err) {
                console.warn("[ai-bot] Opportunities discovery failed; proceeding without opportunity context:", err);
                // Non-fatal: opportunities are optional context, portfolio summary can still run
              }
            } else if (runId) {
              console.log("[ai-bot] Skipping opportunities discovery for runId", runId, "(runs every 5th time)");
            }

            const portfolioSummary = await generatePortfolioSummary(verdicts, opportunities);
            portfolioSummaryContext = {
              summary_text: portfolioSummary.summary_text,
              strong_count: counts.strong,
              mixed_count: counts.mixed,
              weak_count: counts.weak,
              insufficient_data_count: counts.insufficientData,
            };
            await pool.query(
              `INSERT INTO portfolio_summaries
                (run_id, summary_text, strong_count, mixed_count, weak_count, insufficient_data_count, model_used, flagged_count, avg_coverage_percent, reversal_risk_count, divergence_count)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
               ON CONFLICT (run_id) DO NOTHING`,
              [
                runId,
                portfolioSummary.summary_text,
                counts.strong,
                counts.mixed,
                counts.weak,
                counts.insufficientData,
                portfolioSummary.model_used,
                counts.flaggedCount,
                avgCoveragePercent,
                counts.reversalRiskCount,
                counts.divergenceCount,
              ],
            );
          } catch (error) {
            throw new Error(`Portfolio summary generation failed; cannot continue with per-holding advisor: ${error instanceof Error ? error.message : "unknown error"}`);
          }

          // Track advisor generation success — if all fail, the run should not be "completed"
          let advisorSuccessCount = 0;
          let advisorFailureCount = 0;

          await runWithConcurrency(verdicts, 3, async (verdict) => {
            try {
              // Call Gemini for ALL verdicts, including those with missing return data — Gemini will explain insufficient data
              // Fetch signal trend for context
              const watchlistIdResult = await pool.query<{ id: number }>(
                `SELECT id FROM comparison_watchlist WHERE ticker = $1`,
                [verdict.holding_ticker]
              );
              const watchlistId = watchlistIdResult.rows[0]?.id;
              const signalTrend = watchlistId ? await getRecentSignalTrend(watchlistId) : null;
              
              const recommendation = await generateRecommendation(verdict, {
                timeStop: timeStops.find((alert) => alert.ticker === verdict.holding_ticker),
                thesis: theses.find((alert) => alert.ticker === verdict.holding_ticker),
                drawdown,
                signalTrend,
                portfolioSummary: portfolioSummaryContext,
              });
              await pool.query(
                `INSERT INTO advisor_recommendations (watchlist_id, recommendation_text, model_used, run_id, decision, confidence, evidence, risks, next_review_days, watch_trigger, do_not_act_reasons)
                 SELECT id, $1, $2, $4, $5, $6, $7, $8, $9, $10, $11 FROM comparison_watchlist WHERE ticker = $3
                 ON CONFLICT (watchlist_id, run_id) WHERE run_id IS NOT NULL DO NOTHING`,
                [
                  recommendation.recommendation_text,
                  recommendation.model_used,
                  verdict.holding_ticker,
                  runId,
                  recommendation.structured.decision,
                  recommendation.structured.confidence,
                  JSON.stringify(recommendation.structured.evidence),
                  JSON.stringify(recommendation.structured.risks),
                  recommendation.structured.next_review_days,
                  recommendation.structured.watch_trigger,
                  JSON.stringify(recommendation.structured.do_not_act_reasons),
                ],
              );
              advisorSuccessCount++;
            } catch (error) {
              advisorFailureCount++;
              console.error(`[ai-bot] Smart Advisor failed for ${verdict.holding_ticker}`, error);
            }
          });

          // If no recommendations were generated, this is a failure
          if (advisorSuccessCount === 0 && verdicts.length > 0) {
            throw new Error(`Smart Advisor generated 0 recommendations out of ${verdicts.length} verdicts; all advisor calls failed`);
          }

          // Log partial advisor results if some failed
          if (advisorFailureCount > 0) {
            console.warn(`[ai-bot] Smart Advisor completed with partial results: ${advisorSuccessCount}/${verdicts.length} recommendations generated`);
          }

          status.stages.smartAdvisor = "completed";
        } catch (error) {
          status.stages.smartAdvisor = "failed";
          console.error("[ai-bot] Smart Advisor failed", error);
        }
      },
    });
    await pool.query(
      `UPDATE bot_runs SET status = $1, completed_at = now(), succeeded_count = $2,
       failed_count = $3, total_count = $4 WHERE id = $5`,
      [summary.failed ? "partial" : "completed", summary.succeeded, summary.failed, summary.total, summary.runId],
    );
  } catch (err) {
    status.error = err instanceof Error ? err.message : "AI Bot run failed";
    const failedStage = status.stages.priceChecker === "running"
      ? "priceChecker"
      : status.stages.chartReader === "running"
        ? "chartReader"
      : status.stages.comparisonJudge === "running"
        ? "comparisonJudge"
        : status.stages.alerts === "running"
          ? "alerts"
          : "smartAdvisor";
    status.stages[failedStage] = "failed";
    await pool.query(
      `UPDATE bot_runs SET status = 'failed', completed_at = now(),
       error_message = $1 WHERE id = $2 AND status = 'running'`,
      [status.error, runId],
    );
  } finally {
    status.running = false;
    try {
      await releaseAdvisoryLock(lockClient, BOT_LOCK_ID);
    } finally {
      lockClient.release();
    }
  }
}

router.post("/ai-bot/run", async (_req, res) => {
  let lockClient: PoolClient | null = null;
  try {
    lockClient = await pool.connect();
    const acquired = await tryAcquireAdvisoryLock(lockClient, BOT_LOCK_ID);
    if (!acquired) {
      lockClient.release();
      res.status(409).json({ error: "AI Bot is already running. Please wait." });
      return;
    }
    const runResult = await lockClient.query<{ id: number }>(
      `INSERT INTO bot_runs (status) VALUES ('running') RETURNING id`,
    );
    const runId = Number(runResult.rows[0].id);
    void runBot(lockClient, runId).catch((err) => {
      console.error("[ai-bot] background run failed unexpectedly:", err);
    });
    res.status(202).json({ running: true, runId });
  } catch (err) {
    lockClient?.release();
    res.status(503).json({ error: "AI Bot lock unavailable. Please try again." });
  }
});

router.get("/ai-bot/status", async (_req, res) => {
  if (status.running) {
    res.json(status);
    return;
  }

  try {
    await pool.query(
      `UPDATE bot_runs
       SET status = 'failed', completed_at = now(), error_message = 'API restarted while run was active'
        WHERE status = 'running'`,
    );
    const result = await pool.query<{
      id: number;
      status: string;
      started_at: string;
      completed_at: string | null;
      error_message: string | null;
    }>(
      `SELECT id, status, started_at, completed_at, error_message
       FROM bot_runs ORDER BY id DESC LIMIT 1`,
    );
    const latest = result.rows[0];
    if (!latest) {
      res.json(status);
      return;
    }

    res.json({
      running: latest.status === "running",
      runId: Number(latest.id),
      startedAt: latest.started_at,
      error: latest.error_message,
      stages: {
        priceChecker: latest.status === "failed" ? "failed" : latest.status === "running" ? "running" : "completed",
        chartReader: latest.status === "failed" ? "failed" : latest.status === "running" ? "running" : "completed",
        comparisonJudge: latest.status === "completed" || latest.status === "partial" ? "completed" : "waiting",
        alerts: latest.status === "completed" || latest.status === "partial" ? "completed" : "waiting",
        smartAdvisor: latest.status === "completed" || latest.status === "partial" ? "completed" : "waiting",
      },
    });
  } catch (err) {
    console.error("[ai-bot] could not load persisted status:", err);
    res.json(status);
  }
});

router.get("/api/portfolio-summary", async (req, res) => {
  try {
    const runId = req.query.runId ? Number(req.query.runId) : undefined;
    
    let query = `SELECT summary_text, strong_count, mixed_count, weak_count, insufficient_data_count,
                        flagged_count, avg_coverage_percent, reversal_risk_count, divergence_count,
                        model_used, generated_at 
                 FROM portfolio_summaries`;
    const params: (number | undefined)[] = [];
    
    if (runId) {
      query += ` WHERE run_id = $1`;
      params.push(runId);
    } else {
      query += ` ORDER BY generated_at DESC LIMIT 1`;
    }
    
    const result = await pool.query<{
      summary_text: string;
      strong_count: number;
      mixed_count: number;
      weak_count: number;
      insufficient_data_count: number;
      flagged_count: number | null;
      avg_coverage_percent: number | string | null;
      reversal_risk_count: number | null;
      divergence_count: number | null;
      model_used: string;
      generated_at: string;
    }>(query, params.filter((p) => p !== undefined));
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: "Portfolio summary not found" });
      return;
    }
    
    const summary = result.rows[0];
    res.json({
      summary_text: summary.summary_text,
      strong_count: summary.strong_count,
      mixed_count: summary.mixed_count,
      weak_count: summary.weak_count,
      insufficient_data_count: summary.insufficient_data_count,
      flagged_count: summary.flagged_count !== null ? Number(summary.flagged_count) : 0,
      avg_coverage_percent: summary.avg_coverage_percent !== null ? Number(summary.avg_coverage_percent) : null,
      reversal_risk_count: summary.reversal_risk_count !== null ? Number(summary.reversal_risk_count) : 0,
      divergence_count: summary.divergence_count !== null ? Number(summary.divergence_count) : 0,
      model_used: summary.model_used,
      generated_at: summary.generated_at,
    });
  } catch (err) {
    console.error("[ai-bot] portfolio summary fetch failed:", err);
    res.status(500).json({ error: "Portfolio summary fetch failed" });
  }
});

export default router;