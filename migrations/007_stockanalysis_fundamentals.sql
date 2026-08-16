-- Comparison Judge: fundamentals data from stockanalysis.com
--
-- Replaces the dead-end Yahoo Finance enrichment (enrichReturnsFromYahoo.ts
-- always wrote NULL for return_30d/ytd/1y — see that file's TODO). This
-- adds a dedicated table for fundamentals instead of bolting more columns
-- onto comparison_snapshots, since these are a different shape of data
-- (point-in-time company fundamentals, not a price snapshot) and only
-- apply to entity_type = 'stock'.
--
-- Run this after migration 006.

CREATE TABLE IF NOT EXISTS "stock_fundamentals" (
	"id" serial PRIMARY KEY,
	"watchlist_id" integer NOT NULL REFERENCES "comparison_watchlist"("id"),
	"fetched_at" timestamp with time zone NOT NULL DEFAULT now(),

	-- Overview page
	"price" numeric(14, 4),
	"price_change_percent" numeric(8, 4),
	"market_cap" numeric(20, 2),
	"revenue_ttm" numeric(20, 2),
	"revenue_growth_percent" numeric(8, 4),
	"net_income" numeric(20, 2),
	"net_income_growth_percent" numeric(8, 4),
	"eps" numeric(10, 4),
	"eps_growth_percent" numeric(8, 4),
	"shares_out" numeric(20, 2),
	"pe_ratio" numeric(10, 2),
	"forward_pe" numeric(10, 2),
	"dividend_yield_percent" numeric(6, 2),
	"dividend_per_share" numeric(10, 4),
	"ex_dividend_date" text,
	"volume" numeric(18, 2),
	"week52_low" numeric(14, 4),
	"week52_high" numeric(14, 4),
	"beta" numeric(6, 3),
	"analyst_rating" text,
	"price_target" numeric(14, 4),
	"price_target_upside_percent" numeric(8, 4),
	"earnings_date" text,

	-- Statistics page
	"debt_to_equity" numeric(10, 4),
	"current_ratio" numeric(10, 4),
	"roe_percent" numeric(8, 4),
	"roic_percent" numeric(8, 4),
	"cash_on_hand" numeric(20, 2),
	"total_debt" numeric(20, 2),
	"net_cash_position" numeric(20, 2),
	"operating_cash_flow" numeric(20, 2),
	"capex" numeric(20, 2),
	"free_cash_flow" numeric(20, 2),
	"gross_margin_percent" numeric(8, 4),
	"operating_margin_percent" numeric(8, 4),
	"net_margin_percent" numeric(8, 4),
	"ev_to_ebitda" numeric(10, 2),
	"ev_to_fcf" numeric(10, 2),
	"shares_change_percent" numeric(8, 4),

	"raw_fetch_ok" boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "idx_fundamentals_watchlist_id" ON "stock_fundamentals" ("watchlist_id");
CREATE INDEX IF NOT EXISTS "idx_fundamentals_fetched_at" ON "stock_fundamentals" ("fetched_at");

-- Yahoo cleanup: yahoo_ticker column (migration 005) is no longer read by
-- any code after this change. Left in place rather than dropped — it's
-- harmless dead data, and dropping it isn't necessary for this migration
-- to work. Drop it yourself later if you want, once you've confirmed
-- nothing else references it:
--   ALTER TABLE comparison_watchlist DROP COLUMN yahoo_ticker;
