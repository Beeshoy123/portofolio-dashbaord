// Comparison Judge — Core Logic
//
// Deliberately rule-based, not AI-generated (see design discussion:
// facts with one correct answer should be computed, not guessed by an
// LLM — that's Smart Advisor's job, one step downstream of this).
//
// Reads the latest comparison_snapshots row per watchlist entity, groups
// them by their relationship to each of your holdings (sector sibling /
// manager sibling / direct stock / benchmark), and produces a structured
// verdict per holding.

import { Pool } from "pg";
import type {
  ComparisonEntry,
  ComparisonGroup,
  HoldingVerdict,
  SignalStrength,
  RiskTier,
  SecondOpinionCheck,
} from "./types";
// STRUCTURAL FIX (senior-dev integration review): previously declared its
// own inline WatchlistRow interface, independently from
// scraper/types.ts's WatchlistEntity — the two had already drifted
// (this one was missing source_code). Now imports the single shared
// definition from /types.ts instead. Aliased to WatchlistRow so the rest
// of this file (which only ever used id/ticker/name/entity_type/sector/
// manager/is_held) didn't need every call site touched.
import type { WatchlistEntity as WatchlistRow } from "../types";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type ReturnPeriod = "return_30d" | "return_ytd" | "return_1y";

interface LatestSnapshotRow {
  watchlist_id: number;
  return_30d_percent: number | null;
  return_ytd_percent: number | null;
  return_1y_percent: number | null;
  signal: string | null;
  sector_rank: number | null;
  risk_level: string | null; // FoudaLens's own label — funds only, used as cross-check
  total_score: number | null;
  pe_ratio: number | null;
  dividend_yield_percent: number | null;
  market_cap: number | null;
}

/**
 * Pulls the most recent snapshot per watchlist entity. Uses DISTINCT ON,
 * which is Postgres-specific — matches your existing stack (Replit Postgres).
 */
async function getLatestSnapshots(): Promise<Map<number, LatestSnapshotRow>> {
  const result = await pool.query<LatestSnapshotRow>(
    `SELECT DISTINCT ON (watchlist_id)
        watchlist_id, return_30d_percent, return_ytd_percent, return_1y_percent,
        signal, sector_rank, risk_level, total_score, pe_ratio,
        dividend_yield_percent, market_cap
     FROM comparison_snapshots
     WHERE raw_fetch_ok = true
     ORDER BY watchlist_id, scraped_at DESC`
  );
  const map = new Map<number, LatestSnapshotRow>();
  for (const row of result.rows) {
    // node-postgres returns numeric columns as strings; coerce them to JS
    // numbers here so every downstream caller gets the correct type.
    map.set(row.watchlist_id, {
      ...row,
      return_30d_percent:    row.return_30d_percent    !== null ? Number(row.return_30d_percent)    : null,
      return_ytd_percent:    row.return_ytd_percent    !== null ? Number(row.return_ytd_percent)    : null,
      return_1y_percent:     row.return_1y_percent     !== null ? Number(row.return_1y_percent)     : null,
      sector_rank:           row.sector_rank           !== null ? Number(row.sector_rank)           : null,
      total_score:           row.total_score           !== null ? Number(row.total_score)           : null,
      pe_ratio:              row.pe_ratio              !== null ? Number(row.pe_ratio)              : null,
      dividend_yield_percent: row.dividend_yield_percent !== null ? Number(row.dividend_yield_percent) : null,
      market_cap:            row.market_cap            !== null ? Number(row.market_cap)            : null,
    });
  }
  return map;
}

async function getWatchlist(): Promise<WatchlistRow[]> {
  const result = await pool.query<WatchlistRow>(
    // Added source_code here as part of the type consolidation — the
    // shared WatchlistEntity type includes it, so the query now actually
    // returns everything the type promises (Comparison Judge still
    // doesn't use it for anything; scraper.ts is the one that needs it).
    `SELECT id, ticker, name, entity_type, source_code, sector, manager, is_held
     FROM comparison_watchlist`
  );
  return result.rows;
}

/**
 * Pulls the CURRENT VALUE of a held position from your existing `funds`
 * table — deliberately units_held × nav (what it's worth NOW), not
 * cost_basis_total (what you originally paid). Using cost basis here
 * would misstate how much money is actually available to reallocate.
 *
 * Matches on comparison_watchlist.funds_table_key, which must be set
 * correctly for is_held=true rows (see 002_seed_watchlist.sql — BRE/CFF
 * need funds_table_key updated to match your real funds.key values).
 */
