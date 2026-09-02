-- Migration: Store portfolio summary buckets for the five final grid labels
-- Legacy strong/mixed/weak columns remain for historical compatibility.

ALTER TABLE "portfolio_summaries"
ADD COLUMN IF NOT EXISTS "excellent_count" integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "solid_count" integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "caution_count" integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "avoid_count" integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "excellent_value_percent" numeric,
ADD COLUMN IF NOT EXISTS "solid_value_percent" numeric,
ADD COLUMN IF NOT EXISTS "caution_value_percent" numeric,
ADD COLUMN IF NOT EXISTS "avoid_value_percent" numeric;

ALTER TABLE "portfolio_summaries"
ALTER COLUMN "strong_count" DROP NOT NULL,
ALTER COLUMN "mixed_count" DROP NOT NULL,
ALTER COLUMN "weak_count" DROP NOT NULL;
