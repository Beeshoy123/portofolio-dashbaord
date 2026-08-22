import { Router } from "express";
import { Pool, type PoolClient } from "pg";
import { runScraper } from "../scraper/runScraper";
import { judgeAllHoldings } from "../judge/comparisonJudge";
import { checkAllTimeStops } from "../judge/timeStop";
import { checkAllTheses } from "../judge/thesisCheck";
import { capturePortfolioValue, computeDrawdown } from "../judge/drawdown";
import { generateRecommendation } from "../advisor/generateRecommendation";
import { runBotPipeline } from "../aiBot/pipeline";
import { runTechnicalAnalysis } from "../technical/technicalAnalysis";
import { releaseAdvisoryLock, tryAcquireAdvisoryLock } from "../lib/advisoryLock";

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BOT_LOCK_ID = 1844674410;

type StageState = "waiting" | "running" | "completed" | "failed";
type BotStatus = {
  running: boolean;
  runId: number | null;
  startedAt: string | null;
  error: string | null;
  stages: {
    priceChecker: StageState;
    technicalAnalysis: StageState;
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
    technicalAnalysis: "waiting",
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
      technicalAnalysis: "waiting",
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
      runTechnicalAnalysis: async (runId) => {
        status.stages.technicalAnalysis = "running";
        try {
          const result = await runTechnicalAnalysis(runId);
          status.stages.technicalAnalysis = "completed";
          return result;
        } catch (error) {
          status.stages.technicalAnalysis = "failed";
          console.error("[ai-bot] Technical Analysis failed", error);
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
          await runWithConcurrency(verdicts, 3, async (verdict) => {
            if (verdict.holding_return_percent === null) return;
            try {
              const recommendation = await generateRecommendation(verdict, {
                timeStop: timeStops.find((alert) => alert.ticker === verdict.holding_ticker),
                thesis: theses.find((alert) => alert.ticker === verdict.holding_ticker),
                drawdown,
              });
              await pool.query(
                `INSERT INTO advisor_recommendations (watchlist_id, recommendation_text, model_used, run_id)
                 SELECT id, $1, $2, $4 FROM comparison_watchlist WHERE ticker = $3
                 ON CONFLICT (watchlist_id, run_id) WHERE run_id IS NOT NULL DO NOTHING`,
                [recommendation.recommendation_text, recommendation.model_used, verdict.holding_ticker, runId],
              );
            } catch (error) {
              console.error(`[ai-bot] Smart Advisor failed for ${verdict.holding_ticker}`, error);
            }
          });
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
      : status.stages.technicalAnalysis === "running"
        ? "technicalAnalysis"
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
        technicalAnalysis: latest.status === "failed" ? "failed" : latest.status === "running" ? "running" : "completed",
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

export default router;