async function getHoldingCurrentValue(
  watchlistTicker: string
): Promise<number | null> {
  const result = await pool.query<{ current_value: string | null }>(
    `SELECT (f.units_held * f.nav) AS current_value
     FROM comparison_watchlist cw
     JOIN funds f ON f.key = cw.funds_table_key
     WHERE cw.ticker = $1 AND cw.is_held = true`,
    [watchlistTicker]
  );

  if (result.rows.length === 0 || result.rows[0].current_value === null) {
    console.warn(
      `[getHoldingCurrentValue] No match found for ${watchlistTicker} — check that comparison_watchlist.funds_table_key is set correctly and matches a real funds.key value.`
    );
    return null;
  }

  return parseFloat(result.rows[0].current_value);
}

function getReturn(
  snapshot: LatestSnapshotRow | undefined,
  period: ReturnPeriod
): number | null {
  if (!snapshot) return null;
  switch (period) {
    case "return_30d": return snapshot.return_30d_percent ?? null;
    case "return_ytd": return snapshot.return_ytd_percent ?? null;
    case "return_1y":  return snapshot.return_1y_percent ?? null;
  }
}

/**
 * Computes a risk tier from OUR OWN math, not from anything FoudaLens
 * scrapes for us — this was a deliberate design choice (see chat history:
 * "I want you to do maths to recommend and use foudalens as second
 * opinion", not the other way around).
 *
 * Method: annualize each of the 3 return periods (30d, YTD, 1Y) to a
 * common yearly rate, then measure how much they disagree with each
 * other (coefficient of variation — stddev / mean of the 3 annualized
 * rates). Large disagreement between periods suggests choppier,
 * less consistent performance — a real, calculable proxy for risk,
 * not a borrowed label. Works identically for funds AND stocks, since
 * both have the same 3 return fields — this was specifically chosen to
 * close the stock risk-data gap (FoudaLens doesn't expose a risk grade
 * for individual stocks).
 *
 * Thresholds (spread as % of mean) are a reasonable starting point, NOT
 * verified against real portfolio outcomes — same caveat as
 * computeSignal()'s win-ratio thresholds. Adjust once you see this
 * against real data.
 */
function computeRiskTier(snapshot: LatestSnapshotRow | undefined): RiskTier | null {
  if (!snapshot) return null;

  const { return_30d_percent, return_ytd_percent, return_1y_percent } = snapshot;
  if (
    return_30d_percent === null ||
    return_ytd_percent === null ||
    return_1y_percent === null
  ) {
    return null; // need all 3 periods for a meaningful consistency measure
  }

  // Annualize each period to a comparable yearly rate.
  // 30-day -> annualized: (1 + r)^(365/30) - 1
  // YTD -> annualized: depends on how far into the year we are; without a
  // reliable "days elapsed" figure from the scraper, we approximate using
  // a mid-year assumption (183/365) — this is a simplification, flagged
  // here rather than hidden, and worth revisiting once real dates are
  // available from the scraper.
  // 1-year is already annualized.
  const annualized30d =
    Math.pow(1 + return_30d_percent / 100, 365 / 30) - 1;
  const annualizedYtd =
    Math.pow(1 + return_ytd_percent / 100, 365 / 183) - 1;
  const annualized1y = return_1y_percent / 100;

  const rates = [annualized30d, annualizedYtd, annualized1y];
  const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length;

  const variance =
    rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
  const stddev = Math.sqrt(variance);

  // FIX (bug #1 from audit): the original guard only caught mean === 0
  // exactly. A very small but nonzero mean (e.g. 0.001) still produces a
  // wildly inflated coefficient of variation (stddev / mean), which would
  // misclassify stable, low-return assets — like a money-market-style
  // fund with tiny but steady gains — as "High" risk, the opposite of
  // reality. Below this floor, the ratio is no longer meaningful, so we
  // fall back to judging risk on the ABSOLUTE spread between periods
  // (stddev alone, in percentage points) instead of a ratio that blows up
  // near zero. The floor (1% annualized) and the absolute thresholds
  // below are reasonable starting points, not verified against real
  // outcomes — same caveat as the coefficient-of-variation thresholds.
  const MEAN_FLOOR = 0.01; // 1% annualized

  if (Math.abs(mean) < MEAN_FLOOR) {
    // Judge on absolute stddev (in percentage points) instead of a ratio.
    const stddevPercentagePoints = stddev * 100;
    if (stddevPercentagePoints < 2) return "Low";
    if (stddevPercentagePoints < 5) return "Medium";
    return "High";
  }

  const coefficientOfVariation = Math.abs(stddev / mean);

  // Thresholds: starting point, not verified — see comment above.
  if (coefficientOfVariation < 0.3) return "Low";
  if (coefficientOfVariation < 0.7) return "Medium";
  return "High";
}

