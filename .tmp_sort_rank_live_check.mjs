import { Client } from 'pg';
import fs from 'node:fs';

const url = 'postgresql://postgres.gcyuahzdvaodrqijjqba:Bosha%40061096@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';
const client = new Client({ connectionString: url });

async function main() {
  try {
    await client.connect();
    await client.query('ALTER TABLE "advisor_opportunities" ADD COLUMN IF NOT EXISTS "sort_rank" integer;');
    await client.query('CREATE INDEX IF NOT EXISTS "idx_advisor_opportunities_sort_rank" ON "advisor_opportunities" ("run_id", "sort_rank" ASC) WHERE "sort_rank" IS NOT NULL;');
    const rows = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'advisor_opportunities' AND column_name = 'sort_rank'");
    const payload = { rows: rows.rows, applied: true };
    fs.writeFileSync('.tmp_sort_rank_live_check.json', JSON.stringify(payload, null, 2));
    console.log(JSON.stringify(payload));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
