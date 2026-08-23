// Comparison Judge — Scraper Orchestrator
//
// Fundamentals come from stockanalysis.com and are stored alongside the
// FoudaLens comparison snapshots for the downstream judge and advisor.
//
// Run this on a schedule (weekly, per the original design decision). It:
//   1. Reads the fixed watchlist from comparison_watchlist
//   2. Calls the right parser per entity_type (funds/stocks/indices from
//      FoudaLens, exactly as before — unchanged)
//   3. Inserts one row per entity into comparison_snapshots
//   4. NEW: fetches fundamentals for every stock from stockanalysis.com
//      and inserts into the new stock_fundamentals table
//
// Usage: `npx tsx scraper/runScraper.ts` (or wire into a Replit
// scheduled deployment / cron trigger)
//
// Requires: npm install cheerio playwright pg
// (playwright: run `npx playwright install chromium` once after install)
// Run migrations/007_stockanalysis_fundamentals.sql once before first use.

import { pool } from "../lib/dbPool";
import { emptySnapshot, parseFundPage } from "./parseFund";
import { parseStockPage } from "./parseStock";
import { parseIndexPage } from "./parseIndex";
import type { WatchlistEntity, ScrapedSnapshot } from "./types";
import { parseStockAnalysis, type StockFundamentals } from "./parseStockAnalysis";

async function getWatchlist(): Promise<WatchlistEntity[]> {
  const result = await pool.query<WatchlistEntity>(
    `SELECT id, ticker, name, entity_type, source_code, sector, manager, is_held, yahoo_ticker
     FROM comparison_watchlist
     ORDER BY entity_type, ticker`
  );
  return result.rows;
}

