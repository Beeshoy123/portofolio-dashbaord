-- Alert System history used by Time Stop, Thesis Check, and Drawdown.
-- Run after the comparison snapshot and portfolio tables exist.

CREATE TABLE IF NOT EXISTS "verdict_history" (
  "id" serial PRIMARY KEY,
  "watchlist_id" integer NOT NULL REFERENCES "comparison_watchlist"("id") ON DELETE CASCADE,
  "signal" text NOT NULL,
  "flags" text[] NOT NULL DEFAULT '{}',
  "return_percent" numeric(8, 4),
  "raw_verdict" jsonb,
  "recorded_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_verdict_history_watchlist_time"
  ON "verdict_history" ("watchlist_id", "recorded_at");

CREATE TABLE IF NOT EXISTS "portfolio_value_history" (
  "id" serial PRIMARY KEY,
  "total_cost_basis" numeric(14, 2) NOT NULL,
  "total_market_value" numeric(14, 2) NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_portfolio_value_history_time"
  ON "portfolio_value_history" ("recorded_at");
