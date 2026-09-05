// Comparison Judge — Core Verdict Engine
// Compares each holding against peers, benchmarks, and direct stocks
// Outputs verdicts that the Alert System monitors and Smart Advisor uses
// Role note: Comparison Judge is a Decider. It consumes the raw fields
// collected by the Gatherers (Price Checker and Chart Reader) and produces
// the multi-factor verdict; it must not be treated as a data collector.
//
// FILE STRUCTURE:
// ├── Types & Constants
// ├── Utility Functions (return, risk tier, asset classification)
// ├── Group Construction (buildGroup)
// ├── Signal Computation (computeSignal + flag logic)
// └── Main Entry Points (judgeHolding, judgeAllHoldings, findOpportunities)

import { pool } from "../lib/dbPool";
import { analyzePortfolioOpportunities, type PortfolioOpportunityAnalysis } from "../advisor/opportunityAnalysis";
import type { AssetRole, CautionReason, HoldingVerdict, ComparisonGroup, ComparisonEntry, JudgeRunDiagnostics, TechnicalSignal } from "./types";
import { getLatestFundamentals, buildFundamentalsSnapshot } from "./fundamentalsCheck";
import { computeFinancialHealthGrade } from "./financialHealth";

export type TechnicalGrade =
  | "Red Flag"
  | "Weak"
  | "Strong"
  | "Neutral"
  | "Insufficient Data";

const VALID_PERFORMANCE_GRADES = ["Strong", "Mixed", "Weak", "Insufficient Data"] as const;
const VALID_TECHNICAL_GRADES = ["Red Flag", "Weak", "Strong", "Neutral", "Insufficient Data"] as const;
const VALID_FINAL_LABELS = ["Excellent", "Solid", "Caution", "Avoid", "Insufficient Data"] as const;
const MAX_VERDICT_CACHE_ENTRIES = 20;
const verdictCache = new Map<string, Promise<HoldingVerdict[]>>();

export function invalidateJudgeCache(runId: number): void {
  for (const key of verdictCache.keys()) {
    if (key.startsWith(`${runId}:`)) verdictCache.delete(key);
  }
}

export function computeTechnicalGrade(
  technicalSignal: TechnicalSignal | null,
): TechnicalGrade {
  if (!technicalSignal || !technicalSignal.raw_fetch_ok) {
    return "Insufficient Data";
  }

  const hasBearishPattern = technicalSignal.patterns.some(
    (pattern) => pattern.direction === "bearish",
  );

  if (technicalSignal.trend === "downtrend" && hasBearishPattern) {
    return "Red Flag";
  }

  if (
    technicalSignal.trend === "downtrend"
    || technicalSignal.reversal_risk === "elevated"
  ) {
    return "Weak";
  }

  if (
    technicalSignal.trend === "uptrend"
    && !hasBearishPattern
  ) {
    return "Strong";
  }

  return "Neutral";
}

export function combineIntoFinalLabel(
  performanceGrade: "Strong" | "Mixed" | "Weak" | "Insufficient Data",
  financialHealthGrade: "Red Flag" | "Weak" | "Strong" | "Neutral" | "Insufficient Data",
  technicalGrade: TechnicalGrade,
): "Excellent" | "Solid" | "Caution" | "Avoid" | "Insufficient Data" {
  if (performanceGrade === "Insufficient Data") {
    return "Insufficient Data";
  }

  // Disqualification cap: a serious weakness in the business or chart should
  // never be hidden by an otherwise strong return profile.
  if (financialHealthGrade === "Red Flag" || technicalGrade === "Red Flag") {
    return "Avoid";
  }

  if (
    performanceGrade === "Strong"
    && financialHealthGrade !== "Weak"
    && financialHealthGrade !== "Insufficient Data"
    && technicalGrade !== "Weak"
  ) {
    return "Excellent";
  }

  if (
    (performanceGrade === "Strong" || performanceGrade === "Mixed")
    && (financialHealthGrade === "Strong" || financialHealthGrade === "Neutral")
  ) {
    return "Solid";
  }

  if (
    performanceGrade === "Strong"
    && (financialHealthGrade === "Weak" || technicalGrade === "Weak")
  ) {
    return "Caution";
  }

  // Policy question: keep Weak performance as Caution unless we decide it should escalate to Avoid.
  // Current design: only Financial Health or Technical Red Flag can produce Avoid.
  return "Caution";
}

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
  if (period === "return_1y") {
    return numeric(snapshot.return_1y_percent) ?? numeric(snapshot.return_ytd_percent);
  }
  if (period === "return_6m" || period === "return_3m") {
    return numeric(snapshot.return_30d_percent) ?? numeric(snapshot.return_ytd_percent);
  }
  return numeric(snapshot.return_1y_percent) ?? numeric(snapshot.return_ytd_percent);
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

