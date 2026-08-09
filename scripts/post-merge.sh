#!/bin/bash
# WARNING: This script is part of the repository's maintenance workflow.
# Do not run automatically as part of an unsupervised Replit merge or sync.
# Only execute this after a confirmed manual review of repository changes.
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
