# Graphify Review Findings

Generated from the Graphify output for `portofolio-dashbaord` on 2026-09-10.

This document is an architecture-orientation note for manual review. Graphify identifies structure and relationships; every suspected issue must still be confirmed against source code, tests, and runtime behavior.

## Graph Snapshot

- Nodes: 1,278
- Relationships: 1,625
- Communities: 157
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

### 0. Establish the production-only map

Before changing application code, separate production code from `artifacts/mockup-sandbox`, `attached_assets`, generated files, Graphify output, and legacy debug trees. The current graph mixes these areas, so its centrality rankings can point attention at the wrong code.

Deliverable: a short source-of-truth map and a production-only Graphify run.

### 1. Review security and privacy boundaries

Inspect the screenshot scanning flow, external AI-provider forwarding, unrestricted CORS, 20 MB request parsing, rate limits, timeouts, and authentication order. These issues have the highest potential impact because they involve personal financial screenshots, external data sharing, and resource exposure.

Do not change provider behavior or limits blindly. First confirm deployment requirements, provider configuration, and user-consent expectations; then add the smallest necessary protections and tests.

### 2. Make the active API contract explicit

Inventory frontend calls to undocumented AI, advisor, scraper, verdict, alerts, and technical endpoints. Decide which belong in OpenAPI/generated clients and add response/request validation where the boundary is currently ad hoc.

Deliverable: documented endpoint ownership, consistent schemas, and contract tests for the live routes.

### 3. Remove the duplicate-judge ambiguity

Treat `artifacts/api-server/src/judge/comparisonJudge.ts` as the production source of truth. Convert the standalone formatter under `artifacts/api-server/judge/` to use the active judge, then retire the incompatible duplicate implementation only after the formatter and its users are verified.

This is the first code-organization fix because editing the wrong judge can silently produce a false sense of completion.

### 4. Add integration coverage before refactoring

Add focused tests for authenticated route ownership, missing/partial data, persisted verdict reuse, AI workspace loading, language switching, and at least one browser mutation/refresh path. This gives the later UI and module changes a behavioral safety net.

### 5. Migrate the hybrid UI incrementally

Do not merge `AiBotWorkspace.tsx` and `dashboardHtml.ts` into one large file. Make React the destination, but migrate one dashboard section at a time from string-built markup and `dashboardBehavior.ts`, preserving calculations, API calls, mutations, and language behavior.

### 6. Reduce large-module coupling last

Only after the boundaries and tests are clearer, extract responsibilities from `portfolio.ts`, `advisor.ts`, `comparisonJudge.ts`, and `AiBotWorkspace.tsx`. Refactoring these high-centrality modules first would create a large blast radius while the current contracts and production source map are still ambiguous.

## Frontend Architecture: Two UI Systems

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

The two systems are both active, but they do not appear to be duplicate implementations of the exact same screen:

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

This is a real maintenance risk. A developer could edit the old judge copy, run the standalone script, and believe production behavior changed when the application actually imports `src/judge/comparisonJudge.ts`.

Do not mechanically merge the two large judge files. The safer unification path is:

1. Treat `src/judge/comparisonJudge.ts` as the production source of truth.
2. Rewrite `judge/printVerdicts.ts` as a thin formatter over the active production judge.
3. Adapt the formatter to the current `HoldingVerdict` shape.
4. Run the formatter and API typecheck.
5. Remove the obsolete duplicate judge implementation and duplicate types only after the formatter works.
6. Update any documentation or scripts that still point at the legacy tree.

Before deleting anything, verify whether the standalone debug command is still needed by the team.

## Route and Dashboard Findings

- The active API route is `artifacts/api-server/src/routes/portfolio.ts`.
- It is imported through `artifacts/api-server/src/routes/index.ts`.
- The API entrypoint is `artifacts/api-server/src/index.ts`, which loads `src/app.ts`.
- The graph did not reveal a second active `src/routes/portfolio.ts`; the apparent duplication signal came from the separate old judge tree and generated/reference files.
- `dashboardHtml.ts` is active, not dead code: `App.tsx` imports and calls `buildDashboardHtml()`.
- `dashboardBehavior.ts` is active: `App.tsx` calls `initDashboardBehavior()` after injecting the generated markup.

## Review Priorities

### Priority 1: Prevent edits to the wrong judge

Clarify or retire `artifacts/api-server/judge/` so the production judge has one obvious home.

### Priority 2: Map the UI boundary

Document which screen belongs to the string-built dashboard and which belongs to `AiBotWorkspace`. The current event-based visibility switch is an important integration boundary.

### Priority 3: Reduce large-module coupling

