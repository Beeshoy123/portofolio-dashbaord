// Alert System API Routes
// Exposes Time Stop, Thesis Check, and Drawdown as regulatory checks
// for Smart Advisor recommendations

import { Router, Request, Response } from "express";
import { checkAllTimeStops } from "../judge/timeStop";
import { checkAllTheses } from "../judge/thesisCheck";
import { computeDrawdown } from "../judge/drawdownDb";

const router = Router();

// GET /api/alerts/time-stops - Check for stagnant signals
router.get("/time-stops", async (req: Request, res: Response) => {
  try {
    const runId = parseRunId(req.query.runId);
    if (runId === null) return res.status(400).json({ error: "runId is required" });
    const timeStops = await checkAllTimeStops(runId);
    return res.json(timeStops);
  } catch (err: any) {
    console.error("[/api/alerts/time-stops]", err);
    return res.status(500).json({ error: "Failed to compute time stops" });
  }
});

// GET /api/alerts/thesis-checks - Check for reversed signals
router.get("/thesis-checks", async (req: Request, res: Response) => {
  try {
    const runId = parseRunId(req.query.runId);
    if (runId === null) return res.status(400).json({ error: "runId is required" });
    const theses = await checkAllTheses(runId);
    return res.json(theses);
  } catch (err: any) {
    console.error("[/api/alerts/thesis-checks]", err);
    return res.status(500).json({ error: "Failed to compute thesis checks" });
  }
});

// GET /api/alerts/drawdown - Check portfolio drawdown
router.get("/drawdown", async (req: Request, res: Response) => {
  try {
    const runId = parseRunId(req.query.runId);
    if (runId === null) return res.status(400).json({ error: "runId is required" });
    const drawdown = await computeDrawdown(runId);
    return res.json(drawdown);
  } catch (err: any) {
    console.error("[/api/alerts/drawdown]", err);
    return res.status(500).json({ error: "Failed to compute drawdown" });
  }
});

// GET /api/alerts/all - Get all alerts for a specific ticker
router.get("/all/:ticker", async (req: Request, res: Response) => {
  try {
    const ticker = String(req.params.ticker);
    const runId = parseRunId(req.query.runId);
    if (runId === null) return res.status(400).json({ error: "runId is required" });

    const allTimeStops = await checkAllTimeStops(runId);
    const allTheses = await checkAllTheses(runId);
    const drawdown = await computeDrawdown(runId);

    const timeStop = allTimeStops.find((ts) => ts.ticker === ticker.toUpperCase());
    const thesis = allTheses.find((t) => t.ticker === ticker.toUpperCase());

    return res.json({
      ticker: ticker.toUpperCase(),
      timeStop: timeStop || null,
      thesis: thesis || null,
      portfolio: {
        drawdown,
      },
    });
  } catch (err: any) {
    console.error(`[/api/alerts/all/:${req.params.ticker}]`, err);
    return res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// GET /api/alerts/summary - Full alert summary for Smart Advisor
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const runId = parseRunId(req.query.runId);
    if (runId === null) return res.status(400).json({ error: "runId is required" });
    const timeStops = await checkAllTimeStops(runId);
    const theses = await checkAllTheses(runId);
    const drawdown = await computeDrawdown(runId);

    // Build alert summary keyed by ticker
    const alertsByTicker: Record<string, any> = {};

    timeStops.forEach((ts) => {
      if (!alertsByTicker[ts.ticker]) alertsByTicker[ts.ticker] = {};
      alertsByTicker[ts.ticker].timeStop = ts;
    });

    theses.forEach((t) => {
      if (!alertsByTicker[t.ticker]) alertsByTicker[t.ticker] = {};
      alertsByTicker[t.ticker].thesis = t;
    });

    return res.json({
      generatedAt: new Date().toISOString(),
      alerts: alertsByTicker,
      portfolio: {
        drawdown,
      },
    });
  } catch (err: any) {
    console.error("[/api/alerts/summary]", err);
    return res.status(500).json({ error: "Failed to fetch alert summary" });
  }
});

export default router;

function parseRunId(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const runId = Number(value);
  return Number.isSafeInteger(runId) && runId > 0 ? runId : null;
}
