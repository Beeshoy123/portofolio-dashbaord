import { Router } from "express";
import { pool } from "../lib/dbPool";
import { diagnoseEntity, type DiagnosticEntityRow } from "./diagnosticLogic";

const router = Router();
type DiagnosticState = "complete" | "partial" | "missing" | "dash";

type RunRow = {
  id: number;
  status: string;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  stage_counts: Record<string, { succeeded: number; failed: number; total: number }>;
  stage_errors: Record<string, string[]>;
};

router.get("/ai-bot/diagnostics", async (req, res) => {
  const rawRunId = req.query.runId;
  const requestedRunId = rawRunId === undefined
    ? null
    : typeof rawRunId === "string" && /^\d+$/.test(rawRunId)
      ? Number(rawRunId)
      : NaN;

  if (Number.isNaN(requestedRunId) || (requestedRunId !== null && (!Number.isSafeInteger(requestedRunId) || requestedRunId <= 0))) {
    res.status(400).json({ error: "runId must be a positive integer" });
    return;
  }

  try {
    const runResult = await pool.query<RunRow>(
      `SELECT id, status, started_at, completed_at, error_message, stage_counts, stage_errors
       FROM bot_runs
       WHERE ($1::bigint IS NULL OR id = $1::bigint)
       ORDER BY id DESC
       LIMIT 1`,
      [requestedRunId],
    );
    const run = runResult.rows[0];
    if (!run) {
      res.status(404).json({ error: "Bot run not found" });
      return;
    }

    const entityResult = await pool.query<DiagnosticEntityRow>(
      `WITH snapshots AS (
         SELECT DISTINCT ON (watchlist_id) watchlist_id, id, raw_fetch_ok, nav_or_price
         FROM comparison_snapshots
         WHERE run_id = $1
         ORDER BY watchlist_id, scraped_at DESC
       ), technical AS (
         SELECT DISTINCT ON (watchlist_id) watchlist_id, id, raw_fetch_ok, trend
         FROM technical_signals
         WHERE run_id = $1
         ORDER BY watchlist_id, created_at DESC
       ), verdicts AS (
         SELECT DISTINCT ON (watchlist_id) watchlist_id, id, raw_verdict
         FROM verdict_history
         WHERE run_id = $1
         ORDER BY watchlist_id, recorded_at DESC
       ), advisors AS (
         SELECT DISTINCT ON (watchlist_id) watchlist_id, id, generation_status, recommendation_text
         FROM advisor_recommendations
         WHERE run_id = $1
         ORDER BY watchlist_id, generated_at DESC
       )
      SELECT cw.id, cw.ticker, cw.name, cw.entity_type, cw.is_held, cw.yahoo_ticker,
         s.id AS snapshot_id, s.raw_fetch_ok AS snapshot_raw_fetch_ok, s.nav_or_price AS snapshot_value,
         t.id AS technical_id, t.raw_fetch_ok AS technical_raw_fetch_ok, t.trend AS technical_trend,
         v.id AS verdict_id, v.raw_verdict,
         a.id AS advisor_id, a.generation_status AS advisor_status, a.recommendation_text AS advisor_text
       FROM comparison_watchlist cw
       LEFT JOIN snapshots s ON s.watchlist_id = cw.id
       LEFT JOIN technical t ON t.watchlist_id = cw.id
       LEFT JOIN verdicts v ON v.watchlist_id = cw.id
       LEFT JOIN advisors a ON a.watchlist_id = cw.id
       WHERE cw.entity_type IN ('stock', 'fund', 'index')
         AND COALESCE(cw.funds_table_key, '') <> 'abr'
         AND cw.ticker <> 'ABR'
       ORDER BY cw.ticker`,
      [run.id],
    );

    const chartReaderMessages = Array.isArray(run.stage_errors?.chartReader) ? run.stage_errors.chartReader : [];
    const entities = entityResult.rows.map((entity) => diagnoseEntity(entity, chartReaderMessages));
    const counts = entities.reduce((result, entity) => {
      if (entity.state !== "complete") result[entity.state]++;
      result[entity.severity]++;
      return result;
    }, { complete: 0, partial: 0, missing: 0, dash: 0, expected_unavailable: 0, needs_review: 0 } as Record<DiagnosticState | "expected_unavailable" | "needs_review", number>);

    res.json({
      run: {
        id: Number(run.id),
        status: run.status,
        started_at: run.started_at,
        completed_at: run.completed_at,
        error_message: run.error_message,
        stage_counts: run.stage_counts ?? {},
        stage_errors: run.stage_errors ?? {},
      },
      summary: { entity_count: entities.length, ...counts },
      entities,
    });
  } catch (error) {
    console.error("[diagnostics] could not load bot diagnostics", error);
    res.status(500).json({ error: "Backend diagnostics are not available" });
  }
});

export default router;