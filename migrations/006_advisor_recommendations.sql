-- Smart Advisor: storage for AI-generated recommendations
-- Run this migration after 005_yahoo_ticker_mapping.sql

CREATE TABLE IF NOT EXISTS "advisor_recommendations" (
	"id" serial PRIMARY KEY,
	"watchlist_id" integer NOT NULL REFERENCES "comparison_watchlist"("id") ON DELETE CASCADE,
	"recommendation_text" text NOT NULL,
	"model_used" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast lookups by ticker (via watchlist_id)
CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_watchlist_generated" 
ON "advisor_recommendations"("watchlist_id", "generated_at" DESC);

-- Index for time-based queries (latest recommendations)
CREATE INDEX IF NOT EXISTS "idx_advisor_recommendations_generated_at" 
ON "advisor_recommendations"("generated_at" DESC);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_advisor_recommendations_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_advisor_recommendations_timestamp ON "advisor_recommendations";
CREATE TRIGGER update_advisor_recommendations_timestamp
  BEFORE UPDATE ON "advisor_recommendations"
  FOR EACH ROW
  EXECUTE FUNCTION update_advisor_recommendations_timestamp();
