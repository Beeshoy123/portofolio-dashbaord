import { Router } from "express";
import { Pool } from "pg";

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

router.get("/technical-signals", async (req, res) => {
  const runId = typeof req.query.runId === "string" && /^\d+$/.test(req.query.runId)
    ? Number(req.query.runId)
    : null;
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (ts.watchlist_id)
         ts.watchlist_id, cw.ticker, cw.name, cw.entity_type,
         ts.candle_date, ts.trend, ts.patterns, ts.confidence, ts.raw_fetch_ok, ts.candles, ts.created_at
       FROM technical_signals ts
       JOIN comparison_watchlist cw ON cw.id = ts.watchlist_id
       WHERE ($1::bigint IS NULL OR ts.run_id = $1::bigint)
         AND cw.entity_type IN ('stock', 'fund')
         AND COALESCE(cw.funds_table_key, '') <> 'abr'
         AND cw.ticker <> 'ABR'
       ORDER BY ts.watchlist_id, ts.created_at DESC`,
      [runId],
    );
    res.json({ signals: result.rows });
  } catch (error) {
    console.error("[technical] could not load signals", error);
    res.status(500).json({ error: "Technical analysis is not available yet" });
  }
});

export default router;
