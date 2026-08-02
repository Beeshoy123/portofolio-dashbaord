-- Comparison Judge: storage for scraped fund/stock/index data
-- Run this once against your existing Postgres (Replit) database.

CREATE TABLE IF NOT EXISTS "comparison_watchlist" (
	"id" serial PRIMARY KEY,
	"ticker" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"entity_type" text NOT NULL,      -- 'fund' | 'stock' | 'index'
	"source_code" text,               -- FoudaLens code, e.g. MUB-6203 (null for stocks/indices)
	"sector" text NOT NULL,           -- e.g. 'Real Estate', 'Banks/Financial'
	"manager" text,                   -- e.g. 'Beltone', 'CI Capital' (funds only)
	"is_held" boolean NOT NULL DEFAULT false,  -- true if this is one of your actual holdings
	"funds_table_key" text            -- links to your existing funds.key, only set when is_held = true
);

CREATE TABLE IF NOT EXISTS "comparison_snapshots" (
	"id" serial PRIMARY KEY,
	"watchlist_id" integer NOT NULL REFERENCES "comparison_watchlist"("id"),
	"scraped_at" timestamp with time zone NOT NULL DEFAULT now(),
	"nav_or_price" numeric(14, 4),
	"return_30d_percent" numeric(8, 4),
	"return_ytd_percent" numeric(8, 4),
	"return_1y_percent" numeric(8, 4),
	"cagr_percent" numeric(8, 4),
	"total_score" numeric(5, 2),
	"risk_level" text,
	"signal" text,
	"pe_ratio" numeric(10, 2),
	"dividend_yield_percent" numeric(6, 2),
	"market_cap" numeric(18, 2),
	"sector_rank" integer,
	"raw_fetch_ok" boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "idx_snapshots_watchlist_id" ON "comparison_snapshots" ("watchlist_id");
CREATE INDEX IF NOT EXISTS "idx_snapshots_scraped_at" ON "comparison_snapshots" ("scraped_at");
CREATE UNIQUE INDEX IF NOT EXISTS "idx_watchlist_ticker" ON "comparison_watchlist" ("ticker");
