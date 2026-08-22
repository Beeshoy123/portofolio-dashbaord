// Comparison Judge — shared types

export type EntityType = "fund" | "stock" | "index";

export interface WatchlistEntity {
  id: number;
  ticker: string;
  name: string;
  entity_type: EntityType;
  source_code: string | null; // FoudaLens fund code e.g. MUB-6203 (funds only)
  sector: string;
  manager: string | null;
  is_held: boolean;
  yahoo_ticker?: string | null;
}

export interface ScrapedSnapshot {
  watchlist_id: number;
  nav_or_price: number | null;
  return_30d_percent: number | null;
  return_60d_percent?: number | null;
  return_ytd_percent: number | null;
  return_1y_percent: number | null;
  cagr_percent: number | null;
  total_score: number | null;
  risk_level: string | null;
  // Added: confirmed available via FoudaLens's platform FAQ, stocks only.
  // Funds/indices leave these null.
  signal: string | null; // exact values UNCONFIRMED — log and inspect on first real run
  pe_ratio: number | null;
  dividend_yield_percent: number | null;
  market_cap: number | null;
  sector_rank: number | null;
  raw_fetch_ok: boolean;
}