/**
 * Compares our computed risk tier against FoudaLens's own scraped label
 * (funds only — stocks have no such label to compare against). Returns
 * true if they disagree meaningfully (e.g. we say High, FoudaLens says
 * Low) — used to raise a "risk_mismatch" flag rather than silently
 * trusting either source.
 */
function checkRiskMismatch(
  computed: RiskTier | null,
  foudalensLabel: string | null
): boolean {
  if (computed === null || foudalensLabel === null) return false;

  const normalizedLabel = foudalensLabel.toLowerCase();
  const labelTier: RiskTier | null = normalizedLabel.includes("low")
    ? "Low"
    : normalizedLabel.includes("high")
    ? "High"
    : normalizedLabel.includes("medium")
    ? "Medium"
    : null;

  if (labelTier === null) return false; // unrecognized label format, don't flag

  // Only flag a real disagreement (Low vs High), not adjacent tiers
  // (Low vs Medium) — adjacent disagreement is normal measurement noise,
  // not a meaningful conflict worth surfacing.
  const tierOrder: Record<RiskTier, number> = { Low: 0, Medium: 1, High: 2 };
  return Math.abs(tierOrder[computed] - tierOrder[labelTier]) >= 2;
}

/**
 * SECOND OPINIONS — every check here compares OUR computed conclusion
 * against FoudaLens's own data/label on the same question. Our math
 * always runs first and drives the actual decision; these are cross-
 * checks attached afterward, never inputs to the primary win/lose logic
 * or signal calculation. See chat history for the design decision.
 */

function checkSignalSecondOpinion(
  gapPercent: number | null,
  stockSignal: string | null
): SecondOpinionCheck {
  const ourConclusion =
    gapPercent === null
      ? "no data"
      : gapPercent < 0
      ? "beating your holding (by our return math)"
      : "not beating your holding (by our return math)";

  if (stockSignal === null) {
    return {
      our_conclusion: ourConclusion,
      foudalens_data: null,
      agrees: null,
      note: "FoudaLens has no signal data for this entity — nothing to check against.",
    };
  }

  const isPositiveSignal = /buy/i.test(stockSignal);
  // FIX (bug #2 from audit): was named `weBeatThem` but the inline
  // comment and logic both confirmed it actually represents "they're
  // beating us" (gap_percent < 0 means your holding's return is LESS
  // than theirs). The boolean VALUE was always correct — this is a
  // naming fix, not a logic fix — but the inverted name was a real
  // readability/maintenance risk (a future edit "fixing" the confusing
  // name without re-checking the logic could easily flip the actual
  // behavior by accident). Renamed to match the correct, consistent
  // naming already used in checkDividendYieldSecondOpinion and
  // checkMarketCapSecondOpinion (both use `theyBeatUs`).
  const theyBeatUs = gapPercent !== null && gapPercent < 0;
  const agrees = theyBeatUs === isPositiveSignal;

  return {
    our_conclusion: ourConclusion,
    foudalens_data: `Signal: ${stockSignal}`,
    agrees,
    note: agrees
      ? `Our return comparison and FoudaLens's own signal point the same direction.`
      : `Our return comparison and FoudaLens's signal disagree — worth a closer look before acting on either alone.`,
  };
}

/**
 * Compares our own rank-by-return within the group against FoudaLens's
 * Total Score rank within the same group (both funds' Performance Score
 * and stocks' Fouda Score are stored as total_score — same field, same
 * 0-100 scale, treated the same way here).
 */
