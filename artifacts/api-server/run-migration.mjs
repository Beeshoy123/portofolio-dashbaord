import fs from 'fs';
import { Pool } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL not set');
}

const pool = new Pool({ connectionString: databaseUrl });

async function runMigration() {
  try {
    const migrationNames = [
      '009_bot_runs.sql',
      '010_engine_run_links.sql',
      '011_advisor_run_idempotency.sql',
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
