-- Add reversal_risk column to technical_signals table
-- Stores deterministic reversal risk assessment based on trend + pattern direction
-- Values: "none" (default), "watch" (uptrend with neutral patterns), "elevated" (uptrend with bearish patterns)

ALTER TABLE "technical_signals"
ADD COLUMN "reversal_risk" text DEFAULT 'none';

-- Index for quick filtering by reversal risk
CREATE INDEX IF NOT EXISTS "idx_technical_signals_reversal_risk"
ON "technical_signals"("reversal_risk")
WHERE "reversal_risk" IN ('watch', 'elevated');

-- Index for combined queries: finding watches and elevated risks by run
CREATE INDEX IF NOT EXISTS "idx_technical_signals_run_reversal"
ON "technical_signals"("run_id", "reversal_risk")
WHERE "reversal_risk" != 'none';
