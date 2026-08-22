-- FoudaLens exposes a 60-session movement for indices, not an exact 30-day return.
ALTER TABLE comparison_snapshots
  ADD COLUMN IF NOT EXISTS return_60d_percent numeric(8, 4);
