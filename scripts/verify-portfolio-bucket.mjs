import { Client } from 'pg';
import { readFileSync } from 'fs';

const connectionString = 'postgresql://postgres.gcyuahzdvaodrqijjqba:Bosha%40061096@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const client = new Client({ connectionString });

try {
  await client.connect();
  const migrationSql = readFileSync('migrations/026_add_portfolio_bucket.sql', 'utf8');
  try {
    await client.query(migrationSql);
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (!message.includes('already exists') && !message.includes('already exists')) {
      throw error;
    }
  }

  const result = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'comparison_watchlist' AND column_name = 'portfolio_bucket'"
  );

  console.log(JSON.stringify({ rows: result.rows, columnExists: result.rows.length > 0 }));
} finally {
  await client.end();
}
