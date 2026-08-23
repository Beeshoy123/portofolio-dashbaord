import { Router } from "express";
import { judgeAllHoldings } from "../judge/comparisonJudge";

const router = Router();

// GET /api/rotation-verdicts — runs the comparison judge for all live held
// positions and returns the full verdict array. Read-only; does not trigger
// any scrape or write to the database.
router.get("/rotation-verdicts", async (req, res) => {
  try {
    const runId = typeof req.query.runId === "string" && /^\d+$/.test(req.query.runId)
      ? Number(req.query.runId)
      : undefined;
    const includeAllEntities = req.query.all === "true";
    const verdicts = await judgeAllHoldings("return_1y", runId, includeAllEntities);
    res.json(verdicts);
  } catch (err: any) {
    console.error("[/api/rotation-verdicts]", err);
    res.status(500).json({ error: "Failed to compute rotation verdicts" });
  }
});

export default router;
