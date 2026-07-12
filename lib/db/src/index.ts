import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

// ── DATA SOURCE POLICY ──────────────────────────────────────────────────
// This app has no seed script and must never invent, hardcode, or fall
// back to placeholder financial numbers anywhere in the codebase (routes,
// frontend, schema defaults, etc.). Every figure the user sees comes from
// a live query against this database, full stop.
//
// If DATABASE_URL isn't set yet (e.g. the user hasn't attached their real
// database yet), fail loudly here instead of silently starting with fake
// data. Once DATABASE_URL is provided and the service restarts, it will
// pick up the real connection automatically — there is nothing else to
// wire up.
// ─────────────────────────────────────────────────────────────────────────

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database? " +
      "This app never falls back to hardcoded/placeholder financial data — " +
      "wait for the real database to be attached rather than adding sample values here.",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