function isPersistedVerdict(value: unknown, period: ReturnPeriod): value is HoldingVerdict {
  if (!value || typeof value !== "object") return false;
  const verdict = value as Partial<HoldingVerdict>;
  return typeof verdict.holding_ticker === "string"
    && verdict.holding_ticker.length > 0
    && verdict.return_period === period
    && typeof verdict.signal === "string"
    && Array.isArray(verdict.groups)
    && verdict.data_quality !== undefined;
}

async function loadPersistedVerdicts(
  runId: number,
  period: ReturnPeriod,
  includeAllEntities: boolean,
): Promise<HoldingVerdict[] | null> {
  try {
    const [watchlist, result] = await Promise.all([
      getWatchlistRows(),
      pool.query<{ raw_verdict: unknown }>(
        `SELECT DISTINCT ON (vh.watchlist_id) vh.raw_verdict
           FROM verdict_history vh
           JOIN comparison_watchlist cw ON cw.id = vh.watchlist_id
          WHERE vh.run_id = $1
          ORDER BY vh.watchlist_id, vh.id DESC`,
        [runId],
      ),
    ]);
    const eligibleTickers = new Set(
      watchlist
        .filter((row) => !isEmergencyReserveFund(row) && (includeAllEntities || row.is_held))
        .map((row) => row.ticker.toUpperCase()),
    );
    const persisted = result.rows
      .map((row) => typeof row.raw_verdict === "string" ? JSON.parse(row.raw_verdict) as unknown : row.raw_verdict)
      .filter((value): value is HoldingVerdict => isPersistedVerdict(value, period))
      .filter((verdict) => eligibleTickers.has(verdict.holding_ticker.toUpperCase()));

    if (persisted.length === 0) return null;
    if (includeAllEntities && persisted.length < eligibleTickers.size) {
      return null;
    }
    console.info(`[judge] Reused ${persisted.length} persisted verdicts for run ${runId}`);
    return persisted;
  } catch (error) {
    console.warn(`[judge] Persisted verdict reuse unavailable for run ${runId}; recomputing`, error);
    return null;
  }
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
    const result = await pool.query<{ watchlist_id: number; candle_date: string | null; trend: TechnicalSignal["trend"]; patterns: unknown; confidence: string | number | null; reversal_risk: TechnicalSignal["reversal_risk"] | null; raw_fetch_ok: boolean }>(
      `SELECT DISTINCT ON (watchlist_id) watchlist_id, candle_date, trend, patterns, confidence, reversal_risk, raw_fetch_ok
       FROM technical_signals WHERE run_id = $1 ORDER BY watchlist_id, created_at DESC`,
      [runId],
    );
    return new Map(result.rows.map((row) => [row.watchlist_id, {
      candle_date: row.candle_date,
      trend: row.trend,
      patterns: Array.isArray(row.patterns) ? row.patterns as TechnicalSignal["patterns"] : [],
      confidence: row.confidence === null ? null : Number(row.confidence),
      raw_fetch_ok: row.raw_fetch_ok,
      reversal_risk: row.reversal_risk ?? "none",
    }]));
  } catch (error) {
    console.warn("[judge] technical_signals unavailable; continuing without chart evidence", error);
    return new Map();
  }
}

async function getPortfolioValueBreakdown(): Promise<{ totalValueEgp: number; byTicker: Map<string, number> }> {
  const result = await pool.query<{ ticker: string; current_value_egp: string | number | null }>(
    `SELECT cw.ticker,
            COALESCE(f.units_held, 0) * COALESCE(f.nav, 0) AS current_value_egp
       FROM comparison_watchlist cw
       LEFT JOIN funds f ON f.key = cw.funds_table_key
      WHERE cw.is_held = true
        AND cw.funds_table_key IS NOT NULL
        AND f.units_held > 0
        AND f.nav IS NOT NULL`
  );

  const byTicker = new Map<string, number>();
  let totalValueEgp = 0;

  for (const row of result.rows) {
    const value = numeric(row.current_value_egp);
    if (value === null) continue;
    byTicker.set(row.ticker.toUpperCase(), value);
    totalValueEgp += value;
  }

  return { totalValueEgp, byTicker };
}

