// Comparison Judge — types

export type SignalStrength = "Strong" | "Mixed" | "Weak";
export type RiskTier = "Low" | "Medium" | "High";

/**
 * A "second opinion" verdict — did OUR computed conclusion agree or
 * disagree with FoudaLens's own data/label on this same question? Every
 * one of these is deliberately a CROSS-CHECK, not an input to the primary
 * decision. Our own math always drives the actual comparison; FoudaLens's
 * versions are checked against it afterward. See chat history: "I want
 * that also to be second opinion... make comparison loop those [fields]
 * and then contrast decision against foudalens."
 */
export interface SecondOpinionCheck {
  our_conclusion: string; // plain description of what our math says, e.g. "ahead" / "higher P/E than peers"
  foudalens_data: string | null; // the raw FoudaLens value being checked against, e.g. "Signal: Buy" — null if not available
  agrees: boolean | null; // null = no FoudaLens data to compare against, can't evaluate agreement
  note: string; // plain-language explanation of the check, shown regardless of agreement
}

export interface ComparisonEntry {
  ticker: string;
  name: string;
  return_percent: number | null; // the return period being compared (e.g. 1Y)
  gap_percent: number | null; // your_return - their_return, positive = you're ahead
  // Context fields — stocks only (funds/indices leave these null).
  // Not used in win/lose math, shown alongside the numbers for context.
  stock_signal: string | null; // e.g. "Buy", "Hold", "Sell" — exact values unconfirmed, see scraper README
  sector_rank: number | null;
  // Risk fields — computed by US from return volatility across 30d/YTD/1Y,
  // not scraped. Works for both funds and stocks since both have the same
  // 3 return fields. See computeRiskTier() in comparisonJudge.ts.
  computed_risk_tier: RiskTier | null;
  foudalens_risk_level: string | null; // funds only — scraped label, used as a cross-check, not the primary measure
  risk_mismatch: boolean; // true if our computed tier disagrees with FoudaLens's own label (funds only, where both exist)
  // Second-opinion checks — every one of FoudaLens's own "judgments"
  // (not raw facts) checked against our own computed conclusion.
  second_opinions: {
    signal: SecondOpinionCheck; // FoudaLens's Buy/Sell call vs our gap_percent direction
    total_score: SecondOpinionCheck; // FoudaLens's 0-100 score ranking vs our return ranking within the group
    sector_rank: SecondOpinionCheck; // FoudaLens's stated rank vs our own rank-by-return within the sector_sibling group
    pe_ratio: SecondOpinionCheck; // high P/E + weak return vs our winner's P/E — is outperformance possibly already priced in
    dividend_yield: SecondOpinionCheck; // WEAK/SOFT CHECK — see comparisonJudge.ts comment. Lower yield on a winner = more purely price-dependent, less income cushion
    market_cap: SecondOpinionCheck; // flags if a beating stock is small/micro-cap — inherently higher liquidity risk regardless of computed_risk_tier
  };
}

export interface ComparisonGroup {
  group_type: "sector_sibling" | "manager_sibling" | "direct_stock" | "benchmark";
  entries: ComparisonEntry[]; // sorted by return_percent descending
  you_beat_count: number;
  you_lose_count: number;
  incomplete_count: number; // entries with no return data (scraper gap)
}

export interface HoldingVerdict {
  holding_ticker: string;
  holding_name: string;
  holding_return_percent: number | null;
  holding_current_value_egp: number | null; // from funds.cost_basis_total-derived current value — see comparisonJudge.ts for exact source
  holding_risk_tier: RiskTier | null;
  return_period: "return_30d" | "return_ytd" | "return_1y";
  groups: ComparisonGroup[];
  signal: SignalStrength;
  flags: string[]; // e.g. "losing_to_direct_stock", "losing_to_benchmark", "risk_mismatch_beat", "second_opinion_disagreement" (see comparisonJudge.ts)
  data_completeness_warning: boolean; // true if too many entries had no data
}
