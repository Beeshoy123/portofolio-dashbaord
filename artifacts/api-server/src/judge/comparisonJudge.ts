// Comparison Judge — Core Verdict Engine
// Compares each holding against peers, benchmarks, and direct stocks
// Outputs verdicts that the Alert System monitors and Smart Advisor uses

import { Pool } from "pg";
import type { HoldingVerdict, ComparisonGroup, ComparisonEntry } from "./types";
import { getLatestFundamentals, buildFundamentalsSnapshot } from "./fundamentalsCheck";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * judgeHolding - main comparison logic for a single holding
 * Returns a verdict that logs to verdict_history (step 1 of V2 Alert System)
 */
async function judgeHolding(
  holding: any,
  period: "return_1y" | "return_6m" | "return_3m"
): Promise<HoldingVerdict> {
  // Fetch fundamentals data for all holdings
  const fundamentals = await getLatestFundamentals();
  
  // Placeholder: implement based on your actual comparison logic
  // For now, this returns a minimal valid verdict
  
  const signal: "Strong" | "Mixed" | "Weak" = "Mixed";
  const flags: string[] = [];
  const groups: ComparisonGroup[] = [];

  // NEW: compute fundamentals_flags_found flag
  // Only check entities beating you (gap_percent < 0) with fundamentals concerns
  const fundamentals_flags_found = groups.some((g) =>
    g.entries.some(
      (e) => e.gap_percent !== null && e.gap_percent < 0 && e.fundamentals && e.fundamentals.flags.length > 0
    )
  );

  const verdict: HoldingVerdict = {
    holding_ticker: holding.ticker,
    holding_name: holding.name,
    holding_return_percent: null,
    holding_current_value_egp: null,
    holding_risk_tier: null,
    return_period: period,
    groups,
    signal,
    flags,
    data_completeness_warning: false,
    fundamentals_flags_found,
  };

  // V2 Alert System -- Step 1: log every verdict so Time Stop / Thesis
  // Check can later compare "now vs. before" instead of only seeing
  // the latest run. Pure logging -- must never throw or block the
  // actual verdict from returning.
  try {
    await pool.query(
      `INSERT INTO verdict_history (watchlist_id, signal, flags, return_percent, raw_verdict)
       VALUES ($1, $2, $3, $4, $5)`,
      [holding.id, signal, flags, verdict.holding_return_percent, JSON.stringify(verdict)]
    );
  } catch (err) {
    console.error(
      `[verdict_history] failed to log verdict for ${holding.ticker}:`,
      err
    );
  }

  return verdict;
}

/**
 * judgeAllHoldings - runs comparison judge for all held positions
 */
export async function judgeAllHoldings(
  period: "return_1y" | "return_6m" | "return_3m"
): Promise<HoldingVerdict[]> {
  try {
    const result = await pool.query(
      `SELECT id, ticker, name FROM comparison_watchlist WHERE is_held = true`
    );

    const verdicts: HoldingVerdict[] = [];
    for (const holding of result.rows) {
      const verdict = await judgeHolding(holding, period);
      verdicts.push(verdict);
    }
    return verdicts;
  } catch (err) {
    console.error("[judgeAllHoldings] failed:", err);
    return [];
  }
}

/**
 * judgeOneHolding - runs comparison judge for a specific ticker
 */
export async function judgeOneHolding(
  ticker: string,
  period: "return_1y" | "return_6m" | "return_3m"
): Promise<HoldingVerdict | null> {
  try {
    const result = await pool.query(
      `SELECT id, ticker, name FROM comparison_watchlist WHERE ticker = $1`,
      [ticker]
    );

    if (result.rows.length === 0) return null;

    return await judgeHolding(result.rows[0], period);
  } catch (err) {
    console.error(`[judgeOneHolding] failed for ${ticker}:`, err);
    return null;
  }
}
