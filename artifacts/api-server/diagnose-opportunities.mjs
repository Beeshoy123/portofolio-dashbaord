import fs from 'node:fs';
import path from 'node:path';
import { config } from 'dotenv';

const envCandidates = [
  path.resolve(process.cwd(), '../../.secrets/api-server.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];
const envPath = envCandidates.find((p) => fs.existsSync(p));
if (envPath) {
  config({ path: envPath, override: false });
}

const { Pool } = await import('pg');
const { judgeAllHoldings } = await import('./src/judge/comparisonJudge.ts');
const { analyzePortfolioOpportunities } = await import('./src/advisor/opportunityAnalysis.ts');

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.DB_URL;
if (!connectionString) {
  throw new Error('No DATABASE_URL / POSTGRES_URL / DB_URL found');
}

const pool = new Pool({ connectionString });

try {
  const latestRun = await pool.query('SELECT id FROM bot_runs ORDER BY id DESC LIMIT 1');
  const runId = latestRun.rows[0]?.id ?? null;
  console.log('RUN_ID', runId);

  if (runId === null) {
    throw new Error('No bot_runs rows found');
  }

  const verdicts = await judgeAllHoldings('return_1y', runId, true);
  console.log('VERDICTS_TOTAL', verdicts.length);
  const analysis = analyzePortfolioOpportunities(verdicts);
  console.log('STRONG_UNHELD_COUNT', analysis.strong_unheld_entities.length);
  console.log('RAW_STRONG_UNHELD_ENTITIES');
  console.log(JSON.stringify(analysis.strong_unheld_entities, null, 2));
} finally {
  await pool.end();
}
