// Comparison Judge — Fundamentals Checks
//
// NEW module, additive to comparisonJudge.ts — does not modify the
// existing return-based win/lose math, risk tier computation, or
// second-opinion checks. Call attachFundamentalsFlags() from
// judgeHolding() (see integration notes / Replit prompt) after groups are
// built, to annotate entries that are beating the holding with genuine
// fundamentals-based concerns.
//
// Design principle carried over from the existing second-opinion checks:
// deliberately conservative, rule-based, ZERO GUESSWORK — every flag here
// is a plain threshold check on a real number from stock_fundamentals,
// not an inferred judgment. Thresholds below are reasonable starting
// points (commonly cited rule-of-thumb ranges), NOT verified against real
// portfolio outcomes — same caveat computeRiskTier() and the win-ratio
// thresholds already carry elsewhere in this file. Adjust once you see
// this against real data, same as those.

import { Pool } from "pg";
import type { FundamentalsFlag, FundamentalsSnapshot } from "./fundamentalsTypes";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface FundamentalsRow {
  watchlist_id: number;
  pe_ratio: number | null;
  forward_pe: number | null;
  debt_to_equity: number | null;
  current_ratio: number | null;
  roe_percent: number | null;
  free_cash_flow: number | null;
  net_income: number | null;
  net_income_growth_percent: number | null;
  revenue_growth_percent: number | null;
  dividend_yield_percent: number | null;
  beta: number | null;
  analyst_rating: string | null;
  price_target_upside_percent: number | null;
  shares_change_percent: number | null;
}

/** Pulls the latest stock_fundamentals row per watchlist entity. */
export async function getLatestFundamentals(): Promise<Map<number, FundamentalsRow>> {
  const result = await pool.query<FundamentalsRow>(
    `SELECT DISTINCT ON (watchlist_id)
        watchlist_id, pe_ratio, forward_pe, debt_to_equity, current_ratio,
        roe_percent, free_cash_flow, net_income, net_income_growth_percent,
        revenue_growth_percent, dividend_yield_percent, beta,
        analyst_rating, price_target_upside_percent, shares_change_percent
     FROM stock_fundamentals
     WHERE raw_fetch_ok = true
     ORDER BY watchlist_id, fetched_at DESC`
  );
  const map = new Map<number, FundamentalsRow>();
  for (const row of result.rows) {
    // node-postgres returns numeric columns as strings — coerce here,
    // same pattern getLatestSnapshots() already uses in comparisonJudge.ts.
    map.set(row.watchlist_id, {
      ...row,
      pe_ratio: row.pe_ratio !== null ? Number(row.pe_ratio) : null,
      forward_pe: row.forward_pe !== null ? Number(row.forward_pe) : null,
      debt_to_equity: row.debt_to_equity !== null ? Number(row.debt_to_equity) : null,
      current_ratio: row.current_ratio !== null ? Number(row.current_ratio) : null,
      roe_percent: row.roe_percent !== null ? Number(row.roe_percent) : null,
      free_cash_flow: row.free_cash_flow !== null ? Number(row.free_cash_flow) : null,
      net_income: row.net_income !== null ? Number(row.net_income) : null,
      net_income_growth_percent:
        row.net_income_growth_percent !== null ? Number(row.net_income_growth_percent) : null,
      revenue_growth_percent:
        row.revenue_growth_percent !== null ? Number(row.revenue_growth_percent) : null,
      dividend_yield_percent:
        row.dividend_yield_percent !== null ? Number(row.dividend_yield_percent) : null,
      beta: row.beta !== null ? Number(row.beta) : null,
      price_target_upside_percent:
        row.price_target_upside_percent !== null ? Number(row.price_target_upside_percent) : null,
      shares_change_percent:
        row.shares_change_percent !== null ? Number(row.shares_change_percent) : null,
    });
  }
  return map;
}

/**
 * Threshold constants — see module header caveat. Named so they're easy
 * to find and adjust in one place once you have real outcomes to check
 * against, same spirit as the risk-tier thresholds in comparisonJudge.ts.
 */
