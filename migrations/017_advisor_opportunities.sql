-- Smart Advisor: storage for opportunities analysis
-- Stores portfolio-level opportunities like strong unheld entities and sector gaps

CREATE TABLE IF NOT EXISTS "advisor_opportunities" (
	"id" serial PRIMARY KEY,
	"watchlist_id" integer NOT NULL REFERENCES "comparison_watchlist"("id") ON DELETE CASCADE,
	"run_id" bigint REFERENCES "bot_runs"("id") ON DELETE CASCADE,
	"opportunity_text" text NOT NULL,
	"model_used" text NOT NULL,
	"opportunity_type" text NOT NULL DEFAULT 'strong_unheld',
	"generated_at" timestamp with time zone NOT NULL DEFAULT now(),
	UNIQUE ("watchlist_id", "run_id", "opportunity_type")
);

-- Index for fast lookups by watchlist and run
CREATE INDEX IF NOT EXISTS "idx_advisor_opportunities_watchlist_run" 
ON "advisor_opportunities"("watchlist_id", "run_id", "generated_at" DESC);

-- Index for fast lookups by run ID (to fetch all opportunities for a run)
CREATE INDEX IF NOT EXISTS "idx_advisor_opportunities_run_id" 
ON "advisor_opportunities"("run_id", "generated_at" DESC);

-- Index for filtering by opportunity type
CREATE INDEX IF NOT EXISTS "idx_advisor_opportunities_type"
ON "advisor_opportunities"("opportunity_type")
WHERE "opportunity_type" IS NOT NULL;
