-- Add Chart Reader metadata columns for data-source tracking and failure diagnostics.
ALTER TABLE technical_signals
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS failure_reason text;

CREATE INDEX IF NOT EXISTS idx_technical_signals_data_source
ON technical_signals (run_id, data_source)
WHERE data_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_technical_signals_failure_reason
ON technical_signals (run_id, failure_reason)
WHERE failure_reason IS NOT NULL;
