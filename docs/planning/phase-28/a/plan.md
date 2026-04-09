# Phase 28a — Quick Wins: Fix Failures, Delete Dead Code, Clean Logs

## Focus

Eliminate every pre-existing failure, dead module, and console.log from the codebase in under an hour.

Confidence: **93%**

## Work

### 1. Fix gmail.test.ts Failure (5 minutes)

**File**: `apps/web/__tests__/webhooks/gmail.test.ts`

The test "AIDraft.status stays 'draft' after creation from positive classification" expects 200 but gets 500. Root cause: `recordOutcomeEvent` is called by the gmail webhook but not mocked in the test.

Fix: Add to the test's mock block:
```ts
vi.mock("@/lib/seeding/outcome-recorder", () => ({
  recordOutcomeEvent: vi.fn(),
}));
```

### 2. Fix classification.test.ts TS Error (15 minutes)

**File**: `apps/web/__tests__/creator-search/classification.test.ts`

TS2345: `UnifiedDiscoveryCandidate` type missing 5 properties: `expandedCategories`, `languageDetected`, `topicSignals`, `sourceConfidence`, `sourceConfidenceTier`.

Fix: Add the 5 missing fields to the test fixture objects with sensible defaults:
```ts
expandedCategories: [],
languageDetected: "en",
topicSignals: [],
sourceConfidence: 0.8,
sourceConfidenceTier: "official",
```

### 3. Replace 9 console.log with log() (15 minutes)

The project has `lib/logger.ts` exporting a `log()` function. Replace all production `console.log` calls:

| File | Line | Replace with |
|------|------|-------------|
| `lib/inngest/functions/run-automation.ts` | 132 | `log("info", ...)` |
| `lib/inngest/functions/apify-creator-search.ts` | 294 | `log("info", ...)` |
| `lib/workers/creator-search.ts` | 1116, 1137, 1204 | `log("info", ...)` or `log("error", ...)` |
| `app/api/connections/shopify/route.ts` | 137, 157, 210 | `log("info", ...)` |
| `app/api/billing/webhook/route.ts` | 136 | `log("info", ...)` |

Note: `lib/logger.ts:26` is the logger itself — leave it.

### 4. Delete Dead Modules (10 minutes)

#### 4a. Safe to Delete (3 modules, zero importers confirmed by grep)

| File | Lines | Why Dead |
|------|-------|----------|
| `lib/brand/brand-identity.ts` | 59 | Brand identity, orphaned |
| `lib/cloudinary/mention-archive.ts` | 103 | Cloudinary archive, orphaned (media-archive.ts is the real one) |
| `lib/supabase/proxy.ts` | 29 | Supabase proxy, orphaned |

#### 4b. Delete After Cleanup (2 modules, alive in tests only)

| File | Lines | Cleanup Required |
|------|-------|-----------------|
| `lib/inbox/threads.ts` | 146 | Remove stale mock `vi.mock("@/lib/inbox/threads")` from `gmail.test.ts:64` BEFORE deleting |
| `lib/validation/multi-platform.ts` | 104 | Remove/update 4 dynamic imports in `__tests__/validation/platform-validation.test.ts` BEFORE deleting. Zero PRODUCTION importers but alive in tests. |

#### 4c. NOT Dead (1 module, keep)

| File | Lines | Why Keep |
|------|-------|----------|
| `lib/sentry.ts` | 27 | Dynamically imported by `instrumentation.ts:5` via `await import("@/lib/sentry")`. NOT dead. |

Before deleting each: re-verify zero importers with grep.

**Total: 441 lines removed (was 468 — sentry.ts kept).**

### 5. Extract Localhost Fallback to Shared Constant (10 minutes)

**New constant** in `lib/config.ts` (or add to existing `lib/ai/config.ts`):
```ts
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
```

Replace 8 hardcoded `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"` occurrences across 7 files. Note: `lib/config.ts` does not exist and must be created.

### 6. Remove Orphaned Event TODO

**File**: `apps/web/lib/inngest/events.ts`

The `"shopify/fulfillment.updated"` event has a TODO comment but it's emitted from 2 places and never consumed. Either add a consumer or remove the event. Since the Shopify webhook handles fulfillment updates inline, the event is truly dead. Remove it and remove the 2 emit calls. Also update `__tests__/config/inngest-events.test.ts` which has 3 references to this event.

## Deep Sweep Corrections Applied

- [x] CRITICAL: `lib/sentry.ts` is NOT dead -- dynamically imported by `instrumentation.ts:5` via `await import("@/lib/sentry")`. REMOVED from deletion list.
- [x] CRITICAL: `lib/inbox/threads.ts` has stale mock in `gmail.test.ts:64` (`vi.mock("@/lib/inbox/threads")`). Must remove the stale mock line from the test BEFORE deleting the module.
- [x] HIGH: `lib/validation/multi-platform.ts` has 4 dynamic imports in `__tests__/validation/platform-validation.test.ts`. Must update/remove those test imports before deleting. Since the module has zero PRODUCTION importers, it's dead production code but alive in tests.
- [x] MEDIUM: APP_URL count is 8 occurrences across 7 files, not 11. `lib/config.ts` does not exist -- must be created.
- [x] MEDIUM: Removing `shopify/fulfillment.updated` event requires updating `__tests__/config/inngest-events.test.ts` (3 references to this event).

Deletion list updated from 6 to 3 truly dead modules, plus 2 with cleanup required first. `lib/sentry.ts` kept (NOT dead).

## Tests

- Verify: `npx vitest run` — 0 failures (was 1)
- Verify: `npx tsc --noEmit` — 0 errors (was 1)
- Verify: `grep -rn "console\.log" apps/web/lib/ apps/web/app/ --include="*.ts" | grep -v __tests__ | grep -v logger.ts` — 0 results

## Output

(empty — to be filled after implementation)
