// Comparison Judge — Fundamentals extension to types.ts
//
// Adds fundamentals-derived types alongside the existing ComparisonEntry/
// HoldingVerdict shapes (judge/types.ts), without touching the existing
// fields. Merge this into judge/types.ts by hand (see integration notes
// in the Replit prompt) rather than replacing the file wholesale — the
// existing SecondOpinionCheck/ComparisonEntry/ComparisonGroup/HoldingVerdict
// interfaces are unchanged.

/**
 * A concern flagged from stock_fundamentals data (stockanalysis.com),
 * attached to a ComparisonEntry the same way the existing second_opinions
 * checks are — a CROSS-CHECK against the primary return-based win/lose
 * math, never an input to it. Distinct from SecondOpinionCheck because
 * fundamentals don't have a FoudaLens equivalent to "agree/disagree"
 * with — there's no existing FoudaLens P/E-vs-debt judgment to check our
 * conclusion against. This is new information Comparison Judge didn't
 * have before, not a second opinion on existing information.
 *
 * Deliberately conservative: only flags fundamentals that are commonly
 * treated as genuine red flags (see FUNDAMENTALS_FLAG_THRESHOLDS below),
 * not a full valuation model. A stock can have no fundamentals_flags and
 * still be a bad pick for reasons outside these checks — this narrows
 * false confidence, it doesn't replace judgment.
 */
export interface FundamentalsFlag {
  flag: string; // e.g. "high_debt_load", "negative_free_cash_flow", "earnings_growth_from_fx_not_operations"
  detail: string; // plain description with the actual number, e.g. "Debt/Equity 2.4 (elevated)"
}

export interface FundamentalsSnapshot {
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
  shares_change_percent: number | null; // dilution signal
  flags: FundamentalsFlag[];
}
