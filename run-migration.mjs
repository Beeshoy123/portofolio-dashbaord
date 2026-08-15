import fs from 'fs';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL not set');
}

const pool = new Pool({ connectionString: databaseUrl });

async function runMigration() {
  try {
    const sql = fs.readFileSync('./migrations/006_advisor_recommendations.sql', 'utf8');
    const client = await pool.connect();
    
    try {
      console.log('Executing migration: 006_advisor_recommendations.sql');
      await client.query(sql);
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
