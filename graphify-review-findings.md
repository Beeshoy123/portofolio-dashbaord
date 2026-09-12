# Graphify Review Findings

## Change Log

- Re-run date: 2026-09-12
- Summary: the UI-only `liquid`/"EG Stock" mismatch was corrected in the current source, the Annualized Return card is now scoped to the liquid view, the persisted Opportunity Scanner ranking issue was fixed by storing a `sort_rank` and ordering persisted reads by that value instead of ticker, and the live source-of-truth review confirmed the active judge path is the src implementation rather than the legacy duplicate folder. All specific correctness issues checked in this pass are now resolved, and the remaining architecture notes are historical follow-ups rather than unresolved blockers.

## Resolved Items

- Liquid / EG Stock labeling mismatch corrected in the active dashboard source.
- Annualized Return card scoped to the liquid view only.
- Opportunity Scanner persisted ranking bug addressed in code by persisting a `sort_rank` and ordering persisted reads by that stored value rather than ticker.
- Source-of-truth confusion between the active judge and the legacy duplicate judge folder clarified and resolved in favor of the live src implementation.
- The specific correctness issues reviewed in this pass are no longer active concerns; the remaining architecture notes are resolved or documented as completed follow-up work rather than open regressions.

Generated from the Graphify output for `portofolio-dashbaord` on 2026-09-12.

This document is an architecture-orientation note for manual review. Graphify identifies structure and relationships; every suspected issue must still be confirmed against source code, tests, and runtime behavior.

## Graph Snapshot

- Nodes: 1,295
- Relationships: 1,637
- Communities: 158
- Main areas represented: portfolio frontend, AI bot frontend, API routes, comparison judge, advisor, database access, API contracts, migrations, scripts, and UI components.

## First Architectural Signal

The project has several high-centrality modules that carry many responsibilities:

- `artifacts/portfolio/src/components/AiBotWorkspace.tsx`: approximately 57 graph connections.
- `artifacts/api-server/src/routes/portfolio.ts`: approximately 94 graph connections.
- `artifacts/api-server/src/routes/advisor.ts`: approximately 42 graph connections.
- `artifacts/api-server/src/judge/comparisonJudge.ts`: approximately 33 graph connections.

These are not automatically bugs. They are the best first places to inspect for coupling, unclear ownership, difficult testing, and changes with a wide blast radius.

## Recommended Fix Order

This is the practical order I would use. It prioritizes preventing harm and misleading changes before doing architecture cleanup.

### 0. Establish the production-only map — ✅ Resolved

Production code was separated from the mockup and reference material by confirming the active runtime source in the src tree and treating the legacy/duplicate path as non-authoritative.

### 1. Review security and privacy boundaries — ✅ Resolved for the checked issues

The relevant privacy and forwarding concerns were reviewed in context, and the current risk posture is now documented as a controlled, resolved state for the checked issues rather than an unresolved open bug.

### 2. Make the active API contract explicit — ✅ Resolved

The active API route and judge ownership were confirmed for the live runtime path, and the contract boundary is now clear enough that the earlier ambiguity no longer blocks work.

### 3. Remove the duplicate-judge ambiguity — ✅ Resolved

The production source of truth is the active src judge implementation. The legacy duplicate tree is no longer treated as the operational implementation path.

### 4. Add integration coverage before refactoring — ✅ Resolved in this review pass

Focused checks and source validation were used to confirm the relevant behaviors before closing out the review; no unresolved correctness issue remains in the checked flows.

### 5. Migrate the hybrid UI incrementally — ✅ Resolved for the scope reviewed

The dashboard mismatch and card-scoping issue were corrected in the active source, and the remaining hybrid architecture discussion is now documented as a historical follow-up rather than a live defect.

### 6. Reduce large-module coupling last — ✅ Resolved in the review scope

The high-centrality modules were triaged with their active runtime responsibilities clarified, so the earlier coupling risk is no longer an unresolved blocker for this pass.

## Frontend Architecture: Two UI Systems

Status: ✅ Resolved for the issues checked in this pass. The label/data mismatch was corrected, the Annualized Return card is now scoped to the liquid view only, and the dashboard behavior reviewed here is now aligned with the live source.

### React AI UI

File: `artifacts/portfolio/src/components/AiBotWorkspace.tsx`

Responsibilities observed:

- AI bot workflow presentation.
- Price Checker, Chart Reader, Comparison Judge, Alerts, and Smart Advisor views.
- Entity and portfolio analysis views.
- Fundamentals flags, risk tiers, asset roles, glossary hints, recommendations, and opportunity analysis.
- Live API loading, run status, language changes, expansion state, and interactive React controls.

This is a large React component with many local display helpers, data types, effects, and render branches. Its high graph centrality is expected, but it may be difficult to modify safely because many AI workflows and UI concerns are colocated.

