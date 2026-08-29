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
    const result = await pool.query(
      `SELECT id, run_id, summary_text, strong_count, mixed_count, weak_count,
              insufficient_data_count, model_used, generated_at
       FROM portfolio_summaries
       WHERE run_id = $1`,
      [runId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: "No portfolio summary found for this run" });
      return;
    }
    res.json(result.rows[0]);
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
