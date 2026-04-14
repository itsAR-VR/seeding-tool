# Phase 28e — Test Coverage: Core Business Logic

## Focus

Close the test coverage gap for the most critical untested modules. 62 of 134 lib modules (46%) have zero tests. This subphase targets the highest-risk untested modules.

Confidence: **88%**

## Inputs

- 28a must be done first (clean test baseline — 0 failures, 0 TS errors)

## Work

### Priority 1: Core Scoring & Discovery (highest risk, most complex)

**`lib/creator-search/orchestrator.ts` (729 lines, 0 tests)**
- Test: 4 discovery lanes run in parallel
- Test: candidate deduplication by handle
- Test: enrichment pipeline runs
- Test: LLM reclassification triggers for low-confidence categories
- Test: results ranked by relevance score
- Test: empty lane results handled gracefully

**`lib/creator-search/decision-engine.ts` (208 lines, 0 tests)**
- Test: 7-dimension scoring produces correct composite
- Test: triage thresholds (auto_shortlist >0.8, review >0.65, suppress <0.65)
- Test: missing features default to 0 (not NaN)
- Test: fitReasoning generated from score components

**`lib/creator-search/classification-llm.ts` (199 lines, 0 tests)**
- Test: single bio classified correctly
- Test: batch of 10 bios in one LLM call
- Test: invalid category from LLM rejected, falls back to keyword
- Test: API failure returns keyword result

### Priority 2: Outreach & Communication

**`lib/ai/outreach-drafter.ts` (170 lines, 0 tests)**
- Test: generates draft with subject and body
- Test: channel-specific prompt (email vs DM)
- Test: product context included in prompt
- Test: API failure returns error gracefully

**`lib/inngest/functions/reminders.ts` (177 lines, 0 tests)**
- Test: creates correct number of ReminderSchedule records
- Test: sleeps for configured days between reminders
- Test: checks for mentions before each reminder
- Test: cancels remaining reminders when mention detected

**`lib/inngest/functions/mention-check.ts` (268 lines, 0 tests)**
- Test: sends reminder email via sendEmail
- Test: skips if mention detected
- Test: skips if lifecycle past "delivered"
- Test: wraps body in HTML template
- Test: respects warmup gate (early warmup → plain text)

### Priority 3: Shopify & Infrastructure

**`lib/shopify/orders.ts` (164 lines, 0 tests)**
- Test: creates draft order with 100% discount
- Test: completes draft order
- Test: persists ShopifyOrder record
- Test: handles Shopify API errors

**`lib/shopify/products.ts` (271 lines, 0 tests)**
- Test: syncs products from Shopify
- Test: handles variants correctly
- Test: updates existing products on re-sync

**`lib/creators/validation-ops.ts` (189 lines, 0 tests)**
- Test: applies validation result to creator profile
- Test: platform-parameterized (Instagram vs TikTok)
- Test: handles unknown status gracefully

### Test Approach

All tests use the established mock patterns:
- `vi.mock("@/lib/prisma")` with factory from `__tests__/_helpers/prisma-mock.ts`
- `vi.mock("@/lib/ai/config")` for AI model
- OpenAI mocked via `vi.mock("openai")`
- Inngest step functions mocked

Target: 80%+ coverage on all priority 1 files, 60%+ on priority 2-3.

## Output

- Added the missing focused coverage files for the still-uncovered Phase 28e surfaces:
  - `apps/web/__tests__/creator-search/orchestrator.test.ts`
  - `apps/web/__tests__/inngest/reminders.test.ts`
  - `apps/web/__tests__/inngest/mention-check.test.ts`
  - `apps/web/__tests__/shopify/products.test.ts`
- Runtime behaviors now covered in this lane:
  - orchestrator dedup + enrichment, low-confidence reclassification, graceful lane failure
  - reminder scheduling cadence, mention short-circuit, terminal lifecycle cancellation
  - reminder send gating for feature flags, suppression, mention detection, and warmup-mode plain text
  - Shopify product sync pagination/upserts, stale cleanup, and UI flattening
- Review-driven hardening applied after the first pass:
  - `apps/web/lib/inngest/functions/mention-check.ts` now marks only the earliest pending reminder as `sent` instead of bulk-updating all pending reminders for the creator
  - reminder emission assertions now verify both reminder payloads
  - Shopify pagination coverage now asserts second-page persistence via upsert counts and final call inspection
- Focused verification:
  - `cd apps/web && ./node_modules/.bin/vitest run __tests__/creator-search/orchestrator.test.ts __tests__/creator-search/decision-engine.test.ts __tests__/creator-search/classification-llm.test.ts __tests__/creator-search/classification-llm-extended.test.ts __tests__/ai/outreach-drafter.test.ts __tests__/creators/validation-ops.test.ts __tests__/shopify/orders.test.ts __tests__/shopify/products.test.ts __tests__/inngest/reminders.test.ts __tests__/inngest/mention-check.test.ts`
  - Result: `10` files passed, `71` tests passed
  - `cd apps/web && npx tsc --noEmit`
