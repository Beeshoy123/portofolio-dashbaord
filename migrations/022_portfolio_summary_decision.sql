-- Migration: Add decision-structured output columns to portfolio_summaries
-- Mirrors the exact column pattern already used in advisor_recommendations
-- (see migration 014_advisor_structured_output.sql), so both per-entity and
-- portfolio-level advisor outputs share the same structured shape.

ALTER TABLE "portfolio_summaries"
ADD COLUMN IF NOT EXISTS "decision" text,
ADD COLUMN IF NOT EXISTS "confidence" integer,
ADD COLUMN IF NOT EXISTS "evidence" jsonb,
ADD COLUMN IF NOT EXISTS "risks" jsonb,
ADD COLUMN IF NOT EXISTS "next_review_days" integer;

-- Index for filtering/sorting portfolio summaries by decision type and confidence
CREATE INDEX IF NOT EXISTS "idx_portfolio_summaries_decision_confidence"
ON "portfolio_summaries"("decision", "confidence" DESC)
WHERE "decision" IS NOT NULL;
