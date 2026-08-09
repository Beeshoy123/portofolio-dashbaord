import { Router } from "express";
import { Pool } from "pg";
import { runScraper } from "../scraper/runScraper";

const router = Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Track whether a scraper run is already in progress so we don't
// run two at once if the button is tapped twice.
let scraperRunning = false;
let lastRunAt: string | null = null;
let lastRunSummary: string | null = null;

// POST /api/scraper/run — starts the scraper in the background.
// The scraper can take longer than the preview proxy request timeout, so
// callers must poll GET /api/scraper/status for completion.
router.post("/scraper/run", async (req, res) => {
  if (scraperRunning) {
    res.status(409).json({ error: "Scraper already running. Please wait." });
    return;
  }

  scraperRunning = true;
  lastRunSummary = "RUNNING";

  void runScraper()
    .then(() => {
      lastRunAt = new Date().toISOString();
      lastRunSummary = "OK";
    })
    .catch((err: any) => {
      lastRunSummary = err?.message ?? "Unknown error";
      console.error("[/api/scraper/run]", err);
    })
    .finally(() => {
      scraperRunning = false;
    });

  res.status(202).json({ ok: true, running: true });
});

// GET /api/scraper/status — returns whether a run is in progress + last result
router.get("/scraper/status", (_req, res) => {
  res.json({ running: scraperRunning, lastRunAt, lastRunSummary });
});

// GET /api/scraper/snapshots — returns the latest snapshot per watchlist entity
router.get("/scraper/snapshots", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        w.id,
        w.ticker,
        w.name,
        w.entity_type,
        w.sector,
        w.manager,
        w.is_held,
        s.scraped_at,
        s.nav_or_price,
        s.return_30d_percent,
        s.return_ytd_percent,
        s.return_1y_percent,
        s.cagr_percent,
        s.total_score,
        s.risk_level,
        s.signal,
        s.pe_ratio,
        s.dividend_yield_percent,
        s.market_cap,
        s.sector_rank,
        s.raw_fetch_ok
      FROM comparison_watchlist w
      LEFT JOIN LATERAL (
        SELECT * FROM comparison_snapshots cs
        WHERE cs.watchlist_id = w.id
        ORDER BY cs.scraped_at DESC
        LIMIT 1
      ) s ON true
      ORDER BY w.entity_type, w.sector, w.ticker
    `);
    res.json({ snapshots: result.rows, lastRunAt });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "DB query failed" });
  }
});

export default router;
