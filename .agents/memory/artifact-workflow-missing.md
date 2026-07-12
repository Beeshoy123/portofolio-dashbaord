---
name: Artifact workflow missing
description: An artifact can have a valid artifact.toml on disk with no registered/running workflow — don't assume preview is wired up just because the folder and toml exist.
---

An artifact directory can contain a fully valid `.replit-artifact/artifact.toml` (correct `previewPath`, `router = "path"`, service definitions) while `listWorkflows()` returns nothing for it and `listArtifacts()` doesn't list it — i.e. the artifact was never actually registered/started, even though all the files look complete. This can happen for artifacts present in an imported/pre-existing project rather than created via `createArtifact()` this session.

**Why:** `WorkflowsRestart` on the expected managed workflow name (`artifacts/<slug>: <service>`) fails with "doesn't exist" in this state, which looks like a naming mismatch but is actually a missing registration.

**How to apply:** if `WorkflowsRestart` reports the workflow doesn't exist for an artifact that already has an `artifact.toml`, check `listWorkflows({})` first. If genuinely empty, register the service directly via `configureWorkflow` using the exact `run` command, `localPort`, and `services.env` (PORT/BASE_PATH etc.) values from that artifact's `artifact.toml`, using the same `artifacts/<slug>: <service-name>` name. Verify with the running app after (e.g. screenshot via the external dev domain if `listArtifacts()`/`Screenshot` appPreview don't recognize the artifact yet).

Separately: a project can have workflows already defined directly in `.replit` (`[[workflows.workflow]]` blocks) and running fine via `WorkflowsRestart`/`listWorkflows`, while `listArtifacts()` still returns empty and the `Screenshot` appPreview tool reports "Artifact not found" for that slug. This is a metadata-registration gap, not a broken app — confirm the app works with `curl localhost:<port>` and an `externalUrl` screenshot against `https://$REPLIT_DEV_DOMAIN/` instead of insisting on appPreview.
