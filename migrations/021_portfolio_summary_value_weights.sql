-- Migration: Add value-weighted percentage columns to portfolio_summaries
-- Stores strong_value_percent, mixed_value_percent, weak_value_percent, insufficient_value_percent

ALTER TABLE "portfolio_summaries"
ADD COLUMN IF NOT EXISTS "strong_value_percent" numeric,
ADD COLUMN IF NOT EXISTS "mixed_value_percent" numeric,
ADD COLUMN IF NOT EXISTS "weak_value_percent" numeric,
ADD COLUMN IF NOT EXISTS "insufficient_value_percent" numeric;

