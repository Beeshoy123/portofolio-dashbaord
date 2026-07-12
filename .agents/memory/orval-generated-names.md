---
name: Orval generated names
description: How Orval names generated Zod schemas/TS types from an OpenAPI spec, for backend route handlers and frontend hooks.
---

Orval derives generated type/schema names from each operation's `operationId` plus a `Body`/`Response`/`Params` suffix — not from the OpenAPI `components.schemas` name referenced in the spec.

Example: an OpenAPI component named `Portfolio` used as the response of `operationId: getPortfolio` generates `GetPortfolioResponse`, not `Portfolio` (as a response-shaped schema/type). Similarly `UpdateGoldHolding` referenced as a request body on `operationId: updateGoldHolding` becomes `UpdateGoldHoldingBody`.

**Why:** caused a real typecheck failure — route handlers in `artifacts/api-server` imported the raw component name from generated Zod schemas and it didn't exist under that name.

**How to apply:** after running codegen, don't guess generated names from the spec's component names. Check the actual exports in the generated file (`lib/api-zod/src/generated/api.ts`, `lib/api-client-react/src/generated/api.ts`) for the operation-based names before importing them into route handlers or frontend code. Frontend TypeScript *types* (as opposed to runtime Zod schemas) are re-exported under the original component name from `./api.schemas` and are safe to import directly for typing purposes.
