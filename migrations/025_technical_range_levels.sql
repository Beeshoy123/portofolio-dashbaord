-- Store descriptive recent range levels from Chart Reader.
ALTER TABLE technical_signals
  ADD COLUMN IF NOT EXISTS recent_high numeric,
  ADD COLUMN IF NOT EXISTS recent_low numeric,
  ADD COLUMN IF NOT EXISTS range_position_percent numeric;