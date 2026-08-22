import { Router } from "express";
import { Pool } from "pg";

const router = Router();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Price Checker is owned by /api/ai-bot/run. Keeping a standalone start route
// would let callers bypass the Judge, Alert System, and Smart Advisor stages.
router.post("/scraper/run", async (req, res) => {
  res.status(410).json({
    error: "STANDALONE_SCRAPER_DEPRECATED",
    message: "Use POST /api/ai-bot/run to execute the complete AI Bot workflow.",
  });
});

// GET /api/scraper/snapshots — returns the latest snapshot per watchlist entity
router.get("/scraper/snapshots", async (req, res) => {
  try {
    const runId = typeof req.query.runId === "string" && /^\d+$/.test(req.query.runId)
      ? Number(req.query.runId)
      : null;
    const since = typeof req.query.since === "string" ? req.query.since : null;
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
          AND ($1::bigint IS NULL OR cs.run_id = $1::bigint)
          AND ($2::timestamptz IS NULL OR cs.scraped_at >= $2::timestamptz)
          AND ($2::timestamptz IS NOT NULL OR $1::bigint IS NOT NULL OR cs.raw_fetch_ok = true)
        ORDER BY cs.scraped_at DESC
        LIMIT 1
      ) s ON true
      ORDER BY w.entity_type, w.sector, w.ticker
    `, [runId, since]);
    const lastRunAt = result.rows.reduce<string | null>((latest, row) => {
      if (!row.scraped_at) return latest;
      return latest === null || new Date(row.scraped_at) > new Date(latest) ? row.scraped_at : latest;
    }, null);
    res.json({ snapshots: result.rows, lastRunAt });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "DB query failed" });
  }
});

export default router;