function checkTotalScoreSecondOpinion(
  entryReturn: number | null,
  entryScore: number | null,
  allReturnsInGroup: (number | null)[],
  allScoresInGroup: (number | null)[]
): SecondOpinionCheck {
  if (entryReturn === null || entryScore === null) {
    return {
      our_conclusion: "no data",
      foudalens_data: entryScore !== null ? `Score: ${entryScore}/100` : null,
      agrees: null,
      note: "Missing return or score data — nothing to check.",
    };
  }

  const validReturns = allReturnsInGroup.filter((r): r is number => r !== null);
  const validScores = allScoresInGroup.filter((s): s is number => s !== null);
  if (validReturns.length < 2 || validScores.length < 2) {
    return {
      our_conclusion: `return of ${entryReturn.toFixed(1)}%`,
      foudalens_data: `Score: ${entryScore}/100`,
      agrees: null,
      note: "Not enough comparable entries in this group to rank against — nothing to check yet.",
    };
  }

  // Is this entry's return in the top half of the group? Is its score also
  // in the top half? Simple rank-agreement check, not a precise correlation.
  const returnRankIsTopHalf =
    validReturns.filter((r) => r > entryReturn).length < validReturns.length / 2;
  const scoreRankIsTopHalf =
    validScores.filter((s) => s > entryScore).length < validScores.length / 2;
  const agrees = returnRankIsTopHalf === scoreRankIsTopHalf;

  return {
    our_conclusion: `return of ${entryReturn.toFixed(1)}% is ${returnRankIsTopHalf ? "top half" : "bottom half"} of this group`,
    foudalens_data: `Score: ${entryScore}/100 (${scoreRankIsTopHalf ? "top half" : "bottom half"} of scores in this group)`,
    agrees,
    note: agrees
      ? "Our return ranking and FoudaLens's score ranking roughly agree."
      : "Our return ranking and FoudaLens's score ranking diverge — the score may be weighing momentum/trend differently than raw return.",
  };
}

function checkSectorRankSecondOpinion(
  entryReturn: number | null,
  entryTicker: string,
  foudalensRank: number | null,
  allEntriesInGroup: { ticker: string; return_percent: number | null }[]
): SecondOpinionCheck {
  if (entryReturn === null || foudalensRank === null) {
    return {
      our_conclusion: "no data",
      foudalens_data: foudalensRank !== null ? `Sector rank #${foudalensRank}` : null,
      agrees: null,
      note: "Missing return or FoudaLens rank data — nothing to check.",
    };
  }

  const validEntries = allEntriesInGroup.filter((e) => e.return_percent !== null);
  if (validEntries.length < 2) {
    return {
      our_conclusion: `return of ${entryReturn.toFixed(1)}%`,
      foudalens_data: `Sector rank #${foudalensRank}`,
      agrees: null,
      note: "Not enough comparable entries to compute our own rank yet.",
    };
  }

  const ourRank =
    validEntries
      .slice()
      .sort((a, b) => (b.return_percent ?? 0) - (a.return_percent ?? 0))
      .findIndex((e) => e.ticker === entryTicker) + 1;

  // Agreement defined loosely: within 2 rank positions of each other,
  // since FoudaLens's rank is sector-wide (all sector stocks) while ours
  // is only within this specific comparison group — exact match isn't
  // realistic, direction/proximity is what's checkable.
  const agrees = Math.abs(ourRank - foudalensRank) <= 2;

  return {
    our_conclusion: `our rank within this group: #${ourRank}`,
    foudalens_data: `FoudaLens sector rank: #${foudalensRank}`,
    agrees,
    note: agrees
      ? "Ranks are reasonably close (FoudaLens ranks across the whole sector, we only rank within this comparison group, so exact match isn't expected)."
      : "Ranks diverge notably — FoudaLens's sector-wide rank may reflect stocks outside this comparison group.",
  };
}

