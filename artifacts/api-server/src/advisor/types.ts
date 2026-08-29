// Smart Advisor — types

export interface AdvisorRecommendation {
  holding_ticker: string;
  recommendation_text: string; // the full Gemini-generated response
  generated_at: string; // ISO timestamp
  model_used: string;
  structured: {
    decision: "consider_entry" | "consider_rotation" | "watch_and_wait" | "hold";
    confidence: number;
    summary: string;
    evidence: string[];
    risks: string[];
    next_review_days: number;
    watch_trigger: string;
    do_not_act_reasons: string[];
  };
}

/**
 * Structured output for the portfolio-level Gemini call — mirrors the shape of
 * AdvisorRecommendation['structured'] but uses portfolio-appropriate decision values.
 * "hold"      — portfolio composition looks fine overall; no changes needed.
 * "watch"     — something (a specific holding, sector concentration, or reversal-risk
 *               cluster) deserves attention but doesn't require action yet.
 * "rebalance" — allocation is meaningfully skewed; size-weighted data or shared risk
 *               exposures signal that redistribution across holdings deserves attention.
 */
export interface PortfolioSummaryResult {
  decision: "hold" | "watch" | "rebalance";
  confidence: number;
  summary: string;
  evidence: string[];
  risks: string[];
  next_review_days: number;
  model_used: string;
}
