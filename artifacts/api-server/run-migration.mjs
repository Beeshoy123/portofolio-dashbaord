import fs from 'fs';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL not set');
}

const pool = new Pool({ connectionString: databaseUrl });

async function runMigration() {
  try {
    const migrationNames = [
      '001_create_comparison_snapshots.sql',
      '002_seed_watchlist.sql',
      '004_add_egx30_expansion.sql',
      '005_yahoo_ticker_mapping.sql',
      '006_advisor_recommendations.sql',
      '007_stockanalysis_fundamentals.sql',
      '008_alert_history.sql',
      '009_bot_runs.sql',
      '010_engine_run_links.sql',
      '011_advisor_run_idempotency.sql',
      '012_technical_signals.sql',
      '013_index_60_session_return.sql',
      '014_advisor_structured_output.sql',
      '015_portfolio_summary.sql',
      '016_advisor_recommendation_type.sql',
      '017_advisor_opportunities.sql',
      '018_technical_reversal_risk.sql',
      '019_advisor_watch_triggers.sql',
      '020_portfolio_summary_aggregates.sql',
      '021_portfolio_summary_value_weights.sql',
    ];
    const client = await pool.connect();
    
    try {
      for (const migrationName of migrationNames) {
        const migrationPath = path.join(__dirname, '../../migrations', migrationName);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log(`Executing migration: ${migrationName}`);
        await client.query(sql);
      }
      console.log('✅ Migration completed successfully!');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
