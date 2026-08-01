// Comparison Judge — Scraper Orchestrator
//
// Run this on a schedule (weekly, per the design decision earlier in this
// project). It:
//   1. Reads the fixed watchlist from comparison_watchlist
//   2. Calls the right parser per entity_type
//   3. Inserts one row per entity into comparison_snapshots
//
// Usage: `npx tsx scraper/runScraper.ts` (or wire into a Replit
// scheduled deployment / cron trigger)
//
// Requires: npm install cheerio playwright pg
// (playwright: run `npx playwright install chromium` once after install)

import { Pool } from "pg";
import { parseFundPage } from "./parseFund";
import { parseStockPage } from "./parseStock";
import { parseIndexPage } from "./parseIndex";
import type { WatchlistEntity, ScrapedSnapshot } from "./types";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Replit sets this automatically
});

async function getWatchlist(): Promise<WatchlistEntity[]> {
  const result = await pool.query<WatchlistEntity>(
    `SELECT id, ticker, name, entity_type, source_code, sector, manager, is_held
     FROM comparison_watchlist
     ORDER BY entity_type, ticker`
  );
  return result.rows;
}

async function saveSnapshot(snapshot: ScrapedSnapshot): Promise<void> {
  await pool.query(
    `INSERT INTO comparison_snapshots
      (watchlist_id, nav_or_price, return_30d_percent, return_ytd_percent,
       return_1y_percent, cagr_percent, total_score, risk_level,
       signal, pe_ratio, dividend_yield_percent, market_cap, sector_rank,
       raw_fetch_ok)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      snapshot.watchlist_id,
      snapshot.nav_or_price,
      snapshot.return_30d_percent,
      snapshot.return_ytd_percent,
      snapshot.return_1y_percent,
      snapshot.cagr_percent,
      snapshot.total_score,
      snapshot.risk_level,
      snapshot.signal,
      snapshot.pe_ratio,
      snapshot.dividend_yield_percent,
      snapshot.market_cap,
      snapshot.sector_rank,
      snapshot.raw_fetch_ok,
    ]
  );
}

/** Small delay between requests so this doesn't look like abuse to FoudaLens. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const watchlist = await getWatchlist();
  console.log(`Loaded ${watchlist.length} entities from comparison_watchlist`);

  const funds = watchlist.filter((e) => e.entity_type === "fund");
  const stocks = watchlist.filter((e) => e.entity_type === "stock");
  const indices = watchlist.filter((e) => e.entity_type === "index");

  let successCount = 0;
  let failCount = 0;

  // --- Funds: one request each, confirmed working pattern ---
  for (const fund of funds) {
    if (!fund.source_code) {
      console.error(`[main] Fund ${fund.ticker} has no source_code — skipping. Fix the seed data.`);
      failCount++;
      continue;
    }
    const snapshot = await parseFundPage(fund.source_code, fund.id);
    await saveSnapshot(snapshot);
    snapshot.raw_fetch_ok ? successCount++ : failCount++;
    console.log(
      `[fund] ${fund.ticker}: ${snapshot.raw_fetch_ok ? "OK" : "FAILED"} — NAV ${snapshot.nav_or_price}`
    );
    await sleep(1500); // be polite between requests
  }

  // --- Stocks: one request each, unverified pattern, may be slow (browser fallback) ---
  for (const stock of stocks) {
    const snapshot = await parseStockPage(stock.ticker, stock.id);
    await saveSnapshot(snapshot);
    snapshot.raw_fetch_ok ? successCount++ : failCount++;
    console.log(
      `[stock] ${stock.ticker}: ${snapshot.raw_fetch_ok ? "OK" : "FAILED"} — price ${snapshot.nav_or_price}`
    );
    await sleep(2000);
  }

  // --- Indices: ONE request total for all 3 ---
  if (indices.length > 0) {
    const targets = indices.map((idx) => ({
      watchlistId: idx.id,
      label: idx.name.replace(" Index", ""), // "EGX30 Index" -> "EGX30"
    }));
    const snapshots = await parseIndexPage(targets);
    for (const snapshot of snapshots) {
      await saveSnapshot(snapshot);
      snapshot.raw_fetch_ok ? successCount++ : failCount++;
    }
    console.log(`[index] fetched ${snapshots.length} indices from shared page`);
  }

  console.log(`\nDone. ${successCount} succeeded, ${failCount} failed out of ${watchlist.length}.`);
  if (failCount > 0) {
    console.log(
      `Some entities failed — check logs above for which ones. This is expected on first run, especially for stock pages (see parseStock.ts comments) — inspect and adjust selectors before relying on this data.`
    );
  }

  await pool.end();
}

main().catch((err) => {
  console.error("Scraper run failed:", err);
  process.exit(1);
});