Inspect `portfolio.ts`, `advisor.ts`, `comparisonJudge.ts`, and `AiBotWorkspace.tsx` for responsibilities that can be extracted without changing behavior.

### Priority 4: Add contract-level checks

For changes crossing API, judge, and UI boundaries, verify:

- API response shape.
- Authenticated request behavior.
- Missing/partial data behavior.
- Persisted run and verdict reuse behavior.
- UI rendering in both English and Arabic where applicable.

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

### High: Graph centrality is polluted by non-production code

Graphify's strongest reported node is `match` with approximately 51 connections, but it belongs to `artifacts/mockup-sandbox/src/App.tsx`. The graph also includes mockup UI primitives and timestamped files under `attached_assets`.

This can mislead refactoring decisions: the most connected graph node is not necessarily part of the deployed portfolio application. `artifacts/mockup-sandbox` is included by the workspace configuration, but its production relationship should be confirmed before treating its centrality as an application priority.

Recommended verification:

- Generate a production-only graph excluding `artifacts/mockup-sandbox`, `attached_assets`, generated output, and archives.
- Compare the centrality ranking with the full graph.
- Document which packages are deployed versus design/reference material.

### High: Active API surface is much larger than the generated API contract

`lib/api-spec/openapi.yaml` currently documents health and portfolio operations, while the active server mounts scraper, verdicts, advisor, alerts, AI-bot, and technical routes through `artifacts/api-server/src/routes/index.ts`.

`AiBotWorkspace.tsx` calls several of these routes directly through raw request helpers instead of generated API hooks. This creates a contract boundary that is not represented in the OpenAPI-generated client or schemas.

Potential consequences:

- Frontend and backend response shapes can drift without type errors.
- Authentication and error behavior may vary between endpoints.
- API changes may require manual updates in multiple places.

Recommended verification:

- Inventory every `/api` endpoint called by the frontend.
- Decide whether AI-bot routes belong in OpenAPI and generated clients.
- Add live contract checks for status, verdict, advisor, opportunity, alert, scraper, and technical endpoints.

### High: Screenshot scanning sends user-submitted image data to external AI providers

`artifacts/api-server/src/routes/portfolio.ts` accepts image data at `/portfolio/scan` and builds provider requests containing the image as a base64 data URL. The route prefers Qwen and uses Gemini as a fallback when configured.

This is an architectural privacy and resource boundary, not automatically a vulnerability. It deserves explicit review because financial screenshots can contain balances, account identifiers, order history, and other personal information.

Recommended verification:

- Confirm which providers are enabled in each environment.
- Confirm provider retention and training policies.
- Confirm the UI clearly informs the user before upload.
- Add request-size, rate-limit, timeout, and redaction controls where appropriate.
- Verify provider failures do not log image data or credentials.

### Medium-High: Request parsing and authentication order deserve review

`artifacts/api-server/src/app.ts` enables unrestricted CORS and parses JSON and URL-encoded bodies up to 20 MB before mounting the authenticated API router. `routes/index.ts` leaves the health router public, then applies `requireAuth` to the remaining routes.

The design may be intentional, but it means large request bodies are parsed before route authentication is evaluated, and any browser origin may attempt API requests. This broadens the resource and cross-origin attack surface.

Recommended verification:

- Confirm whether arbitrary cross-origin clients are required.
- Test CORS responses for approved and unapproved origins.
- Confirm reverse-proxy and server request-size limits.
- Measure behavior for unauthenticated oversized requests.
- Keep the health endpoint public only if that is required by deployment checks.

### Medium: Boundary validation is inconsistent across the active API

The portfolio API uses structured schemas in some paths, but several active routes and AI endpoints read request bodies directly or use broad types. The advisor route also contains broad `any` handling according to the graph/source review.

This makes malformed numeric values, unexpected enum values, oversized arrays, and extra fields more likely to reach persistence or AI prompts without a consistent rejection policy.

Recommended verification:

- Add a request-schema inventory for every mutating endpoint.
- Test missing fields, wrong types, `NaN`-like values, oversized inputs, and unexpected keys.
- Standardize error status and error-body shapes.
- Keep database constraints as a second line of defense rather than the only validation.

### Medium: Generated and archived code increases the chance of editing the wrong file

The graph includes generated API files under `lib/api-client-react/src/generated` and `lib/api-zod/src/generated`, generated mockup files, timestamped snapshots in `attached_assets`, and the duplicate judge tree described earlier.

The repository already has one concrete example of this risk: the old judge implementation looks related to production but is not imported by the application. A similar mistake could happen with generated API output or timestamped source copies.

Recommended verification:

- Add a short source-of-truth map for generated folders and archived assets.
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