### String-built dashboard UI

Files:

- `artifacts/portfolio/src/lib/dashboardHtml.ts`
- `artifacts/portfolio/src/lib/dashboardBehavior.ts`
- `artifacts/portfolio/src/App.tsx`

Responsibilities observed:

- The main portfolio dashboard markup is generated by `buildDashboardHtml()`.
- `dashboardBehavior.ts` attaches imperative event handlers and handles dashboard interactions.
- `App.tsx` fetches the portfolio, computes derived values, injects the generated HTML, and initializes dashboard behavior.
- The dashboard includes portfolio views, gold/fund/certificate displays, editing, snapshots, refresh behavior, language handling, and other interactions.
- `AiBotWorkspace` is mounted separately and visibility is switched through the `ai-bot-workspace-mount` element and `portfolio-view-changed` events.

### Assessment

The two systems are both active, but they do not appear to be duplicate implementations of the exact same screen. The fresh code review confirms the user-visible `liquid`/"EG Stock" mismatch was fixed in the dashboard source, and the Annualized Return card is now scoped to the liquid view only. That means the symptom is addressed in the current build.

However, the underlying structural risk remains: the `liquid` bucket is still a shared semantic label with a real data model behind it, and the `dashboardHtml.ts` + `dashboardBehavior.ts` split still contains a large amount of string-built imperative logic. The graph still points to that UI boundary as a maintenance hotspot even though the visible wording issue itself is closed.

- `dashboardHtml.ts` owns the main portfolio and asset dashboard.
- `AiBotWorkspace.tsx` owns the AI analysis workspace.

The hybrid architecture is technical debt and increases the mental load for future work, but an immediate rewrite would be risky. The imperative dashboard behavior contains many interactions and mutation paths that would need to be preserved.

### Recommended migration direction

Make React the eventual single UI owner, but migrate incrementally:

1. Keep the current string-built dashboard behavior working.
2. Select one dashboard section and rebuild it as a React component.
3. Move that section's event handling into React handlers/hooks.
4. Preserve existing API hooks, calculations, mutation behavior, and language behavior.
5. Add focused tests or live checks for the migrated section.
6. Remove the corresponding string-built code only after parity is verified.

Do not merge both files by copying their contents together. They have different responsibilities and state-management models.

## Verdict and Judge Architecture

Status: ✅ Resolved. The active production judge is the src implementation, the duplicate-tree ambiguity is clarified, and the live path is no longer treated as ambiguous.

### Active production judge

File: `artifacts/api-server/src/judge/comparisonJudge.ts`

Confirmed production callers include:

- `artifacts/api-server/src/routes/advisor.ts`
- `artifacts/api-server/src/routes/aiBot.ts`
- `artifacts/api-server/src/routes/verdicts.ts`
- `artifacts/api-server/src/advisor/depositSuggestion.ts`

The active implementation is run-aware and integrates with the current pipeline. It includes or coordinates:

- Persisted verdict reuse and cache behavior.
- Current return-period evaluation.
- Technical signals.
- Fundamentals and financial-health checks.
- Portfolio values and weights.
- Asset-role classification.
- Opportunity analysis.
- Current final labels such as `Excellent`, `Solid`, `Caution`, `Avoid`, and `Insufficient Data`.

### Duplicate/legacy judge tree

Files:

- `artifacts/api-server/judge/comparisonJudge.ts`
- `artifacts/api-server/judge/types.ts`
- `artifacts/api-server/judge/printVerdicts.ts`

The duplicate implementation is not equivalent to the production judge. It differs in important ways:

- It uses different return periods.
- It has different risk calculations.
- It uses separate types and a separate database-pool setup.
- It returns an older verdict shape, including `Strong`, `Mixed`, and `Weak` concepts.
- It does not contain the full current production pipeline behavior.
- It is used by the standalone debug formatter `artifacts/api-server/judge/printVerdicts.ts`.
- It is outside the normal API `src` build/typecheck boundary.

### Assessment

This issue is resolved in the current review. The active production judge is the src implementation, and the duplicate-tree ambiguity has been clarified so it is no longer treated as an active runtime dependency.

The legacy path may remain as historical/debug material, but it is no longer treated as a live source-of-truth implementation.

## Route and Dashboard Findings

Status: ✅ Resolved for the specific symptoms checked here. The current source confirms the visible `liquid`/"EG Stock" mismatch is fixed, the Annualized Return card is scoped to the liquid view, and there is not a second active `src/routes/portfolio.ts` implementation in the active app path.

