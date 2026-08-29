// Comparison Judge Types
// Core data structures for portfolio comparison verdicts and alert system

import type { FundamentalsSnapshot } from "./fundamentalsTypes";

export type AssetRole =
  | "money_market_reserve"
  | "income_fund"
  | "growth_fund"
  | "commodity_fund"
  | "real_estate_fund"
  | "stock"
  | "benchmark";

export interface TechnicalSignal {
  candle_date: string | null;
  trend: "uptrend" | "downtrend" | "sideways" | "unknown";
  patterns: Array<{ name: string; date: string; direction: "bullish" | "bearish" | "neutral" }>;
  confidence: number | null;
  raw_fetch_ok: boolean;
  reversal_risk: "none" | "watch" | "elevated";
}

export interface ComparisonEntry {
  name: string;
  ticker: string;
  asset_role: AssetRole;
  return_percent: number | null;
  sector_rank: number | null;
  stock_signal: string | null;
  computed_risk_tier: "Low" | "Medium" | "High" | null;
  foudalens_risk_level: string | null;
  risk_mismatch: boolean;
  gap_percent: number | null;
  fundamentals: FundamentalsSnapshot | null;
}

export interface ComparisonGroup {
  group_type: "sector_sibling" | "manager_sibling" | "direct_stock" | "benchmark";
  entries: ComparisonEntry[];
  you_beat_count: number;
  you_lose_count: number;
  incomplete_count: number;
}

export interface HoldingVerdict {
  holding_ticker: string;
  holding_name: string;
  holding_asset_role: AssetRole;
  holding_return_percent: number | null;
  holding_current_value_egp: number | null;
  holding_risk_tier: "Low" | "Medium" | "High" | null;
  technical_signal: TechnicalSignal | null;
  is_held: boolean;
  data_quality: {
    holding_snapshot_status: "fresh" | "stale" | "missing" | "failed";
    holding_snapshot_age_hours: number | null;
    comparable_count: number;
    comparable_with_return_count: number;
  };
  return_period: "return_1y" | "return_6m" | "return_3m";
  groups: ComparisonGroup[];
  signal: "Strong" | "Mixed" | "Weak" | "Insufficient Data";
  coverage_percent: number | null;
  flags: string[];
  data_completeness_warning: boolean;
  fundamentals_flags_found: boolean;
}
