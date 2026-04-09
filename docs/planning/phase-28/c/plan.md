# Phase 28c — Consolidate Duplicates

## Focus

Merge overlapping modules and extract shared constants.

Confidence: **92%**

## Work

### 1. Clarify Unipile DM Module Boundaries

Two modules handle DM sending at different abstraction levels:
- `lib/unipile/dms.ts` (190 lines) — `sendDm()` takes `brandId`, resolves client internally, used for inbox/reply DM sending (existing chat context)
- `lib/unipile/send-dm.ts` (126 lines) — `sendInstagramDM()` takes pre-resolved `client` + `accountId`, used for outreach pipeline DM sending (handle verification via fuzzy search + exact verify)

**Plan**: Do NOT merge into one module. The modules serve different use cases and operate at different abstraction levels. Instead:
- Keep `dms.ts` for inbox/reply DM sending (brandId-based, existing chat context)
- Keep `send-dm.ts` for outreach pipeline DM sending (client-based, handle verification)
- Extract shared types to `lib/unipile/types.ts` if any type overlap exists
- Add doc comments to both files explaining their distinct roles and when to use each

### 2. Extract Shared APP_URL Constant

If not done in 28a, create `lib/config.ts`:
```ts
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
```
Replace 8 hardcoded occurrences across 7 files. Note: `lib/config.ts` does not exist -- must be created.

### 3. Audit Unused Prisma Models

16 models have zero or near-zero code references. For each:
- If truly dead (never read or written): add `// UNUSED — candidate for removal` comment
- If planned but not yet wired: add `// PLANNED — Phase N` comment
- If actually used via indirect access (e.g., through relations): document

Do NOT delete models in this phase — just audit and document. Schema changes need migration coordination.

## Deep Sweep Corrections Applied

- [x] HIGH: DM module consolidation is more complex than planned. `dms.ts` takes `brandId` (resolves client internally). `send-dm.ts` takes pre-resolved `client` + `accountId`. Different abstraction levels. Different user lookup strategies (direct vs fuzzy search + exact verify).
- [x] HIGH: Recommendation: Do NOT merge into one module. Instead, document the distinction and add a thin shared types file. Both modules serve different use cases (inbox reply DM vs outreach pipeline DM).

Replaced "Consolidate" with "Clarify boundaries" -- scope reduced, confidence improved from 90% to 92%.

## Tests

- Verify: all tests still pass after DM boundary clarification
- Verify: `npx tsc --noEmit` -- no new errors
- Verify: both `dms.ts` and `send-dm.ts` have doc comments explaining their distinct roles

## Output

(empty — to be filled after implementation)