function checkPeRatioSecondOpinion(
  entryReturn: number | null,
  entryPe: number | null,
  allEntriesInGroup: { return_percent: number | null; pe_ratio: number | null }[]
): SecondOpinionCheck {
  if (entryReturn === null || entryPe === null) {
    return {
      our_conclusion: "no data",
      foudalens_data: entryPe !== null ? `P/E: ${entryPe.toFixed(1)}` : null,
      agrees: null,
      note: "Missing return or P/E data — nothing to check.",
    };
  }

  const validPEs = allEntriesInGroup
    .filter((e) => e.pe_ratio !== null)
    .map((e) => e.pe_ratio as number);
  if (validPEs.length < 2) {
    return {
      our_conclusion: `return of ${entryReturn.toFixed(1)}%`,
      foudalens_data: `P/E: ${entryPe.toFixed(1)}`,
      agrees: null,
      note: "Not enough P/E data across the group to compare yet.",
    };
  }

  const isTopReturn = entryReturn === Math.max(...allEntriesInGroup.map((e) => e.return_percent ?? -Infinity));
  const isHighestPE = entryPe === Math.max(...validPEs);

  // This is the actual check: is the best-return entity ALSO the most
  // expensive one (by P/E)? If so, that's worth flagging — the
  // outperformance may already be priced in, not necessarily durable.
  const priceMayBeAheadOfFundamentals = isTopReturn && isHighestPE;

  return {
    our_conclusion: isTopReturn ? "best return in this group" : `return of ${entryReturn.toFixed(1)}%`,
    foudalens_data: `P/E: ${entryPe.toFixed(1)}${isHighestPE ? " (highest in group)" : ""}`,
    agrees: !priceMayBeAheadOfFundamentals, // "agrees" here means: no red flag, the win looks fundamentally supported
    note: priceMayBeAheadOfFundamentals
      ? "This is both the best performer AND the most expensive by P/E in the group — the outperformance may already be priced in."
      : "No P/E-vs-return red flag for this entry.",
  };
}

/**
 * WEAK/SOFT CHECK — flagged as such deliberately (per design discussion:
 * "I want that also to be second opinion" even though there's no strong
 * mathematical case for one). A lower dividend yield on a winning entity
 * means its outperformance is more purely price-dependent, with less
 * income cushion if the price move reverses — directional context, not a
 * hard contradiction the way the P/E or Signal checks are.
 */
function checkDividendYieldSecondOpinion(
  gapPercent: number | null,
  entryYield: number | null,
  holdingYield: number | null
): SecondOpinionCheck {
  if (gapPercent === null || entryYield === null || holdingYield === null) {
    return {
      our_conclusion: "no data",
      foudalens_data: entryYield !== null ? `Dividend yield: ${entryYield.toFixed(1)}%` : null,
      agrees: null,
      note: "Missing data for this comparison — nothing to check. (This check is inherently soft even when data exists — see code comment.)",
    };
  }

  const theyBeatUs = gapPercent < 0;
  const theirYieldIsLower = entryYield < holdingYield;
  const pureySpeculativeWin = theyBeatUs && theirYieldIsLower;

  return {
    our_conclusion: theyBeatUs ? "beating your holding" : "not beating your holding",
    foudalens_data: `Dividend yield: ${entryYield.toFixed(1)}% (yours: ${holdingYield.toFixed(1)}%)`,
    agrees: !pureySpeculativeWin,
    note: pureySpeculativeWin
      ? "This entity is beating you with a lower dividend yield — its return leans more on price appreciation, with less income cushion than your holding. Soft signal, not a hard red flag."
      : "No notable dividend-yield gap on top of the return difference.",
  };
}

function checkMarketCapSecondOpinion(
  gapPercent: number | null,
  entryMarketCap: number | null
): SecondOpinionCheck {
  if (gapPercent === null || entryMarketCap === null) {
    return {
      our_conclusion: "no data",
      foudalens_data: entryMarketCap !== null ? `Market cap: ${entryMarketCap.toLocaleString()} EGP` : null,
      agrees: null,
      note: "Missing data — nothing to check.",
    };
  }

  const theyBeatUs = gapPercent < 0;
  // Threshold is a rough starting point (EGP 5B), not a verified small-cap
  // cutoff for the Egyptian market specifically — adjust once you have a
  // real reference point.
  const isSmallCap = entryMarketCap < 5_000_000_000;
  const smallCapWin = theyBeatUs && isSmallCap;

  return {
    our_conclusion: theyBeatUs ? "beating your holding" : "not beating your holding",
    foudalens_data: `Market cap: ${entryMarketCap.toLocaleString()} EGP${isSmallCap ? " (small-cap)" : ""}`,
    agrees: !smallCapWin,
    note: smallCapWin
      ? "This entity is beating you but is a smaller company — smaller/less liquid stocks can be harder to buy or sell without moving the price, independent of the computed risk tier."
      : "No small-cap liquidity concern flagged for this entry.",
  };
}