async function saveSnapshot(snapshot: ScrapedSnapshot, runId: number): Promise<void> {
  await pool.query(
    `INSERT INTO comparison_snapshots
      (watchlist_id, nav_or_price, return_30d_percent, return_ytd_percent,
      return_60d_percent, return_1y_percent, cagr_percent, total_score, risk_level,
       signal, pe_ratio, dividend_yield_percent, market_cap, sector_rank,
       raw_fetch_ok, run_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      snapshot.watchlist_id,
      snapshot.nav_or_price,
      snapshot.return_30d_percent,
      snapshot.return_ytd_percent,
      snapshot.return_60d_percent,
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
      runId,
    ]
  );
}

async function syncFundNav(ticker: string, snapshot: ScrapedSnapshot): Promise<void> {
  if (!snapshot.raw_fetch_ok || snapshot.nav_or_price === null) return;
  const nav = Number(snapshot.nav_or_price);
  if (!Number.isFinite(nav) || nav <= 0) return;

  await pool.query(
    `UPDATE funds SET nav = $1
     WHERE lower(ticker) = lower($2) AND units_held > 0`,
    [nav, ticker],
  );
}

async function saveFundamentals(f: StockFundamentals, runId: number): Promise<void> {
  await pool.query(
    `INSERT INTO stock_fundamentals
      (watchlist_id, price, price_change_percent, market_cap, revenue_ttm,
       revenue_growth_percent, net_income, net_income_growth_percent, eps,
       eps_growth_percent, shares_out, pe_ratio, forward_pe,
       dividend_yield_percent, dividend_per_share, ex_dividend_date, volume,
       week52_low, week52_high, beta, analyst_rating, price_target,
       price_target_upside_percent, earnings_date, debt_to_equity,
       current_ratio, roe_percent, roic_percent, cash_on_hand, total_debt,
       net_cash_position, operating_cash_flow, capex, free_cash_flow,
       gross_margin_percent, operating_margin_percent, net_margin_percent,
       ev_to_ebitda, ev_to_fcf, shares_change_percent, raw_fetch_ok, run_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
       $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,
      $36,$37,$38,$39,$40,$41,$42)`,
    [
      f.watchlist_id,
      f.price,
      f.price_change_percent,
      f.market_cap,
      f.revenue_ttm,
      f.revenue_growth_percent,
      f.net_income,
      f.net_income_growth_percent,
      f.eps,
      f.eps_growth_percent,
      f.shares_out,
      f.pe_ratio,
      f.forward_pe,
      f.dividend_yield_percent,
      f.dividend_per_share,
      f.ex_dividend_date,
      f.volume,
      f.week52_low,
      f.week52_high,
      f.beta,
      f.analyst_rating,
      f.price_target,
      f.price_target_upside_percent,
      f.earnings_date,
      f.debt_to_equity,
      f.current_ratio,
      f.roe_percent,
      f.roic_percent,
      f.cash_on_hand,
      f.total_debt,
      f.net_cash_position,
      f.operating_cash_flow,
      f.capex,
      f.free_cash_flow,
      f.gross_margin_percent,
      f.operating_margin_percent,
      f.net_margin_percent,
      f.ev_to_ebitda,
      f.ev_to_fcf,
      f.shares_change_percent,
      f.raw_fetch_ok,
      runId,
    ]
  );
}

/** Small delay between requests so this doesn't look like abuse to FoudaLens. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];
        await worker(item);
      }
    },
  );
  await Promise.all(workers);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: () => T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback()), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { main as runScraper };

export async function main(existingRunId?: number): Promise<{ runId: number; succeeded: number; failed: number; total: number }> {
  const runId = existingRunId ?? Number((await pool.query<{ id: number }>(
    `INSERT INTO bot_runs (status) VALUES ('running') RETURNING id`,
  )).rows[0].id);
  const watchlist = await getWatchlist();
  console.log(`Loaded ${watchlist.length} entities from comparison_watchlist`);

  const funds = watchlist.filter((e) => e.entity_type === "fund");
  const stocks = watchlist.filter((e) => e.entity_type === "stock");
  const indices = watchlist.filter((e) => e.entity_type === "index");
  const stockAnalysisByTicker = new Map<string, StockFundamentals>();

  let successCount = 0;
  let failCount = 0;

  // --- Funds: bounded concurrency preserves detail without rate spikes ---
  await runWithConcurrency(funds, 3, async (fund) => {
    if (!fund.source_code) {
      console.error(`[main] Fund ${fund.ticker} has no source_code — skipping. Fix the seed data.`);
      failCount++;
      return;
    }
    try {
      const snapshot = await withTimeout(
        parseFundPage(fund.source_code, fund.id),
        45_000,
        () => emptySnapshot(fund.id),
      );
      await saveSnapshot(snapshot, runId);
      await syncFundNav(fund.ticker, snapshot);
      snapshot.raw_fetch_ok ? successCount++ : failCount++;
      console.log(
        `[fund] ${fund.ticker}: ${snapshot.raw_fetch_ok ? "OK" : "FAILED"} — NAV ${snapshot.nav_or_price}`
      );
    } catch (error) {
      failCount++;
      console.error(`[fund] ${fund.ticker}: isolated failure —`, error);
      try {
        await saveSnapshot(emptySnapshot(fund.id), runId);
      } catch (saveError) {
        console.error(`[fund] ${fund.ticker}: could not save failure snapshot —`, saveError);
      }
    } finally {
      await sleep(1500); // be polite between requests
    }
  });

  // --- Stocks: bounded concurrency; fundamentals and price use same sequence per stock ---
  await runWithConcurrency(stocks, 2, async (stock) => {
    try {
      const fundamentals = await parseStockAnalysis(stock.ticker, stock.id);
      stockAnalysisByTicker.set(stock.ticker, fundamentals);
      await saveFundamentals(fundamentals, runId);
      const snapshot = {
        ...(await parseStockPage(stock.ticker, stock.id)),
        nav_or_price: fundamentals.price,
        return_30d_percent: fundamentals.return_30d_percent,
        return_ytd_percent: fundamentals.return_ytd_percent,
        return_1y_percent: fundamentals.return_1y_percent,
      };
      await saveSnapshot(snapshot, runId);
      snapshot.raw_fetch_ok ? successCount++ : failCount++;
      console.log(
        `[stock] ${stock.ticker}: ${snapshot.raw_fetch_ok ? "OK" : "FAILED"} — price ${snapshot.nav_or_price}`
      );
    } catch (error) {
      failCount++;
      console.error(`[stock] ${stock.ticker}: isolated failure —`, error);
    } finally {
      await sleep(2000);
    }
  });

  // --- Indices: unchanged ---
  if (indices.length > 0) {
    const targets = indices.map((idx) => ({
      watchlistId: idx.id,
      label: idx.name.replace(" Index", ""),
      analysisSlug: idx.ticker === "EGX30" ? "CASE30" : idx.ticker === "EGX70" ? "EGX70_EWI" : idx.ticker === "EGX100" ? "EGX100_EWI" : undefined,
    }));
    const snapshots = await parseIndexPage(targets);
    for (const snapshot of snapshots) {
      try {
        await saveSnapshot(snapshot, runId);
        snapshot.raw_fetch_ok ? successCount++ : failCount++;
      } catch (error) {
        failCount++;
        console.error(`[index] ${snapshot.watchlist_id}: isolated save failure —`, error);
      }
    }
    console.log(`[index] fetched ${snapshots.length} indices from shared page`);
  }

  console.log(`\nSnapshots done. ${successCount} succeeded, ${failCount} failed out of ${watchlist.length}.`);

  // --- NEW: stock fundamentals from stockanalysis.com ---
  // Uses two requests per stock (Overview + Statistics), not
  // per data point — so ~35 stocks = ~70 requests total.
  let fundamentalsOk = 0;
  let fundamentalsFailed = 0;

  if (stocks.length > 0) {
    console.log(`\nFetching fundamentals for ${stocks.length} stocks from stockanalysis.com...`);
    for (const stock of stocks) {
      const fundamentals = stockAnalysisByTicker.get(stock.ticker);
      if (!fundamentals) continue;
      fundamentals.raw_fetch_ok ? fundamentalsOk++ : fundamentalsFailed++;
      console.log(
        `[fundamentals] ${stock.ticker}: ${fundamentals.raw_fetch_ok ? "OK" : "FAILED"} — ` +
          `P/E ${fundamentals.pe_ratio}, price ${fundamentals.price}`
      );
      await sleep(1500); // polite delay between stocks (2 requests each, already spaced internally)
    }
    console.log(
      `Fundamentals done. ${fundamentalsOk} succeeded, ${fundamentalsFailed} failed out of ${stocks.length}.`
    );
    if (fundamentalsFailed > 0) {
      console.log(
        `Some fundamentals fetches failed or came back partial — check the [parseStockAnalysis] logs above. ` +
          `This is expected on the first run until extractLabeled() patterns are confirmed against real page text.`
      );
    }

  }

  // Pool intentionally stays open — see the original bug-fix comment this
  // file carried before: closing it here breaks every subsequent call in
  // the long-running API server. Close it once in your server's own
  // SIGTERM/SIGINT handler if you want a clean shutdown.
  return { runId, succeeded: successCount, failed: failCount, total: watchlist.length };
}

// BUG FIX: removed the auto-invoking `main().catch(...)` block that used to
// sit here. As top-level code, it ran automatically the moment this module
// was imported (e.g. when the API server's scraper route loaded this file
// on startup) — an unrequested scraper run that then closed the pool via
// the code above, which is very likely what produced your first "17/36
// succeeded" result before you'd ever clicked the button. If you still want
// a standalone CLI entry point for local testing (`npx tsx
// scraper/runScraper.ts`), put it in a separate small file that imports
// `main` from here and calls `main().then(() => pool.end())` itself —
// don't leave it in the copy that api-server imports.
