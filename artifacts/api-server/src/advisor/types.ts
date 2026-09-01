// Smart Advisor — types

export interface AdvisorRecommendation {
  holding_ticker: string;
  recommendation_text: string; // the full Gemini-generated response
  generated_at: string; // ISO timestamp
  model_used: string;
  structured: {
    /** 4-state action vocabulary.
     *  consider_entry    — unheld entity worth researching
     *  consider_rotation — held entity losing to a specific named alternative
     *  watch_and_wait    — default when data quality or flags reduce certainty
     *  hold              — Strong/Mixed signal, no conflicting flags
     */
    decision: "consider_entry" | "consider_rotation" | "watch_and_wait" | "hold";
    confidence: number;
    summary: string;
    thesis_risk: string;
    evidence: string[];
    risks: string[];
    next_review_days: number;
    /** Non-empty when decision is watch_and_wait or consider_rotation.
     *  Contains one concrete, checkable condition grounded in the DATA block.
     *  Empty string "" when decision is consider_entry or hold. */
    watch_trigger: string;
    /** Non-empty when decision is watch_and_wait or hold.
     *  Contains 1-3 reasons NOT to act yet, grounded in the DATA block.
     *  Empty array [] when decision is consider_entry or consider_rotation. */
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
