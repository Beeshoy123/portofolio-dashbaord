---
name: Financial data restore policy
description: Rules for handling SQL backups and real financial numbers — no files left on disk, DB only.
---

Never create backup or restore files in this repo. No `.sql` dumps, no `backups/` directory, no restore scripts, no seed files containing real numbers — nothing that could reach git or Replit history.

**Restore flow:**
1. User uploads their SQL backup file.
2. Pipe it directly into `psql "$DATABASE_URL"` — do not copy it to a project path first.
3. Delete the uploaded file immediately after import (`rm <path>`).
4. Confirm row counts via `executeSql`, then take a screenshot.

**Why:** The user's financial data must never appear in git history or Replit checkpoints that could be shared. The live Postgres database is the only acceptable home for real numbers.

**How to apply:** Any time a restore or import is requested, follow the pipe-and-delete flow above. Never `cp`, `mv`, or write the SQL to `attached_assets/`, `backups/`, `scripts/`, or anywhere else in the workspace.

**Gold transactions:** Gold is tracked as individual purchase rows in `gold_transactions` (karat, weight, spot price, manufacturing fee per gram, total paid). Do not collapse these into a summary — the per-transaction ledger is intentional and enables accurate avg-cost and P&L calculations. When the user buys more gold, they add a new row to `gold_transactions`; the maths derive from that automatically.
