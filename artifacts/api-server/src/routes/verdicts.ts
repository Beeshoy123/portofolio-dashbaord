import { Router } from "express";
import { judgeAllHoldings } from "../judge/comparisonJudge";
import { suggestDepositAllocation } from "../advisor/depositSuggestion";
import { pool } from "../lib/dbPool";

const router = Router();

// GET /api/rotation-verdicts — runs the comparison judge for all live held
// positions and returns the full verdict array. Read-only; does not trigger
// any scrape or write to the database.
router.get("/rotation-verdicts", async (req, res) => {
  const runId = typeof req.query.runId === "string" && /^\d+$/.test(req.query.runId)
    ? Number(req.query.runId)
    : null;

  if (!Number.isSafeInteger(runId) || runId <= 0) {
    res.status(400).json({ error: "runId is required" });
    return;
  }

  try {
    const includeAllEntities = req.query.all === "true";
    const verdicts = await judgeAllHoldings("return_1y", runId, includeAllEntities);
    res.json(verdicts);
  } catch (err: any) {
    console.error("[/api/rotation-verdicts]", err);
    res.status(500).json({ error: "Failed to compute rotation verdicts" });
  }
});

router.get("/portfolio-summary", async (req, res) => {
  const runId = typeof req.query.runId === "string" && /^\d+$/.test(req.query.runId)
    ? Number(req.query.runId)
    : null;
  if (!Number.isSafeInteger(runId) || runId <= 0) {
    res.status(400).json({ error: "runId is required" });
    return;
  }

  try {
    let query = `SELECT id, run_id, summary_text, strong_count, mixed_count, weak_count,
                        insufficient_data_count, flagged_count, avg_coverage_percent,
                        reversal_risk_count, divergence_count,
                        strong_value_percent, mixed_value_percent, weak_value_percent, insufficient_value_percent,
                        decision, confidence, evidence, risks, next_review_days,
                        model_used, generated_at
                 FROM portfolio_summaries`;
    const params: number[] = [];
    if (runId !== null && Number.isSafeInteger(runId) && runId > 0) {
      query += ` WHERE run_id = $1`;
      params.push(runId);
    } else {
      query += ` ORDER BY generated_at DESC LIMIT 1`;
    }

    const result = await pool.query<{
      id: number;
      run_id: number;
      summary_text: string;
      strong_count: number;
      mixed_count: number;
      weak_count: number;
      insufficient_data_count: number;
      flagged_count: number | null;
      avg_coverage_percent: number | string | null;
      reversal_risk_count: number | null;
      divergence_count: number | null;
      strong_value_percent: number | string | null;
      mixed_value_percent: number | string | null;
      weak_value_percent: number | string | null;
      insufficient_value_percent: number | string | null;
      decision: string | null;
      confidence: number | null;
      evidence: unknown | null;
      risks: unknown | null;
      next_review_days: number | null;
      model_used: string;
      generated_at: string;
    }>(query, params);
    if (result.rows.length === 0) {
      res.status(404).json({ error: "No portfolio summary found" });
      return;
    }
    const summary = result.rows[0];
    res.json({
      id: summary.id,
      run_id: summary.run_id,
      summary_text: summary.summary_text,
      strong_count: summary.strong_count,
      mixed_count: summary.mixed_count,
      weak_count: summary.weak_count,
      insufficient_data_count: summary.insufficient_data_count,
      flagged_count: summary.flagged_count !== null ? Number(summary.flagged_count) : 0,
      avg_coverage_percent: summary.avg_coverage_percent !== null ? Number(summary.avg_coverage_percent) : null,
      reversal_risk_count: summary.reversal_risk_count !== null ? Number(summary.reversal_risk_count) : 0,
      divergence_count: summary.divergence_count !== null ? Number(summary.divergence_count) : 0,
      strong_value_percent: summary.strong_value_percent !== null ? Number(summary.strong_value_percent) : null,
      mixed_value_percent: summary.mixed_value_percent !== null ? Number(summary.mixed_value_percent) : null,
      weak_value_percent: summary.weak_value_percent !== null ? Number(summary.weak_value_percent) : null,
      insufficient_value_percent: summary.insufficient_value_percent !== null ? Number(summary.insufficient_value_percent) : null,
      decision: summary.decision ?? null,
      confidence: summary.confidence !== null ? Number(summary.confidence) : null,
      evidence: Array.isArray(summary.evidence) ? summary.evidence : null,
      risks: Array.isArray(summary.risks) ? summary.risks : null,
      next_review_days: summary.next_review_days !== null ? Number(summary.next_review_days) : null,
      model_used: summary.model_used,
      generated_at: summary.generated_at,
    });
  } catch (error) {
    console.error("[/api/portfolio-summary]", error);
    res.status(500).json({ error: "Failed to fetch portfolio summary" });
  }
});

router.post("/deposit-suggestion", async (req, res) => {
  const { amount_egp, runId, emergencyFundTarget } = req.body;

  // Validate amount
  if (!Number.isFinite(amount_egp) || amount_egp <= 0) {
    res.status(400).json({ error: "amount_egp must be a positive number" });
    return;
  }

  const run = typeof runId === "number" && Number.isSafeInteger(runId) && runId > 0 ? runId : undefined;
  const target = typeof emergencyFundTarget === "number" && emergencyFundTarget > 0 ? emergencyFundTarget : undefined;

  try {
    const suggestion = await suggestDepositAllocation(amount_egp, run, target);
    res.json(suggestion);
  } catch (error) {
    console.error("[/api/deposit-suggestion]", error);
    res.status(500).json({ error: "Failed to generate deposit suggestion" });
  }
});

export default router;
