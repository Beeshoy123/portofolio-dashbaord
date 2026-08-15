// Alert System API Routes
// Exposes Time Stop, Thesis Check, and Drawdown as regulatory checks
// for Smart Advisor recommendations

import { Router, Request, Response } from "express";
import { checkAllTimeStops } from "../judge/timeStop";
import { checkAllTheses } from "../judge/thesisCheck";
import { computeDrawdown } from "../judge/drawdown";

const router = Router();

// GET /api/alerts/time-stops - Check for stagnant signals
router.get("/time-stops", async (_req: Request, res: Response) => {
  try {
    const timeStops = await checkAllTimeStops();
    res.json(timeStops);
  } catch (err: any) {
    console.error("[/api/alerts/time-stops]", err);
    res.status(500).json({ error: "Failed to compute time stops" });
  }
});

// GET /api/alerts/thesis-checks - Check for reversed signals
router.get("/thesis-checks", async (_req: Request, res: Response) => {
  try {
    const theses = await checkAllTheses();
    res.json(theses);
  } catch (err: any) {
    console.error("[/api/alerts/thesis-checks]", err);
    res.status(500).json({ error: "Failed to compute thesis checks" });
  }
});

// GET /api/alerts/drawdown - Check portfolio drawdown
router.get("/drawdown", async (_req: Request, res: Response) => {
  try {
    const drawdown = await computeDrawdown();
    res.json(drawdown);
  } catch (err: any) {
    console.error("[/api/alerts/drawdown]", err);
    res.status(500).json({ error: "Failed to compute drawdown" });
  }
});

// GET /api/alerts/all - Get all alerts for a specific ticker
router.get("/all/:ticker", async (req: Request, res: Response) => {
  try {
    const { ticker } = req.params;

    const allTimeStops = await checkAllTimeStops();
    const allTheses = await checkAllTheses();
    const drawdown = await computeDrawdown();

    const timeStop = allTimeStops.find((ts) => ts.ticker === ticker.toUpperCase());
    const thesis = allTheses.find((t) => t.ticker === ticker.toUpperCase());

    res.json({
      ticker: ticker.toUpperCase(),
      timeStop: timeStop || null,
      thesis: thesis || null,
      portfolio: {
        drawdown,
      },
    });
  } catch (err: any) {
    console.error(`[/api/alerts/all/:${req.params.ticker}]`, err);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// GET /api/alerts/summary - Full alert summary for Smart Advisor
router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const timeStops = await checkAllTimeStops();
    const theses = await checkAllTheses();
    const drawdown = await computeDrawdown();

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

    res.json({
      generatedAt: new Date().toISOString(),
      alerts: alertsByTicker,
      portfolio: {
        drawdown,
      },
    });
  } catch (err: any) {
    console.error("[/api/alerts/summary]", err);
    res.status(500).json({ error: "Failed to fetch alert summary" });
  }
});

export default router;