function buildGroup(
  groupType: ComparisonGroup["group_type"],
  members: WatchlistRow[],
  snapshots: Map<number, LatestSnapshotRow>,
  holdingReturn: number | null,
  holdingDividendYield: number | null,
  period: ReturnPeriod
): ComparisonGroup {
  const rawEntries = members.map((m) => {
    const snapshot = snapshots.get(m.id);
    const theirReturn = getReturn(snapshot, period);
    const gap =
      holdingReturn !== null && theirReturn !== null
        ? holdingReturn - theirReturn
        : null;
    return { m, snapshot, theirReturn, gap };
  });

  const allReturnsInGroup = rawEntries.map((e) => e.theirReturn);
  const allScoresInGroup = rawEntries.map((e) => e.snapshot?.total_score ?? null);
  const allEntriesForRank = rawEntries.map((e) => ({
    ticker: e.m.ticker,
    return_percent: e.theirReturn,
  }));
  const allEntriesForPe = rawEntries.map((e) => ({
    return_percent: e.theirReturn,
    pe_ratio: e.snapshot?.pe_ratio ?? null,
  }));

  const entries: ComparisonEntry[] = rawEntries.map(({ m, snapshot, theirReturn, gap }) => {
    const computedRisk = computeRiskTier(snapshot);
    const foudalensLabel = snapshot?.risk_level ?? null;

    return {
      ticker: m.ticker,
      name: m.name,
      return_percent: theirReturn,
      gap_percent: gap,
      stock_signal: snapshot?.signal ?? null,
      sector_rank: snapshot?.sector_rank ?? null,
      computed_risk_tier: computedRisk,
      foudalens_risk_level: foudalensLabel,
      risk_mismatch: checkRiskMismatch(computedRisk, foudalensLabel),
      second_opinions: {
        signal: checkSignalSecondOpinion(gap, snapshot?.signal ?? null),
        total_score: checkTotalScoreSecondOpinion(
          theirReturn,
          snapshot?.total_score ?? null,
          allReturnsInGroup,
          allScoresInGroup
        ),
        sector_rank: checkSectorRankSecondOpinion(
          theirReturn,
          m.ticker,
          snapshot?.sector_rank ?? null,
          allEntriesForRank
        ),
        pe_ratio: checkPeRatioSecondOpinion(
          theirReturn,
          snapshot?.pe_ratio ?? null,
          allEntriesForPe
        ),
        dividend_yield: checkDividendYieldSecondOpinion(
          gap,
          snapshot?.dividend_yield_percent ?? null,
          holdingDividendYield
        ),
        market_cap: checkMarketCapSecondOpinion(gap, snapshot?.market_cap ?? null),
      },
    };
  });

  // Sort by return descending, nulls last (unranked — no data yet)
  entries.sort((a, b) => {
    if (a.return_percent === null) return 1;
    if (b.return_percent === null) return -1;
    return b.return_percent - a.return_percent;
  });

  const you_beat_count = entries.filter(
    (e) => e.gap_percent !== null && e.gap_percent > 0
  ).length;
  const you_lose_count = entries.filter(
    (e) => e.gap_percent !== null && e.gap_percent < 0
  ).length;
  const incomplete_count = entries.filter(
    (e) => e.return_percent === null
  ).length;

  return {
    group_type: groupType,
    entries,
    you_beat_count,
    you_lose_count,
    incomplete_count,
  };
}

