// Comparison Judge — Core Verdict Engine
// Compares each holding against peers, benchmarks, and direct stocks
// Outputs verdicts that the Alert System monitors and Smart Advisor uses

import { pool } from "../lib/dbPool";
import type { AssetRole, HoldingVerdict, ComparisonGroup, ComparisonEntry, TechnicalSignal } from "./types";
import { getLatestFundamentals, buildFundamentalsSnapshot } from "./fundamentalsCheck";

// Minimum number of comparable entries (with usable returns) needed to issue a "Strong" signal.
// Below this threshold, signals are capped at "Mixed" even if win rate would qualify as "Strong".
// This prevents thin-sample false confidence (e.g., beating 3 of 5 thin comparables shouldn't
// warrant the same conviction as beating 6 of 10 solid ones).
const MIN_RELIABLE_COMPARABLES = 4;

type ReturnPeriod = "return_1y" | "return_6m" | "return_3m";

interface WatchlistRow {
  id: number;
  ticker: string;
  name: string;
  entity_type: "fund" | "stock" | "index";
  sector: string;
  manager: string | null;
  funds_table_key: string | null;
  is_held: boolean;
  units_held: string | number | null;
  fund_nav: string | number | null;
}

interface SnapshotRow {
  watchlist_id: number;
  nav_or_price: string | number | null;
  return_30d_percent: string | number | null;
  return_ytd_percent: string | number | null;
  return_1y_percent: string | number | null;
  cagr_percent: string | number | null;
  risk_level: string | null;
  signal: string | null;
  sector_rank: number | null;
  raw_fetch_ok: boolean;
  scraped_at: string;
}

