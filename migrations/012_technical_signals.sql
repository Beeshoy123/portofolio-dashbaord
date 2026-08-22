-- AI Bot technical-analysis stage: latest candlestick/trend evidence per run.
CREATE TABLE IF NOT EXISTS technical_signals (
  id serial PRIMARY KEY,
  watchlist_id integer NOT NULL REFERENCES comparison_watchlist(id) ON DELETE CASCADE,
  run_id integer NOT NULL REFERENCES bot_runs(id) ON DELETE CASCADE,
  candle_date date,
  trend text NOT NULL DEFAULT 'unknown',
  patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence numeric(5,4),
  raw_fetch_ok boolean NOT NULL DEFAULT false,
  candles jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (watchlist_id, run_id)
);
CREATE INDEX IF NOT EXISTS idx_technical_signals_run ON technical_signals(run_id, watchlist_id);
ALTER TABLE technical_signals ADD COLUMN IF NOT EXISTS candles jsonb NOT NULL DEFAULT '[]'::jsonb;