function computeSignal(
  groups: ComparisonGroup[],
  holdingRiskTier: RiskTier | null
): {
  signal: SignalStrength;
  flags: string[];
} {
  const flags: string[] = [];

  // Count "beating the group overall" as: beat count > lose count within that group
  let groupsWon = 0;
  let groupsWithData = 0;

  for (const group of groups) {
    const totalRanked = group.you_beat_count + group.you_lose_count;
    if (totalRanked === 0) continue; // no usable data in this group
    groupsWithData++;
    if (group.you_beat_count > group.you_lose_count) groupsWon++;
  }

  // RISK PARITY CHECK (per Gemini audit + design discussion: risk tiers
  // are computed by US from return volatility, not scraped — see
  // computeRiskTier()). If a competitor beats you on return but carries
  // meaningfully higher risk, that's not a clean loss — it's a
  // risk-adjusted wash or even a point in your favor. This checks every
  // group for that pattern and raises "risk_mismatch_beat" rather than
  // silently counting it as a loss in the raw beat/lose tallies above
  // (which stay pure-return, unmodified — this flag is an additional
  // signal layered on top, not a rewrite of the win/lose counts).
  const tierOrder: Record<RiskTier, number> = { Low: 0, Medium: 1, High: 2 };
  if (holdingRiskTier !== null) {
    for (const group of groups) {
      const riskMismatchedWins = group.entries.filter(
        (e) =>
          e.gap_percent !== null &&
          e.gap_percent < 0 && // they're beating you on return
          e.computed_risk_tier !== null &&
          tierOrder[e.computed_risk_tier] - tierOrder[holdingRiskTier] >= 1 // meaningfully higher risk
      );
      if (riskMismatchedWins.length > 0) {
        flags.push("risk_mismatch_beat");
        break; // one mention is enough — the flag itself signals to check the data, not which specific group
      }
    }
  }

  // SECOND OPINION DISAGREEMENT CHECK — separate from the risk-specific
  // check above. Looks across all 6 second-opinion categories (signal,
  // total_score, sector_rank, pe_ratio, dividend_yield, market_cap) for
  // any entity that's BEATING you on return AND has 2+ categories where
  // "agrees: false" (a real red flag, not just missing data). This
  // doesn't change the win/lose counts or the Strong/Mixed/Weak signal —
  // it's purely an additional flag so a beat that FoudaLens's own data
  // would also question isn't presented as an unqualified loss.
  let secondOpinionDisagreementFound = false;
  for (const group of groups) {
    for (const entry of group.entries) {
      if (entry.gap_percent === null || entry.gap_percent >= 0) continue; // only check entities beating you
      const checks = Object.values(entry.second_opinions);
      const disagreementCount = checks.filter((c) => c.agrees === false).length;
      if (disagreementCount >= 2) {
        secondOpinionDisagreementFound = true;
        break;
      }
    }
    if (secondOpinionDisagreementFound) break;
  }
  if (secondOpinionDisagreementFound) {
    flags.push("second_opinion_disagreement");
  }

  // FIX (bug #3 from audit): this comment's opening line was lost when
  // the second-opinion disagreement block above was inserted before it,
  // leaving a dangling fragment that read as a continuation of nothing.
  // Restored: specific flags matter more than the raw ratio — check these
  // regardless of overall signal strength, since they answer specific
  // questions you asked for earlier (direct-stock opportunity, benchmark
  // underperformance).
  const directStockGroup = groups.find((g) => g.group_type === "direct_stock");
  if (directStockGroup && directStockGroup.you_lose_count > directStockGroup.you_beat_count) {
    flags.push("losing_to_direct_stock"); // "leaving money on the table" case

    // Stronger version: check if any stock beating you ALSO has a "Buy"
    // signal right now — not just historically better, but currently
    // trending well too. Signal values are unconfirmed (see scraper
    // README) — this checks case-insensitively for "buy" as a substring
    // to be resilient to "Buy" vs "Strong Buy" variants.
    const beatingWithBuySignal = directStockGroup.entries.some(
      (e) =>
        e.gap_percent !== null &&
        e.gap_percent < 0 && // they're beating you
        e.stock_signal !== null &&
        /buy/i.test(e.stock_signal)
    );
    if (beatingWithBuySignal) {
      flags.push("direct_stock_has_buy_signal");
    }
  }

  const benchmarkGroup = groups.find((g) => g.group_type === "benchmark");
  if (benchmarkGroup && benchmarkGroup.you_lose_count > 0) {
    flags.push("losing_to_benchmark"); // worst-case signal — not even beating the plain market
  }

  const managerGroup = groups.find((g) => g.group_type === "manager_sibling");
  if (managerGroup && managerGroup.you_lose_count > managerGroup.you_beat_count) {
    flags.push("manager_underperforming");
  }

  const sectorGroup = groups.find((g) => g.group_type === "sector_sibling");
  if (sectorGroup && sectorGroup.you_lose_count > sectorGroup.you_beat_count) {
    flags.push("sector_pick_weak");
  }

  let signal: SignalStrength;
  if (groupsWithData === 0) {
    signal = "Weak"; // no data at all — treat conservatively, don't claim "Strong" on nothing
    flags.push("insufficient_data");
  } else {
    const winRatio = groupsWon / groupsWithData;
    if (winRatio >= 0.75) signal = "Strong";
    else if (winRatio >= 0.4) signal = "Mixed";
    else signal = "Weak";
  }

  return { signal, flags };
}

