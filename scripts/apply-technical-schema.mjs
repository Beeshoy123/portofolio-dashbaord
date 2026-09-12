import { Client } from 'pg';

const conn = 'postgresql://postgres.gcyuahzdvaodrqijjqba:Bosha%40061096@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const client = new Client({ connectionString: conn });

const sql = `
ALTER TABLE technical_signals
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS failure_reason text;

CREATE INDEX IF NOT EXISTS idx_technical_signals_data_source
ON technical_signals (run_id, data_source)
WHERE data_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_technical_signals_failure_reason
ON technical_signals (run_id, failure_reason)
WHERE failure_reason IS NOT NULL;
`;

try {
  await client.connect();
  await client.query(sql);
  console.log('Applied technical_signals metadata migration successfully.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