const FUNDAMENTALS_FLAG_THRESHOLDS = {
  HIGH_DEBT_TO_EQUITY: 1.5, // commonly cited caution line; sector-dependent (banks run structurally higher — see note below)
  LOW_CURRENT_RATIO: 1.0, // below 1.0 means current liabilities exceed current assets
  HIGH_PE: 30, // above this, growth expectations are doing a lot of the work
  DILUTION_THRESHOLD_PERCENT: 10, // shares outstanding grew >10% YoY
};

/**
 * Builds the fundamentals flags for one entity. Deliberately narrow: only
 * flags a small set of commonly-recognized red flags, each independently
 * checkable against a single number — not a composite score or model.
 *
 * NOTE on debt_to_equity: banks and financial institutions structurally
 * run much higher D/E than industrial/consumer companies (deposits count
 * as liabilities) — the flat 1.5 threshold below will over-flag banks
 * (e.g. COMI, QNBE, ADIB, HDBK in your watchlist). Sector-aware
 * thresholds are a reasonable next improvement once you've seen this
 * against real data — flagged here rather than silently baked in wrong.
 */
export function buildFundamentalsFlags(
  f: FundamentalsRow | undefined,
  sector: string
): FundamentalsFlag[] {
  if (!f) return [];
  const flags: FundamentalsFlag[] = [];
  const isBankLikeSector = /bank|financ/i.test(sector);

  if (
    f.debt_to_equity !== null &&
    f.debt_to_equity > FUNDAMENTALS_FLAG_THRESHOLDS.HIGH_DEBT_TO_EQUITY &&
    !isBankLikeSector
  ) {
    flags.push({
      flag: "high_debt_load",
      detail: `Debt/Equity ${f.debt_to_equity.toFixed(2)} (above ${FUNDAMENTALS_FLAG_THRESHOLDS.HIGH_DEBT_TO_EQUITY} caution line)`,
    });
  }

  if (
    f.current_ratio !== null &&
    f.current_ratio < FUNDAMENTALS_FLAG_THRESHOLDS.LOW_CURRENT_RATIO
  ) {
    flags.push({
      flag: "weak_short_term_liquidity",
      detail: `Current ratio ${f.current_ratio.toFixed(2)} (below 1.0 — current liabilities exceed current assets)`,
    });
  }

  if (f.free_cash_flow !== null && f.free_cash_flow < 0) {
    flags.push({
      flag: "negative_free_cash_flow",
      detail: `Free cash flow is negative despite reported net income of ${
        f.net_income !== null ? f.net_income.toLocaleString() : "unknown"
      } — profits may not be converting to real cash`,
    });
  }

  if (
    f.pe_ratio !== null &&
    f.pe_ratio > FUNDAMENTALS_FLAG_THRESHOLDS.HIGH_PE
  ) {
    flags.push({
      flag: "high_pe_priced_for_growth",
      detail: `P/E ${f.pe_ratio.toFixed(1)} is elevated — the price already assumes strong future growth`,
    });
  }

  if (
    f.shares_change_percent !== null &&
    f.shares_change_percent > FUNDAMENTALS_FLAG_THRESHOLDS.DILUTION_THRESHOLD_PERCENT
  ) {
    flags.push({
      flag: "shareholder_dilution",
      detail: `Shares outstanding grew ${f.shares_change_percent.toFixed(1)}% YoY — per-share returns are diluted even if total profit grew`,
    });
  }

  return flags;
}

/**
 * Convenience wrapper: builds the full FundamentalsSnapshot for one
 * entity (raw numbers + derived flags), for attaching to a
 * ComparisonEntry or for the advisor prompt.
 */
export function buildFundamentalsSnapshot(
  f: FundamentalsRow | undefined,
  sector: string
): FundamentalsSnapshot | null {
  if (!f) return null;
  return {
    pe_ratio: f.pe_ratio,
    forward_pe: f.forward_pe,
    debt_to_equity: f.debt_to_equity,
    current_ratio: f.current_ratio,
    roe_percent: f.roe_percent,
    free_cash_flow: f.free_cash_flow,
    net_income: f.net_income,
    net_income_growth_percent: f.net_income_growth_percent,
    revenue_growth_percent: f.revenue_growth_percent,
    dividend_yield_percent: f.dividend_yield_percent,
    beta: f.beta,
    analyst_rating: f.analyst_rating,
    price_target_upside_percent: f.price_target_upside_percent,
    shares_change_percent: f.shares_change_percent,
    flags: buildFundamentalsFlags(f, sector),
  };
}
