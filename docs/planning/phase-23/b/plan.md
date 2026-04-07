# Phase 23b — Integration Tests for Critical Paths

## Focus

Add integration tests for the critical paths hardened in Phase 22 and automated in Phase 23a. Target 80%+ coverage on the safety-critical modules.

## Inputs

- Phase 22 output: credit enforcement, daily limits, RBAC, suppression
- Phase 23a output: address→order pipeline
- Existing test patterns in `apps/web/__tests__/`

## Skills Available for This Subphase
- `tdd-guide` — test-first methodology, coverage targets
- `qa-test-planner` — test plan generation
- `database-reviewer` — mock strategies for Prisma

## Work

### 1. Send Pipeline Integration Tests

**File**: `apps/web/__tests__/integration/send-pipeline.test.ts`

- Test: full send flow with mocked Gmail API succeeds
- Test: send with suppressed recipient is blocked
- Test: send at daily limit returns `DailyLimitExceededError`
- Test: batch send stops at limit, marks remaining as `daily_limit_reached`
- Test: thread-before-send idempotency (thread + outbound message = skip)
- Test: thread without outbound message = retry (delete empty thread)
- Test: cross-brand alias rejected with `CrossBrandAliasError`

### 2. Credit Enforcement Integration Tests

**File**: `apps/web/__tests__/integration/credit-enforcement.test.ts`

- Test: search with `CREDIT_ENFORCEMENT_ENABLED=true` and 0 credits returns 402
- Test: search with sufficient credits debits correctly
- Test: campaign search route also enforces credits (bypass prevention)
- Test: dispatch failure refunds credits via `mint()`
- Test: worker skips debit when enforcement is enabled (no double charge)

### 3. Process Reply Integration Tests

**File**: `apps/web/__tests__/integration/process-reply.test.ts`

- Test: positive reply → AI draft generated (when `aiReplyEnabled`)
- Test: address reply → `ShippingAddressSnapshot` created with `isActive: false`
- Test: address approval → `isActive: true` + Inngest event fired
- Test: Inngest function creates Shopify draft order
- Test: duplicate approval is idempotent (unique constraint on `ShopifyOrder.campaignCreatorId`)
- Test: Shopify API failure creates `InterventionCase`

### 4. RBAC Integration Tests

**File**: `apps/web/__tests__/integration/rbac.test.ts`

- Test: viewer cannot approve address (403)
- Test: editor can approve address (200)
- Test: multi-brand user with cookie gets correct brand's data
- Test: spoofed cookie for non-member brand returns 403

## Output

- 4 integration test files covering the 4 critical paths
- All tests passing
- Coverage report showing 80%+ on safety modules

## Handoff

Phase 23 complete. The platform now has automated address→order and tested critical paths. Phase 24 (Outreach Excellence) and Phase 25 (Intelligence Upgrade) can proceed in parallel.
