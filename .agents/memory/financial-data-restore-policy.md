---
name: Financial data restore policy (portfolio-tracker style apps)
description: Rules for restoring real user financial data after an import/reset, and how Replit checkpoints differ from GitHub history.
---

For apps with a "no hardcoded/placeholder financial numbers" policy (e.g. the Beeshoy portfolio tracker), restoring real data after an import/reset has two hard rules:

1. **DB only, never inline in source.** Real balances/prices/transactions get loaded via `psql`/DB tooling straight into Postgres — never typed as literals into `.ts`/`.tsx`/route files, even temporarily. If a real financial number ever turns up hardcoded in source, delete it immediately and replace with a live query or explicit empty/error state.
2. **Wait for the user's specific backup file — don't self-serve one from history.** Don't restore from a backup found in git history or a Replit checkpoint on your own initiative; confirm with the user which backup/version is authoritative first.

**Why:** these apps intentionally ship with no seed script and an explicit `NOT_SEEDED` empty state; the temptation during "make it look right" work is to paste in a plausible-looking number, which silently reintroduces fake data the policy exists to prevent.

**Checkpoints vs. GitHub — do not conflate:** Replit's checkpoint system auto-snapshots the codebase *and* the Replit-managed Postgres database, but it is private to the repl — never pushed to GitHub, not visible to anyone the repo is shared with. Git/GitHub history has no DB rows at all. "Restore from git history" and "restore from a checkpoint" are different systems with different data and different audiences — clarify which one the user means before acting on a rollback/restore request.

**How to apply:** whenever a task involves restoring or re-seeding real financial/user data after a reset, re-read this before touching the DB or any source file that renders numbers.
