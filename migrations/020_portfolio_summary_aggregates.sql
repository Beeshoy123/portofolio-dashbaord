-- Migration: Add aggregate columns to portfolio_summaries
-- Stores flagged_count, avg_coverage_percent, reversal_risk_count, divergence_count

ALTER TABLE "portfolio_summaries"
ADD COLUMN IF NOT EXISTS "flagged_count" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "avg_coverage_percent" numeric,
ADD COLUMN IF NOT EXISTS "reversal_risk_count" integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS "divergence_count" integer DEFAULT 0;

