import { Router } from "express";
import { Pool, type PoolClient } from "pg";
import { runScraper } from "../scraper/runScraper";
import { judgeAllHoldings } from "../judge/comparisonJudge";
import { checkAllTimeStops } from "../judge/timeStop";
import { checkAllTheses } from "../judge/thesisCheck";
import { computeDrawdown } from "../judge/drawdown";
import { generateRecommendation } from "../advisor/generateRecommendation";
import { runBotPipeline } from "../aiBot/pipeline";

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
    comparisonJudge: "waiting",
    alerts: "waiting",
    smartAdvisor: "waiting",
  },
};

async function runBot(lockClient: PoolClient): Promise<void> {
  status = {
    running: true,
    runId: null,
    startedAt: new Date().toISOString(),
    error: null,
    stages: {
      priceChecker: "running",
      comparisonJudge: "waiting",
      alerts: "waiting",
      smartAdvisor: "waiting",
    },
  };

  try {
    const summary = await runBotPipeline({
      runPriceChecker: async () => {
        const result = await runScraper();
        status.runId = result.runId;
        status.stages.priceChecker = result.failed === result.total ? "failed" : "completed";
        return result;
      },
      runComparisonJudge: async (runId) => {
        status.stages.comparisonJudge = "running";
        const result = await judgeAllHoldings("return_1y", runId);
        status.stages.comparisonJudge = "completed";
        return result;
      },
      runAlerts: async (runId) => {
        status.stages.alerts = "running";
        const result = await Promise.all([
          checkAllTimeStops(runId),
          checkAllTheses(runId),
          computeDrawdown(),
        ]);
        status.stages.alerts = "completed";
        return result;
      },
      runSmartAdvisor: async (runId, rawVerdicts, rawAlerts) => {
        status.stages.smartAdvisor = "running";
        const verdicts = rawVerdicts as Awaited<ReturnType<typeof judgeAllHoldings>>;
        const [timeStops, theses, drawdown] = rawAlerts as Awaited<ReturnType<typeof Promise.all>>;
        for (const verdict of verdicts) {
          if (verdict.holding_return_percent === null) continue;
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
        }
        status.stages.smartAdvisor = "completed";
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
      : status.stages.comparisonJudge === "running"
        ? "comparisonJudge"
        : status.stages.alerts === "running"
          ? "alerts"
          : "smartAdvisor";
    status.stages[failedStage] = "failed";
    if (status.runId === null && status.startedAt) {
      const runResult = await pool.query<{ id: number }>(
        `SELECT id FROM bot_runs WHERE started_at >= $1 ORDER BY id DESC LIMIT 1`,
        [status.startedAt],
      );
      if (runResult.rows[0]) status.runId = Number(runResult.rows[0].id);
    }
    if (status.runId !== null) {
      await pool.query(
        `UPDATE bot_runs SET status = 'failed', completed_at = now(),
         error_message = $1 WHERE id = $2 AND status = 'running'`,
        [status.error, status.runId],
      );
    }
  } finally {
    status.running = false;
    try {
      await lockClient.query(`SELECT pg_advisory_unlock(${BOT_LOCK_ID})`);
    } finally {
      lockClient.release();
    }
  }
}

router.post("/ai-bot/run", async (_req, res) => {
  let lockClient: PoolClient | null = null;
  try {
    lockClient = await pool.connect();
    const result = await lockClient.query<{ locked: boolean }>(
      `SELECT pg_try_advisory_lock(${BOT_LOCK_ID}) AS locked`,
    );
    if (!result.rows[0]?.locked) {
      lockClient.release();
      res.status(409).json({ error: "AI Bot is already running. Please wait." });
      return;
    }
    void runBot(lockClient);
    res.status(202).json({ running: true });
  } catch (err) {
    lockClient?.release();
    res.status(503).json({ error: "AI Bot lock unavailable. Please try again." });
  }
});

router.get("/ai-bot/status", (_req, res) => {
  res.json(status);
});

export default router;