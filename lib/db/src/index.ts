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
//
// RESTORING REAL DATA: the user's real balances/prices/transactions only
// ever get restored by loading their own offline SQL backup directly into
// this Postgres database (psql/db tooling) — never by typing numbers into
// a .ts/.tsx file. If a grep of the source tree ever turns up a real
// financial literal (a gold price, a fund NAV, a balance, etc.) instead of
// a DB read, that is a policy violation: delete it immediately and replace
// it with a live query or an explicit empty/error state. Do not restore
// from a backup file found in git history or a checkpoint on your own
// initiative — wait for the user to hand you the specific backup to use.
// ─────────────────────────────────────────────────────────────────────────

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database? " +
      "This app never falls back to hardcoded/placeholder financial data — " +
      "wait for the real database to be attached rather than adding sample values here.",
  );
}

let chosenDatabaseUrl = process.env.DATABASE_URL ?? "";
const poolerEnv = process.env.DATABASE_URL_POOLER ?? process.env.POOLER_DATABASE_URL ?? "";

// Allow overriding which connection to use at runtime. Useful when running
// locally (direct connection) vs. in IPv4-only environments like Replit
// (shared pooler). Set USE_POOLER=1 to force the pooler URL.
if (process.env.USE_POOLER === "1" && poolerEnv) {
  chosenDatabaseUrl = poolerEnv;
}

if (!chosenDatabaseUrl && poolerEnv) {
  // If no primary DATABASE_URL was provided, fall back to pooler if available.
  chosenDatabaseUrl = poolerEnv;
}

if (!chosenDatabaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database? " +
      "This app never falls back to hardcoded/placeholder financial data — " +
      "wait for the real database to be attached rather than adding sample values here.",
  );
}

let parsedDbUrl: URL;
try {
  parsedDbUrl = new URL(chosenDatabaseUrl);
} catch (err) {
  throw new Error(
    "DATABASE_URL is not a valid URI. If your password contains special characters like @, #, or : then percent-encode them (for example %40 for @). " +
      "Example: postgresql://user:pass%40word@host:5432/db",
  );
}

// Let the host-based policy below control SSL instead of allowing a stale
// sslmode query parameter to override it.
parsedDbUrl.searchParams.delete("sslmode");
const normalizedDatabaseUrl = parsedDbUrl.toString();

const isLocalDatabase = ["localhost", "127.0.0.1", "::1"].includes(parsedDbUrl.hostname);
const isSupabasePooler = parsedDbUrl.hostname.endsWith(".pooler.supabase.com");
const sslConfig = isLocalDatabase || isSupabasePooler
  ? undefined
  : parsedDbUrl.hostname
  ? {
      rejectUnauthorized: false,
      servername: parsedDbUrl.hostname,
    }
  : {
      rejectUnauthorized: false,
    };

console.info({ chosenDatabaseUrl: parsedDbUrl.hostname }, "Using database host");

export const pool = new Pool({
  connectionString: normalizedDatabaseUrl,
  ssl: sslConfig,
});

export const db = drizzle(pool, { schema });

export * from "./schema";
