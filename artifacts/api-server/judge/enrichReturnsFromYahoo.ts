// Comparison Judge — Yahoo Finance Return Enrichment
//
// Fetches historical daily closing prices from Yahoo Finance for every
// stock/index in comparison_watchlist that has a yahoo_ticker mapped
// (from 005_yahoo_ticker_mapping.sql), computes 30-day, YTD, and 1-year
// returns from those closes, and writes them into the MOST RECENT
// comparison_snapshots row for that entity — the same row the FoudaLens
// scraper already inserted with NAV/price and Score. This does NOT create
// a new row; it fills in the return columns FoudaLens leaves null for
// stocks/indices.
//
// Run this AFTER the FoudaLens scraper (runScraper.ts) has run at least
// once, so there's a snapshot row to update.
//
// Requires: npm install yahoo-finance2 (already in this project's stack)
// Usage: npx tsx judge/enrichReturnsFromYahoo.ts

import yahooFinance from "yahoo-finance2";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface Bar {
  date: Date;
  close: number;
}

/** Finds the closing price on or before a target date — the nearest trading day at/before it. */
function closestClose(bars: Bar[], target: Date): number | null {
  let best: Bar | null = null;
  for (const bar of bars) {
    if (bar.date <= target && (!best || bar.date > best.date)) best = bar;
  }
  return best?.close ?? null;
}

async function main() {
  const { rows } = await pool.query(
    `SELECT id, ticker, yahoo_ticker FROM comparison_watchlist
     WHERE entity_type IN ('stock','index') AND yahoo_ticker IS NOT NULL
     ORDER BY ticker`
  );

  console.log(`Found ${rows.length} entities with a mapped yahoo_ticker.`);

  let successCount = 0;
  let failCount = 0;

  for (const row of rows) {
    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const chart = await yahooFinance.chart(row.yahoo_ticker, {
        period1: oneYearAgo,
        interval: "1d",
      });

      const bars: Bar[] = chart.quotes
        .filter((q) => q.close !== null && q.close !== undefined)
        .map((q) => ({ date: new Date(q.date), close: q.close as number }));

      if (bars.length < 20) {
        console.warn(
          `[${row.ticker}] (${row.yahoo_ticker}) only ${bars.length} bars returned — likely bad ticker or delisted, skipping`
        );
        failCount++;
        continue;
      }

      const latest = bars[bars.length - 1];
      const now = latest.date;

      const d30 = new Date(now);
      d30.setDate(d30.getDate() - 30);
      const dYtd = new Date(now.getFullYear(), 0, 1);
      const d1y = new Date(now);
      d1y.setFullYear(d1y.getFullYear() - 1);

      const p30 = closestClose(bars, d30);
      const pYtd = closestClose(bars, dYtd);
      const p1y = closestClose(bars, d1y);

      const return30d = p30 !== null ? (latest.close / p30 - 1) * 100 : null;
      const returnYtd = pYtd !== null ? (latest.close / pYtd - 1) * 100 : null;
      const return1y = p1y !== null ? (latest.close / p1y - 1) * 100 : null;

      // Updates the MOST RECENT snapshot row for this entity (already
      // inserted by the FoudaLens scraper) rather than inserting a new,
      // duplicate row — keeps exactly one row per entity per scrape run.
      const result = await pool.query(
        `UPDATE comparison_snapshots
         SET return_30d_percent = $1, return_ytd_percent = $2, return_1y_percent = $3
         WHERE id = (
           SELECT id FROM comparison_snapshots
           WHERE watchlist_id = $4 ORDER BY scraped_at DESC LIMIT 1
         )`,
        [return30d, returnYtd, return1y, row.id]
      );

      if (result.rowCount === 0) {
        console.warn(
          `[${row.ticker}] no comparison_snapshots row found to update — run the FoudaLens scraper first`
        );
        failCount++;
        continue;
      }

      console.log(
        `[${row.ticker}] 30d=${return30d?.toFixed(1)}% ytd=${returnYtd?.toFixed(1)}% 1y=${return1y?.toFixed(1)}% (updated ${result.rowCount} row)`
      );
      successCount++;
    } catch (err) {
      console.error(`[${row.ticker}] (${row.yahoo_ticker}) failed —`, err);
      failCount++;
    }

    // Small delay between requests so this doesn't look like abuse to Yahoo.
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\nDone. ${successCount} succeeded, ${failCount} failed out of ${rows.length}.`);
  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error in enrichReturnsFromYahoo:", err);
  process.exit(1);
});
