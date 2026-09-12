import { Router } from "express";
import { pool } from "../lib/dbPool";

const router = Router();

// Price Checker is owned by /api/ai-bot/run. Keeping a standalone start route
// would let callers bypass the Judge, Alert System, and Smart Advisor stages.
router.post("/scraper/run", async (req, res) => {
  res.status(410).json({
    error: "STANDALONE_SCRAPER_DEPRECATED",
    message: "Use POST /api/ai-bot/run to execute the complete AI Bot workflow.",
  });
});

router.patch("/watchlist/:ticker/portfolio-bucket", async (req, res) => {
  const allowedBuckets = new Set(["safety", "steady_growth", "broad_market", "individual_stocks"]);
  const rawBucket = req.body?.portfolio_bucket;

  if (rawBucket !== null && rawBucket !== undefined && (typeof rawBucket !== "string" || !allowedBuckets.has(rawBucket))) {
    return res.status(400).json({ error: "portfolio_bucket must be one of safety, steady_growth, broad_market, individual_stocks, or null" });
  }

  const normalizedBucket = rawBucket === null || rawBucket === undefined || rawBucket === "" ? null : rawBucket;
  const ticker = String(req.params.ticker ?? "").trim();

  if (!ticker) {
    return res.status(400).json({ error: "ticker is required" });
  }

  try {
    const result = await pool.query(
      `UPDATE comparison_watchlist
         SET portfolio_bucket = $1
       WHERE ticker = $2
       RETURNING id, ticker, portfolio_bucket`,
      [normalizedBucket, ticker],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: `Ticker not found: ${ticker}` });
    }

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error("[/watchlist/:ticker/portfolio-bucket] failed", error);
    return res.status(500).json({ error: error?.message ?? "Failed to update portfolio bucket" });
  }
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
        w.portfolio_bucket,
        s.scraped_at,
        s.nav_or_price,
        s.return_30d_percent,
        s.return_60d_percent,
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
        s.raw_fetch_ok,
        f.pe_ratio,
        f.forward_pe,
        f.roe_percent,
        f.debt_to_equity,
        f.current_ratio,
        f.revenue_growth_percent,
        f.dividend_yield_percent,
        f.beta,
        f.raw_fetch_ok AS fundamentals_raw_fetch_ok
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
      LEFT JOIN LATERAL (
           SELECT pe_ratio, forward_pe, roe_percent, debt_to_equity,
             current_ratio, revenue_growth_percent, dividend_yield_percent, beta,
             sf.raw_fetch_ok
        FROM stock_fundamentals sf
         WHERE sf.watchlist_id = w.id
          AND sf.fetched_at >= now() - interval '30 days'
          AND ($1::bigint IS NULL OR sf.run_id = $1::bigint)
        ORDER BY sf.fetched_at DESC
        LIMIT 1
      ) f ON true
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
