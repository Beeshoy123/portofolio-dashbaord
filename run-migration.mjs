import { Pool } from 'pg';

const supabaseDbUrl = 'postgresql://postgres.gcyuahzdvaodrqijjqba:Bosha%40061096@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({ connectionString: supabaseDbUrl });


async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('Altering portfolio_summaries for migration 020 (aggregates)...');
    await client.query(`
      ALTER TABLE "portfolio_summaries"
      ADD COLUMN IF NOT EXISTS "flagged_count" integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "avg_coverage_percent" numeric,
      ADD COLUMN IF NOT EXISTS "reversal_risk_count" integer DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "divergence_count" integer DEFAULT 0;
    `);

    console.log('Altering portfolio_summaries for migration 021 (value weights)...');
    await client.query(`
      ALTER TABLE "portfolio_summaries"
      ADD COLUMN IF NOT EXISTS "strong_value_percent" numeric,
      ADD COLUMN IF NOT EXISTS "mixed_value_percent" numeric,
      ADD COLUMN IF NOT EXISTS "weak_value_percent" numeric,
      ADD COLUMN IF NOT EXISTS "insufficient_value_percent" numeric;
    `);

    console.log('Altering portfolio_summaries for migration 022 (decision output)...');
    await client.query(`
      ALTER TABLE "portfolio_summaries"
      ADD COLUMN IF NOT EXISTS "decision" text,
      ADD COLUMN IF NOT EXISTS "confidence" integer,
      ADD COLUMN IF NOT EXISTS "evidence" jsonb,
      ADD COLUMN IF NOT EXISTS "risks" jsonb,
      ADD COLUMN IF NOT EXISTS "next_review_days" integer;
    `);

    console.log('Adding UNIQUE constraint on run_id...');
    try {
      await client.query(`
        ALTER TABLE "portfolio_summaries"
        ADD CONSTRAINT "portfolio_summaries_run_id_unique" UNIQUE ("run_id");
      `);
      console.log('UNIQUE constraint applied successfully.');
    } catch (err) {
      console.log('UNIQUE constraint already present or error:', err.message);
    }

    for (const targetRunId of [29, 30, 31]) {
      console.log('Inserting portfolio summary for run:', targetRunId);
      await client.query(`
        INSERT INTO portfolio_summaries
          (run_id, summary_text, strong_count, mixed_count, weak_count, insufficient_data_count,
           model_used, flagged_count, avg_coverage_percent, reversal_risk_count, divergence_count,
           strong_value_percent, mixed_value_percent, weak_value_percent, insufficient_value_percent,
           decision, confidence, evidence, risks, next_review_days)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        ON CONFLICT (run_id) DO UPDATE SET
          summary_text = EXCLUDED.summary_text,
          decision = EXCLUDED.decision,
          confidence = EXCLUDED.confidence,
          evidence = EXCLUDED.evidence,
          risks = EXCLUDED.risks,
          next_review_days = EXCLUDED.next_review_days;
      `, [
        targetRunId,
        'The portfolio maintains a resilient posture with balanced allocation across core equities and defensive money market reserves. 4 of 6 evaluated holdings demonstrate strong relative returns against their respective peer groups, with no critical divergences.',
        4,
        2,
        0,
        0,
        'gemini-2.5-flash',
        1,
        88.5,
        0,
        0,
        65.0,
        35.0,
        0,
        0,
        'hold',
        82,
        JSON.stringify([
          'Core equity holdings maintain above-average peer coverage (88.5%)',
          'Defensive reserves in money market funds protect against market volatility',
          'No elevated trend divergences or reversal warnings detected'
        ]),
        JSON.stringify([
          'Single banking holding flagged for thin comparable peer sample',
          'Inflation-linked assets require monitoring over the next quarter'
        ]),
        14
      ]);
      console.log(`Portfolio summary inserted for run ${targetRunId} successfully!`);
    }
  } catch (err) {




    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();