// ═══════════════════════════════════════════════════════════════════════════
// GROUP CONSTRUCTION — buildGroup()
// Takes a holding and a set of candidates, constructs a ComparisonGroup
// with entries, win/loss counts, and metadata for signal computation.
// ═══════════════════════════════════════════════════════════════════════════

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
  const sortedEntries = [...entries].sort((a, b) => {
    if (a.gap_percent !== null && b.gap_percent !== null) {
      return a.gap_percent - b.gap_percent;
    }
    if (a.gap_percent !== null) return -1;
    if (b.gap_percent !== null) return 1;
    return a.ticker.localeCompare(b.ticker);
  });
  return {
    group_type: groupType,
    entries: sortedEntries,
    you_beat_count: sortedEntries.filter((entry) => entry.gap_percent !== null && entry.gap_percent > 0).length,
    you_lose_count: sortedEntries.filter((entry) => entry.gap_percent !== null && entry.gap_percent < 0).length,
    incomplete_count: sortedEntries.filter((entry) => entry.gap_percent === null).length,
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
  portfolioValueBreakdown: { totalValueEgp: number; byTicker: Map<string, number> },
  runId?: number,
  diagnostics?: JudgeRunDiagnostics,
): Promise<HoldingVerdict> {
  const holdingSnapshot = snapshots.get(holding.id);
  const holdingReturn = returnFor(holdingSnapshot, period);
  const currentValueEgp = holding.units_held !== null && holding.fund_nav !== null
    ? numeric(holding.units_held)! * numeric(holding.fund_nav)!
    : null;
  const portfolioWeightPercent = currentValueEgp !== null && portfolioValueBreakdown.totalValueEgp > 0
    ? (currentValueEgp / portfolioValueBreakdown.totalValueEgp) * 100
    : null;
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

  // Performance category: calculate raw return-based grade from win rate,
  // then apply the minimum sample-size threshold. This keeps the proven
  // return logic intact while renaming it to the new category vocabulary.
  // Note: we only cap upward ("Strong" → "Mixed"), never downgrade
  // "Mixed" or "Weak".
  let performanceGrade: "Strong" | "Mixed" | "Weak" | "Insufficient Data" = comparableEntries.length === 0
    ? "Insufficient Data"
    : beats / comparableEntries.length >= 0.6
      ? "Strong"
      : beats / comparableEntries.length >= 0.4
        ? "Mixed"
        : "Weak";

  // Cap "Strong" performance at "Mixed" if the comparable sample is below
  // the minimum threshold.
  if (performanceGrade === "Strong" && comparableEntries.length < MIN_RELIABLE_COMPARABLES) {
    performanceGrade = "Mixed";
    flags.push("thin_comparable_sample");
  }

  if (performanceGrade === "Strong" && technicalSignals.get(holding.id)?.trend === "downtrend") {
    flags.push("technical_divergence");
  }
  if (technicalSignals.get(holding.id)?.reversal_risk === "elevated") {
    flags.push("reversal_risk_elevated");
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

  const holdingFundamentals = holding.entity_type === "stock"
    ? buildFundamentalsSnapshot(fundamentals.get(holding.id), holding.sector)
    : null;

  const financialHealthPeerGroup = (groups.find((group) => group.group_type === "sector_sibling")?.entries ?? []).map((entry) => ({
    fundamentals: entry.fundamentals,
  }));

  const financialHealthGrade = computeFinancialHealthGrade(
    { fundamentals: holdingFundamentals },
    financialHealthPeerGroup,
    holding.sector,
  );

  const financialHealthReason = financialHealthGrade === "Insufficient Data"
    ? holding.entity_type !== "stock"
      ? "not_applicable_fund"
      : !holdingFundamentals
        ? "missing_own_fundamentals"
        : "insufficient_peers"
    : undefined;

  const technicalGrade = computeTechnicalGrade(technicalSignals.get(holding.id) ?? null);
  const technicalSignal = technicalSignals.get(holding.id) ?? null;
  const technicalReason = technicalGrade === "Insufficient Data"
    ? !technicalSignal || !technicalSignal.raw_fetch_ok
      ? "no_chart_data"
      : "insufficient_trend_history"
    : undefined;
  const finalLabel = combineIntoFinalLabel(
    performanceGrade,
    financialHealthGrade,
    technicalGrade,
  );
  if (!VALID_PERFORMANCE_GRADES.includes(performanceGrade)) {
    console.error(
      `[INVARIANT VIOLATION] performanceGrade returned an unexpected value "${performanceGrade}" for ${holding.ticker} (run ${runId}).`,
    );
  }
  if (!VALID_TECHNICAL_GRADES.includes(technicalGrade)) {
    console.error(
      `[INVARIANT VIOLATION] technicalGrade returned an unexpected value "${technicalGrade}" for ${holding.ticker} (run ${runId}).`,
    );
  }
  if (!VALID_FINAL_LABELS.includes(finalLabel)) {
    console.error(
      `[INVARIANT VIOLATION] combineIntoFinalLabel returned an unexpected value "${finalLabel}" for ${holding.ticker} (run ${runId}). Inputs: performanceGrade=${performanceGrade}, financialHealthGrade=${financialHealthGrade}, technicalGrade=${technicalGrade}`,
    );
  }
  const cautionReason: CautionReason | undefined = finalLabel === "Caution"
    ? performanceGrade === "Weak"
      ? "weak_performance"
      : financialHealthGrade === "Insufficient Data"
        ? "insufficient_financial_health"
        : technicalGrade === "Weak"
          ? "weak_technical"
          : "mixed_signals"
    : undefined;
  // Final combined signal now reflects the multi-factor grid, while the
  // performance_grade field continues to preserve the original return-only
  // breakdown for debugging and comparison.
  const signal: HoldingVerdict["signal"] = finalLabel;

  const verdict: HoldingVerdict = {
    holding_ticker: holding.ticker,
    holding_name: holding.name,
    holding_asset_role: assetRole(holding),
    holding_return_percent: holdingReturn,
    holding_current_value_egp: currentValueEgp,
    holding_portfolio_weight_percent: portfolioWeightPercent,
    portfolio_total_value_egp: portfolioValueBreakdown.totalValueEgp > 0 ? portfolioValueBreakdown.totalValueEgp : null,
    holding_risk_tier: riskTier(holdingSnapshot?.risk_level ?? null),
    holding_fundamentals: holdingFundamentals,
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
    performance_grade: performanceGrade,
    financial_health_grade: financialHealthGrade,
    ...(financialHealthReason ? { financial_health_reason: financialHealthReason } : {}),
    technical_grade: technicalGrade,
    ...(technicalReason ? { technical_reason: technicalReason } : {}),
    final_label: finalLabel,
    ...(cautionReason ? { caution_reason: cautionReason } : {}),
    coverage_percent: coveragePercent,
    flags,
    data_completeness_warning: holdingReturn === null || groups.some((group) => group.incomplete_count > 0),
    fundamentals_flags_found,
    is_held: Boolean(holding.is_held),
    comparables_beaten: beats,
    comparables_total: comparableEntries.length,
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
    const errorMessage = err instanceof Error ? err.message : String(err);
    diagnostics?.verdict_history_write_failures.push(`${holding.ticker}: ${errorMessage}`);
    console.error(
      `[verdict_history] failed to log verdict for ${holding.ticker}: ${errorMessage}`,
      err,
    );
  }

  return verdict;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENTRY POINTS — Public API
// judgeAllHoldings() — Run comparison judge for all holdings (v2 Alert System)
// findOpportunities() — Identify strong unheld entities and sector gaps
// ═══════════════════════════════════════════════════════════════════════════

/**
 * judgeAllHoldings - runs comparison judge for held positions by default.
 * Pass includeAllEntities to evaluate every non-reserve watchlist entity.
 */
export async function judgeAllHoldings(
  period: ReturnPeriod,
  runId?: number,
  includeAllEntities = false,
  diagnostics?: JudgeRunDiagnostics,
): Promise<HoldingVerdict[]> {
  const cacheKey = runId === undefined
    ? null
    : `${runId}:${period}:${includeAllEntities ? "all" : "held"}`;
  if (cacheKey) {
    const cached = verdictCache.get(cacheKey);
    if (cached) return cached;
  }

  const computation = runId === undefined
    ? judgeAllHoldingsUncached(period, runId, includeAllEntities, diagnostics)
    : loadPersistedVerdicts(runId, period, includeAllEntities)
      .then((persisted) => persisted ?? judgeAllHoldingsUncached(period, runId, includeAllEntities, diagnostics));
  if (cacheKey) {
    verdictCache.set(cacheKey, computation);
    while (verdictCache.size > MAX_VERDICT_CACHE_ENTRIES) {
      const oldestKey = verdictCache.keys().next().value;
      if (oldestKey === undefined) break;
      verdictCache.delete(oldestKey);
    }
    computation.catch(() => {
      if (verdictCache.get(cacheKey) === computation) verdictCache.delete(cacheKey);
    });
  }
  return computation;
}

async function judgeAllHoldingsUncached(
  period: ReturnPeriod,
  runId?: number,
  includeAllEntities = false,
  diagnostics?: JudgeRunDiagnostics,
): Promise<HoldingVerdict[]> {
  try {
    const [watchlist, snapshots, fundamentals, technicalSignals] = await Promise.all([
      getWatchlistRows(),
      getLatestSnapshots(runId),
      getLatestFundamentals(runId),
      getTechnicalSignals(runId),
    ]);
    const portfolioValueBreakdown = await getPortfolioValueBreakdown();

    const verdicts: HoldingVerdict[] = [];
    const entities = includeAllEntities
      ? watchlist.filter((row) => !isEmergencyReserveFund(row))
      : watchlist.filter((row) => row.is_held && !isEmergencyReserveFund(row));
    for (const holding of entities) {
      const verdict = await judgeHolding(holding, period, watchlist, snapshots, fundamentals, technicalSignals, portfolioValueBreakdown, runId, diagnostics);
      verdicts.push(verdict);
    }
    return verdicts;
  } catch (err) {
    console.error("[judgeAllHoldings] failed:", err);
    throw new Error("Comparison Judge could not load its watchlist or snapshot data", { cause: err });
  }
}

/**
 * Represents discovered opportunities: strong unheld entities and underrepresented sectors
 */
export interface OpportunitiesAnalysis {
  strong_unheld: HoldingVerdict[];
  underrepresented_sectors: Array<{
    sector: string;
    portfolio_allocation_percent: number;
    strong_candidates: HoldingVerdict[];
  }>;
  sector_concentration_in_opportunities: Array<{
    sector: string;
    count: number;
    tickers: string[];
  }>;
  sectors_no_strong_exposure: Array<{
    sector: string;
    held_strong_count: number;
    held_mixed_count: number;
    held_weak_count: number;
    unheld_strong_entities: Array<{
      ticker: string;
      name: string;
      return_percent: number | null;
      signal?: string;
    }>;
  }>;
  unheld_outperforming_held: Array<{
    unheld_ticker: string;
    unheld_name: string;
    unheld_return: number | null;
    held_ticker: string;
    held_name: string;
    held_return: number | null;
    gap_percent: number;
    risk_comparison: string;
  }>;
  risk_tier_comparison: {
    portfolio_avg_risk: string;
    opportunities_avg_risk: string;
    higher_risk_opportunities: number;
  };
}

/**
 * findOpportunities - discovers strong unheld entities and sectors with low portfolio exposure
 * Calls judgeAllHoldings with includeAllEntities=true to evaluate every watchlist entity,
 * then filters for:
 *  - Unheld entities with "Strong" verdict
 *  - Sectors where portfolio has <10% allocation but strong unheld candidates exist
 */
export async function findOpportunities(runId?: number): Promise<OpportunitiesAnalysis> {
  let allVerdicts: HoldingVerdict[];
  let watchlist: WatchlistRow[];

  // Phase 1: Run comparison judge to get verdicts for all entities
  try {
    allVerdicts = await judgeAllHoldings("return_1y", runId, true);
    console.log(`[findOpportunities] Phase 1: Judged ${allVerdicts.length} entities`);
  } catch (err) {
    const message = `[findOpportunities] Phase 1 (judgeAllHoldings) failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(message, err);
    throw new Error("Opportunities analysis failed at comparison judge phase", { cause: err });
  }

  // Phase 2: Fetch watchlist to classify entities as held/unheld and by sector
  try {
    const watchlistResult = await pool.query<WatchlistRow>("SELECT * FROM comparison_watchlist");
    watchlist = watchlistResult.rows;
    console.log(`[findOpportunities] Phase 2: Fetched ${watchlist.length} watchlist entries`);
  } catch (err) {
    const message = `[findOpportunities] Phase 2 (watchlist fetch) failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(message, err);
    throw new Error("Opportunities analysis failed at watchlist fetch phase", { cause: err });
  }

  // Phase 3: Analyze verdicts and organize by held/unheld and sector
  try {
    const watchlistMap = new Map(watchlist.map((row) => [row.id, row]));

    // Filter to unheld entities with Strong signal
    const strong_unheld = allVerdicts.filter(
      (verdict) =>
        !watchlistMap.get(verdict.holding_ticker.toUpperCase() as any)?.is_held &&
        (verdict.signal === "Excellent" || verdict.signal === "Solid")
    );

    // Compute sector allocation for held holdings
    const heldVerdicts = allVerdicts.filter(
      (verdict) => watchlistMap.get(verdict.holding_ticker.toUpperCase() as any)?.is_held
    );
    const totalHeldValue = heldVerdicts.reduce(
      (sum, v) => sum + (v.holding_current_value_egp ?? 0),
      0
    );

    // Group unheld strong entities by sector
    const unheldBySector = new Map<string, HoldingVerdict[]>();
    strong_unheld.forEach((verdict) => {
      const watchlistRow = watchlist.find((w) => w.ticker === verdict.holding_ticker);
      const sector = watchlistRow?.sector ?? "Unclassified";
      if (!unheldBySector.has(sector)) {
        unheldBySector.set(sector, []);
      }
      unheldBySector.get(sector)!.push(verdict);
    });

    // Identify underrepresented sectors (held allocation <10% with strong unheld candidates)
    const underrepresented_sectors: OpportunitiesAnalysis["underrepresented_sectors"] = [];
    for (const [sector, candidates] of unheldBySector.entries()) {
      const sectorHeldValue = heldVerdicts
        .filter((verdict) => {
          const watchlistRow = watchlist.find((w) => w.ticker === verdict.holding_ticker);
          return watchlistRow?.sector === sector;
        })
        .reduce((sum, v) => sum + (v.holding_current_value_egp ?? 0), 0);

      const allocationPercent =
        totalHeldValue > 0 ? (sectorHeldValue / totalHeldValue) * 100 : 0;
      if (allocationPercent < 10) {
        underrepresented_sectors.push({
          sector,
          portfolio_allocation_percent: allocationPercent,
          strong_candidates: candidates,
        });
      }
    }

    console.log(`[findOpportunities] Phase 3: Found ${strong_unheld.length} strong unheld, ${underrepresented_sectors.length} underrepresented sectors`);

    // Phase 4: Run detailed deterministic analysis
    let detailedAnalysis: PortfolioOpportunityAnalysis;
    try {
      detailedAnalysis = analyzePortfolioOpportunities(allVerdicts);
      console.log(`[findOpportunities] Phase 4: Deterministic analysis complete`);
    } catch (analyzeErr) {
      const message = `[findOpportunities] Phase 4 (analyzePortfolioOpportunities) failed: ${analyzeErr instanceof Error ? analyzeErr.message : String(analyzeErr)}`;
      console.error(message, analyzeErr);
      throw new Error("Opportunities analysis failed at portfolio opportunity analysis phase", { cause: analyzeErr });
    }

    return {
      strong_unheld,
      underrepresented_sectors,
      sector_concentration_in_opportunities: detailedAnalysis.sector_concentration_in_opportunities,
      sectors_no_strong_exposure: detailedAnalysis.sectors_no_strong_exposure,
      unheld_outperforming_held: detailedAnalysis.unheld_outperforming_held,
      risk_tier_comparison: detailedAnalysis.risk_tier_comparison,
    };
  } catch (err) {
    const message = `[findOpportunities] Phase 3 (verdict analysis) failed: ${err instanceof Error ? err.message : String(err)}`;
    console.error(message, err);
    throw new Error("Opportunities analysis failed at verdict analysis phase", { cause: err });
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
    const portfolioValueBreakdown = await getPortfolioValueBreakdown();
    return await judgeHolding(holding, period, watchlist, snapshots, fundamentals, technicalSignals, portfolioValueBreakdown, runId);
  } catch (err) {
    console.error(`[judgeOneHolding] failed for ${ticker}:`, err);
    throw new Error(`Comparison Judge could not evaluate ${ticker}`, { cause: err });
  }
}
