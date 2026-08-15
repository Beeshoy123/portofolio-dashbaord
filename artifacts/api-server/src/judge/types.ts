// Comparison Judge Types
// Core data structures for portfolio comparison verdicts and alert system

export interface ComparisonEntry {
  name: string;
  ticker: string;
  return_percent: number | null;
  sector_rank: number | null;
  stock_signal: string | null;
  computed_risk_tier: "Low" | "Medium" | "High" | null;
  foudalens_risk_level: string | null;
  risk_mismatch: boolean;
  gap_percent: number | null;
}

export interface ComparisonGroup {
  group_type: "sector_sibling" | "manager_sibling" | "direct_stock" | "benchmark";
  entries: ComparisonEntry[];
}

export interface HoldingVerdict {
  holding_ticker: string;
  holding_name: string;
  holding_return_percent: number | null;
  holding_current_value_egp: number | null;
  holding_risk_tier: "Low" | "Medium" | "High" | null;
  return_period: "return_1y" | "return_6m" | "return_3m";
  groups: ComparisonGroup[];
  signal: "Strong" | "Mixed" | "Weak";
  flags: string[];
  data_completeness_warning: boolean;
}
