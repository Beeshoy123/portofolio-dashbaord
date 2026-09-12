import { Client } from 'pg';

const conn = 'postgresql://postgres.gcyuahzdvaodrqijjqba:Bosha%40061096@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const client = new Client({ connectionString: conn });

try {
  await client.connect();
  const res = await client.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'technical_signals' ORDER BY ordinal_position"
  );
  console.log(JSON.stringify(res.rows, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
