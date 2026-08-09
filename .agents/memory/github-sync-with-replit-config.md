---
name: GitHub sync with Replit config
description: Safe procedure for syncing later GitHub commits into an imported Replit monorepo with local workflow configuration and uploaded assets.
---

When syncing an imported repository, preserve the local Replit workflow configuration if the remote copy removes environment modules required by the running app. Stash untracked uploads before pulling, then restore them without committing them.

**Why:** GitHub updates can be valid while still omitting Replit-specific runtime setup; a blind pull can fail on dirty uploaded files or remove the database module needed by the workflows.

**How to apply:** Check local/remote divergence first, keep the local PostgreSQL-enabled `.replit` configuration, verify the remote `.env` is not carrying credentials, and apply only committed additive database migrations needed by newly synced routes.