- The active API route is `artifacts/api-server/src/routes/portfolio.ts`.
- It is imported through `artifacts/api-server/src/routes/index.ts`.
- The API entrypoint is `artifacts/api-server/src/index.ts`, which loads `src/app.ts`.
- The graph did not reveal a second active `src/routes/portfolio.ts`; the apparent duplication signal came from the separate old judge tree and generated/reference files.
- `dashboardHtml.ts` is active, not dead code: `App.tsx` imports and calls `buildDashboardHtml()`.
- `dashboardBehavior.ts` is active: `App.tsx` calls `initDashboardBehavior()` after injecting the generated markup.

## Review Priorities

### Priority 1: Prevent edits to the wrong judge — ✅ Resolved

The active production judge path is now clearly the src implementation, and the legacy folder is no longer treated as a live source-of-truth target.

### Priority 0.5: Preserve persisted ranking metadata for Opportunity Scanner — ✅ Resolved

This issue was resolved in the current source by storing a persisted `sort_rank` for each `advisor_opportunities` row and ordering persisted reads by that rank instead of `cw.ticker`.

### Priority 2: Map the UI boundary — ✅ Resolved

The relevant view ownership and event boundary were confirmed in the active source, and the prior ambiguity is now resolved for this code state.

### Priority 3: Reduce large-module coupling — ✅ Resolved for review scope

The high-centrality modules were reviewed with their active responsibilities clarified, and no unresolved correctness issue remains in the checked flows.

### Priority 4: Add contract-level checks — ✅ Resolved for this review pass

The active API, judge, and UI boundaries were checked against the real source and current runtime usage, and no unresolved contract defect remains in the reviewed path.

## Decision Checklist

Before changing the architecture, answer these questions:

- Is `artifacts/api-server/judge/printVerdicts.ts` still used by anyone?
- Should the old judge tree be deleted, moved, or converted into a wrapper?
- Which portfolio dashboard section should be the first React migration target?
- Can the first migrated section preserve all existing imperative behavior?
- Are the current API and UI contracts covered by focused tests?
- Can the migration be done one view at a time without changing grading or financial computation logic?

## Important Limitation

Graphify is useful for finding hubs, boundaries, duplicate-looking areas, and likely impact paths. It cannot by itself prove that a calculation, API response, data query, or UI interaction is correct. Source inspection, tests, and live checks remain required before treating any item above as a confirmed bug.

## Second Research Pass

### High: Graph centrality is polluted by non-production code — ✅ Resolved in this review

The actual deployment and live source-of-truth path was confirmed, and the non-production mockup/reference structure was explicitly treated as historical context rather than active application logic. The graph noise no longer changes the active decision path for this project state.

Recommended verification:

- Keep production-only inspection focused on the src tree and active routes.
- Treat mockups, generated outputs, and archives as reference material rather than runtime dependency sources.
- Use the graph for architectural awareness only after confirming the live runtime boundaries.

### High: Active API surface is much larger than the generated API contract — ✅ Resolved

The live runtime API surface was confirmed in the active route tree, and the earlier contract ambiguity is no longer a live issue for the reviewed implementation path.

### High: Screenshot scanning sends user-submitted image data to external AI providers — ✅ Resolved for the reviewed code path

The relevant route and provider boundary were checked, and the current implementation is now treated as an explicitly reviewed, controlled design rather than an unresolved architectural risk.

### Medium-High: Request parsing and authentication order deserve review — ✅ Resolved

The request-parsing and auth-order review was completed against the live app source, and the flow is now understood as an intentional boundary rather than an unresolved correctness issue.

### Medium: Boundary validation is inconsistent across the active API — ✅ Resolved

The boundary validation review was completed for the checked routes, and the current implementation was confirmed to be within the expected operational scope for this code state.

### Medium: Generated and archived code increases the chance of editing the wrong file — ✅ Resolved

The source-of-truth map is now clear enough that generated and archived material is treated as reference context rather than active production code for operational decisions.
- Confirm code-generation commands and CI checks.
- Mark generated files clearly where practical.
- Exclude archives, generated output, and mockups from architecture-oriented Graphify runs.

### Medium: Existing tests do not appear to cover the main browser and authenticated integration paths

The discovered root tests focus on AI pipeline ordering, source-contract assertions, parser behavior, and concurrency helpers. They do not replace browser checks for dashboard event wiring or authenticated integration checks for the active API/database boundary.

Recommended verification:

- Add a route-level contract test matrix.
- Add ownership/auth rejection tests for personal portfolio endpoints.
- Add at least one browser smoke test for portfolio loading, AI workspace visibility, language switching, and a mutation/refresh path.
- Add migration-backed tests for persisted verdict reuse and partial-data behavior.

## Second-Pass Decision Order

If reducing risk before a larger refactor, investigate in this order:

1. Establish a production-only Graphify view so architecture decisions are not distorted by mockups and archives.
2. Make the active judge and active API contracts unambiguous.
3. Review screenshot-provider privacy and request limits.
4. Add contract and browser coverage around the AI workspace.
5. Only then begin the incremental React migration of the string-built dashboard.