/**
 * Produces a full verdict for one holding.
 * @param period which return window to compare on — defaults to 1-year,
 * since that's the most stable signal for a rotate/hold decision (30-day
 * is noisier, per the earlier "why not scrape daily" discussion).
 */
export async function judgeHolding(
  holdingTicker: string,
  period: ReturnPeriod = "return_1y"
): Promise<HoldingVerdict> {
  const watchlist = await getWatchlist();
  const snapshots = await getLatestSnapshots();

  const holding = watchlist.find((w) => w.ticker === holdingTicker && w.is_held);
  if (!holding) {
    throw new Error(
      `[judgeHolding] "${holdingTicker}" not found in watchlist, or is_held=false. Check comparison_watchlist.`
    );
  }

  const holdingReturn = getReturn(snapshots.get(holding.id), period);
  const holdingRiskTier = computeRiskTier(snapshots.get(holding.id));
  const holdingDividendYield = snapshots.get(holding.id)?.dividend_yield_percent ?? null;

  // FIX (caught via Gemini audit): previously, sectorSiblings excluded
  // same-manager funds and managerSiblings excluded same-sector funds —
  // meaning a fund that happened to share BOTH your sector AND your
  // manager would be excluded from every group and silently never
  // compared. Doesn't happen with the current 19-fund watchlist (no
  // manager has two funds in the same sector yet), but was a real
  // structural gap. Now both groups include exact-match entities;
  // membership is just "peer on this axis", not mutual exclusivity.
  const sectorSiblings = watchlist.filter(
    (w) =>
      w.entity_type === "fund" &&
      w.sector === holding.sector &&
      w.ticker !== holding.ticker
  );

  const managerSiblings = watchlist.filter(
    (w) =>
      w.entity_type === "fund" &&
      w.manager === holding.manager &&
      w.ticker !== holding.ticker
  );

  const directStocks = watchlist.filter(
    (w) => w.entity_type === "stock" && w.sector === holding.sector
  );

  const benchmarks = watchlist.filter((w) => w.entity_type === "index");

  const groups: ComparisonGroup[] = [
    buildGroup("sector_sibling", sectorSiblings, snapshots, holdingReturn, holdingDividendYield, period),
    buildGroup("manager_sibling", managerSiblings, snapshots, holdingReturn, holdingDividendYield, period),
    buildGroup("direct_stock", directStocks, snapshots, holdingReturn, holdingDividendYield, period),
    buildGroup("benchmark", benchmarks, snapshots, holdingReturn, holdingDividendYield, period),
  ];

  const { signal, flags } = computeSignal(groups, holdingRiskTier);

  const totalEntries = groups.reduce((sum, g) => sum + g.entries.length, 0);
  const totalIncomplete = groups.reduce((sum, g) => sum + g.incomplete_count, 0);
  const data_completeness_warning =
    totalEntries > 0 && totalIncomplete / totalEntries > 0.3; // >30% missing data

  const currentValue = await getHoldingCurrentValue(holding.ticker);

  return {
    holding_ticker: holding.ticker,
    holding_name: holding.name,
    holding_return_percent: holdingReturn,
    holding_current_value_egp: currentValue,
    holding_risk_tier: holdingRiskTier,
    return_period: period,
    groups,
    signal,
    flags,
    data_completeness_warning,
  };
}

/** Runs judgeHolding() for every held entity in the watchlist. */
export async function judgeAllHoldings(
  period: ReturnPeriod = "return_1y"
): Promise<HoldingVerdict[]> {
  const watchlist = await getWatchlist();
  // Derive "held" from the live funds table rather than the static is_held flag:
  // a fund counts as held iff it has a funds_table_key link AND units_held > 0.
  const heldResult = await pool.query<{ ticker: string }>(
    `SELECT cw.ticker
       FROM comparison_watchlist cw
       JOIN funds f ON f.key = cw.funds_table_key
      WHERE cw.funds_table_key IS NOT NULL
        AND f.units_held > 0`
  );
  const heldTickers = heldResult.rows.map((r) => r.ticker);

  const verdicts: HoldingVerdict[] = [];
  for (const ticker of heldTickers) {
    verdicts.push(await judgeHolding(ticker, period));
  }
  return verdicts;
}
