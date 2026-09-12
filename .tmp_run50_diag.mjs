import { readFileSync } from "node:fs";
import { Client } from "pg";

const secretLines = readFileSync(".secrets/api-server.env", "utf8").split(/\r?\n/);
const databaseUrl = secretLines.find((line) => line.startsWith("DATABASE_URL="))?.slice("DATABASE_URL=".length);
if (!databaseUrl) throw new Error("DATABASE_URL is missing");
const client = new Client({ connectionString: databaseUrl });
try {
  await client.connect();
  const run = await client.query("SELECT id, status, stage_counts, stage_errors FROM bot_runs WHERE id = 50");
  const technical = await client.query("SELECT count(*)::int AS count FROM technical_signals WHERE run_id = 50");
  const advisor = await client.query("SELECT generation_status, error_message, count(*)::int AS count FROM advisor_recommendations WHERE run_id = 50 GROUP BY generation_status, error_message ORDER BY generation_status");
  console.log(JSON.stringify({ run: run.rows[0] ?? null, technical: technical.rows[0], advisor: advisor.rows }, null, 2));
} finally {
  await client.end();
}