function numeric(value: string | number | null): number | null {
  if (value === null) return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function returnFor(snapshot: SnapshotRow | undefined, period: ReturnPeriod): number | null {
  if (!snapshot) return null;
  if (period === "return_1y") return numeric(snapshot.return_1y_percent);
  // The current scraper does not populate 6m/3m yet; do not substitute a different period.
  return null;
}

function riskTier(riskLevel: string | null): "Low" | "Medium" | "High" | null {
  if (!riskLevel) return null;
  const normalized = riskLevel.toLowerCase();
  if (normalized.includes("high")) return "High";
  if (normalized.includes("low")) return "Low";
  if (normalized.includes("medium") || normalized.includes("moderate")) return "Medium";
  return null;
}

// Bareeq (ABR) is the portfolio's money-market emergency reserve. It is
// measured against the emergency-fund target, not against investment peers.
function isEmergencyReserveFund(row: WatchlistRow): boolean {
  if (row.entity_type !== "fund") return false;
  const identity = `${row.ticker} ${row.name}`.toLowerCase();
  return row.funds_table_key === "abr"
    || row.ticker.toUpperCase() === "ABR"
    || identity.includes("bareeq")
    || identity.includes("money market");
}

function assetRole(row: WatchlistRow): AssetRole {
  if (isEmergencyReserveFund(row)) return "money_market_reserve";
  if (row.entity_type === "stock") return "stock";
  if (row.entity_type === "index") return "benchmark";
  if (row.sector.toLowerCase().includes("real estate")) return "real_estate_fund";
  if (row.sector.toLowerCase().includes("precious metals")) return "commodity_fund";
  if (row.sector.toLowerCase().includes("fixed income") || row.sector.toLowerCase().includes("income")) return "income_fund";
  return "growth_fund";
}

function groupFor(
  groupType: ComparisonGroup["group_type"],
  holding: WatchlistRow,
  candidates: WatchlistRow[],
): WatchlistRow[] {
  switch (groupType) {
    case "sector_sibling":
      return candidates.filter((candidate) => candidate.sector === holding.sector);
    case "manager_sibling":
      return candidates.filter(
        (candidate) => holding.manager !== null && candidate.manager === holding.manager,
      );
    case "direct_stock":
      return candidates.filter(
        (candidate) => candidate.entity_type === "stock" && candidate.sector === holding.sector,
      );
    case "benchmark":
      return candidates.filter((candidate) => candidate.entity_type === "index");
  }
}

async function getWatchlistRows(): Promise<WatchlistRow[]> {
  const result = await pool.query<WatchlistRow>(
        `SELECT cw.id, cw.ticker, cw.name, cw.entity_type, cw.sector, cw.manager,
          cw.funds_table_key, cw.is_held, f.units_held, f.nav AS fund_nav
     FROM comparison_watchlist cw
     LEFT JOIN funds f ON f.key = cw.funds_table_key
     ORDER BY cw.entity_type, cw.ticker`,
  );
  return result.rows;
}

async function getLatestSnapshots(runId?: number): Promise<Map<number, SnapshotRow>> {
  const runFilter = runId === undefined ? "" : "AND run_id = $1";
  const result = await pool.query<SnapshotRow>(
    `SELECT DISTINCT ON (watchlist_id)
        watchlist_id, nav_or_price, return_30d_percent, return_ytd_percent,
        return_1y_percent, cagr_percent, risk_level, signal, sector_rank, raw_fetch_ok
      , scraped_at
     FROM comparison_snapshots
     WHERE 1 = 1
       ${runFilter}
     ORDER BY watchlist_id, scraped_at DESC`,
     runId === undefined ? [] : [runId],
  );
  return new Map(result.rows.map((row) => [row.watchlist_id, row]));
}

async function getTechnicalSignals(runId?: number): Promise<Map<number, TechnicalSignal>> {
  if (runId === undefined) return new Map();
  try {
    const result = await pool.query<{ watchlist_id: number; candle_date: string | null; trend: TechnicalSignal["trend"]; patterns: unknown; confidence: string | number | null; raw_fetch_ok: boolean }>(
      `SELECT DISTINCT ON (watchlist_id) watchlist_id, candle_date, trend, patterns, confidence, raw_fetch_ok
       FROM technical_signals WHERE run_id = $1 ORDER BY watchlist_id, created_at DESC`,
      [runId],
    );
    return new Map(result.rows.map((row) => [row.watchlist_id, {
      candle_date: row.candle_date,
      trend: row.trend,
      patterns: Array.isArray(row.patterns) ? row.patterns as TechnicalSignal["patterns"] : [],
      confidence: row.confidence === null ? null : Number(row.confidence),
      raw_fetch_ok: row.raw_fetch_ok,
    }]));
  } catch (error) {
    console.warn("[judge] technical_signals unavailable; continuing without chart evidence", error);
    return new Map();
  }
}

function buildGroup(
  groupType: ComparisonGroup["group_type"],
  holding: WatchlistRow,
  candidates: WatchlistRow[],
  snapshots: Map<number, SnapshotRow>,
  fundamentals: Awaited<ReturnType<typeof getLatestFundamentals>>,
  technicalSignals: Map<number, TechnicalSignal>,
  period: ReturnPeriod,
  holdingReturn: number | null,
): ComparisonGroup | null {
  const entries: ComparisonEntry[] = candidates.map((candidate) => {
    const snapshot = snapshots.get(candidate.id);
    const returnPercent = returnFor(snapshot, period);
    const gapPercent = holdingReturn !== null && returnPercent !== null
      ? holdingReturn - returnPercent
      : null;
    const fundamentalsSnapshot = candidate.entity_type === "stock"
      ? buildFundamentalsSnapshot(fundamentals.get(candidate.id), candidate.sector)
      : null;
    const candidateRisk = riskTier(snapshot?.risk_level ?? null);
    const holdingRisk = riskTier(snapshots.get(holding.id)?.risk_level ?? null);

    return {
      name: candidate.name,
      ticker: candidate.ticker,
      asset_role: assetRole(candidate),
      return_percent: returnPercent,
      sector_rank: snapshot?.sector_rank ?? null,
      stock_signal: snapshot?.signal ?? null,
      computed_risk_tier: candidateRisk,
      foudalens_risk_level: snapshot?.risk_level ?? null,
      risk_mismatch: candidateRisk !== null && holdingRisk !== null && candidateRisk !== holdingRisk,
      gap_percent: gapPercent,
      fundamentals: fundamentalsSnapshot,
    };
  });

  if (entries.length === 0) return null;
  return {
    group_type: groupType,
    entries,
    you_beat_count: entries.filter((entry) => entry.gap_percent !== null && entry.gap_percent > 0).length,
    you_lose_count: entries.filter((entry) => entry.gap_percent !== null && entry.gap_percent < 0).length,
    incomplete_count: entries.filter((entry) => entry.gap_percent === null).length,
  };
}

/**
 * judgeHolding - main comparison logic for a single holding
 * Returns a verdict that logs to verdict_history (step 1 of V2 Alert System)
 */
async function judgeHolding(
  holding: WatchlistRow,
  period: ReturnPeriod,
  watchlist: WatchlistRow[],
  snapshots: Map<number, SnapshotRow>,
  fundamentals: Awaited<ReturnType<typeof getLatestFundamentals>>,
  technicalSignals: Map<number, TechnicalSignal>,
  runId?: number,
): Promise<HoldingVerdict> {
  const holdingSnapshot = snapshots.get(holding.id);
  const holdingReturn = returnFor(holdingSnapshot, period);
  const candidates = watchlist.filter(
    (candidate) => candidate.id !== holding.id && !isEmergencyReserveFund(candidate),
  );
  const groups = ([
    ["sector_sibling", groupFor("sector_sibling", holding, candidates)],
    ["manager_sibling", groupFor("manager_sibling", holding, candidates)],
    ["direct_stock", groupFor("direct_stock", holding, candidates)],
    ["benchmark", groupFor("benchmark", holding, candidates)],
  ] as const)
    .map(([groupType, groupCandidates]) => buildGroup(groupType, holding, groupCandidates, snapshots, fundamentals, technicalSignals, period, holdingReturn))
    .filter((group): group is ComparisonGroup => group !== null);

  const comparableEntries = groups.flatMap((group) => group.entries).filter((entry) => entry.gap_percent !== null);
  const beats = comparableEntries.filter((entry) => entry.gap_percent! > 0).length;
  const loses = comparableEntries.filter((entry) => entry.gap_percent! < 0).length;
  const flags: string[] = [];
  if (holdingReturn === null) flags.push(`missing_${period}_return`);
  if (comparableEntries.length === 0) flags.push("no_comparable_return_data");
  if (loses > beats && comparableEntries.length > 0) flags.push("underperforming_comparables");
  if (groups.some((group) => group.incomplete_count > 0)) flags.push("incomplete_comparison_data");

  // Calculate raw signal based on win rate, then apply minimum sample size threshold.
  // This prevents thin-sample false confidence: a "Strong" from 3-of-5 thin comparables
  // is capped at "Mixed" to reflect the reduced reliability.
  // Note: we only cap upward ("Strong" → "Mixed"), never downgrade "Mixed" or "Weak".
  let signal: "Strong" | "Mixed" | "Weak" | "Insufficient Data" = comparableEntries.length === 0
    ? "Insufficient Data"
    : beats / comparableEntries.length >= 0.6
      ? "Strong"
      : beats / comparableEntries.length >= 0.4
        ? "Mixed"
        : "Weak";

  // Cap "Strong" signal at "Mixed" if the comparable sample is below the minimum threshold.
  if (signal === "Strong" && comparableEntries.length < MIN_RELIABLE_COMPARABLES) {
    signal = "Mixed";
    flags.push("thin_comparable_sample");
  }
  if (signal === "Strong" && technicalSignals.get(holding.id)?.trend === "downtrend") {
    flags.push("technical_divergence");
  }
  const fundamentals_flags_found = groups.some((group) =>
    group.entries.some(
      (entry) => entry.gap_percent !== null && entry.gap_percent < 0 && entry.fundamentals && entry.fundamentals.flags.length > 0,
    ),
  );
  const comparableCount = groups.reduce((count, group) => count + group.entries.length, 0);
  const comparableWithReturnCount = comparableEntries.length;
  const coveragePercent = comparableCount === 0
    ? null
    : Math.round((comparableWithReturnCount / comparableCount) * 1000) / 10;
  const snapshotAgeHours = holdingSnapshot?.scraped_at
    ? Math.max(0, (Date.now() - new Date(holdingSnapshot.scraped_at).getTime()) / 3_600_000)
    : null;
  const holdingSnapshotStatus = !holdingSnapshot
    ? "missing"
    : !holdingSnapshot.raw_fetch_ok
      ? "failed"
      : snapshotAgeHours !== null && snapshotAgeHours > 48
        ? "stale"
        : "fresh";

  const verdict: HoldingVerdict = {
    holding_ticker: holding.ticker,
    holding_name: holding.name,
    holding_asset_role: assetRole(holding),
    holding_return_percent: holdingReturn,
    holding_current_value_egp: holding.units_held !== null && holding.fund_nav !== null
      ? numeric(holding.units_held)! * numeric(holding.fund_nav)!
      : null,
    holding_risk_tier: riskTier(holdingSnapshot?.risk_level ?? null),
    technical_signal: technicalSignals.get(holding.id) ?? null,
    data_quality: {
      holding_snapshot_status: holdingSnapshotStatus,
      holding_snapshot_age_hours: snapshotAgeHours,
      comparable_count: comparableCount,
      comparable_with_return_count: comparableWithReturnCount,
    },
    return_period: period,
    groups,
    signal,
    coverage_percent: coveragePercent,
    flags,
    data_completeness_warning: holdingReturn === null || groups.some((group) => group.incomplete_count > 0),
    fundamentals_flags_found,
  };

  // V2 Alert System -- Step 1: log every verdict so Time Stop / Thesis
  // Check can later compare "now vs. before" instead of only seeing
  // the latest run. Pure logging -- must never throw or block the
  // actual verdict from returning.
  try {
    await pool.query(
      `INSERT INTO verdict_history (watchlist_id, signal, flags, return_percent, raw_verdict, run_id)
      VALUES ($1, $2, $3, $4, $5, $6)`,
          [holding.id, signal, flags, verdict.holding_return_percent, JSON.stringify(verdict), runId]
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
 * judgeAllHoldings - runs comparison judge for held positions by default.
 * Pass includeAllEntities to evaluate every non-reserve watchlist entity.
 */
export async function judgeAllHoldings(
  period: ReturnPeriod,
  runId?: number,
  includeAllEntities = false,
): Promise<HoldingVerdict[]> {
  try {
    const [watchlist, snapshots, fundamentals, technicalSignals] = await Promise.all([
      getWatchlistRows(),
      getLatestSnapshots(runId),
      getLatestFundamentals(runId),
      getTechnicalSignals(runId),
    ]);

    const verdicts: HoldingVerdict[] = [];
    const entities = includeAllEntities
      ? watchlist.filter((row) => !isEmergencyReserveFund(row))
      : watchlist.filter((row) => row.is_held && !isEmergencyReserveFund(row));
    for (const holding of entities) {
      const verdict = await judgeHolding(holding, period, watchlist, snapshots, fundamentals, technicalSignals, runId);
      verdicts.push(verdict);
    }
    return verdicts;
  } catch (err) {
    console.error("[judgeAllHoldings] failed:", err);
    throw new Error("Comparison Judge could not load its watchlist or snapshot data", { cause: err });
  }
}

/**
 * judgeOneHolding - runs comparison judge for a specific ticker
 */
export async function judgeOneHolding(
  ticker: string,
  period: ReturnPeriod,
  runId?: number,
): Promise<HoldingVerdict | null> {
  try {
    const [watchlist, snapshots, fundamentals, technicalSignals] = await Promise.all([
      getWatchlistRows(),
      getLatestSnapshots(runId),
      getLatestFundamentals(runId),
      getTechnicalSignals(runId),
    ]);
    const holding = watchlist.find((row) => row.ticker === ticker.toUpperCase());
    if (!holding) return null;
    if (isEmergencyReserveFund(holding)) return null;
    return await judgeHolding(holding, period, watchlist, snapshots, fundamentals, technicalSignals, runId);
  } catch (err) {
    console.error(`[judgeOneHolding] failed for ${ticker}:`, err);
    throw new Error(`Comparison Judge could not evaluate ${ticker}`, { cause: err });
  }
}
