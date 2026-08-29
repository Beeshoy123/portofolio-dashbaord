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
