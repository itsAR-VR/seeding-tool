# Phase 23 + 24a — Deep Sweep Findings

Date: 2026-04-07
Models: Opus 4.6 (3 deep analysis + 2 RED TEAM)

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 4 |
| HIGH | 8 |
| MEDIUM | 5 |

---

## CRITICAL Findings

### 1. `OutcomeEvent` has no `order_created` variant — compile-time block
**Source**: Opus P1 + RED TEAM 23a
**File**: `lib/seeding/outcome-recorder.ts` lines 4-15

The plan calls `recordOutcomeEvent({ type: "order_created" })` but this type doesn't exist in the union. Also `CampaignOutcome` has no `orderCreatedAt` column.

**Required**: Add `{ type: "order_created" }` to the union + add `orderCreatedAt DateTime?` to schema + migration.

### 2. `createDraftOrder()` takes `creatorId`, NOT `campaignCreatorId` — runtime failure
**Source**: RED TEAM 23a
**File**: `lib/shopify/orders.ts:17-20`

The event payload has `campaignCreatorId`. The function signature requires `(brandId, creatorId, campaignId)`. Must resolve `creatorId` from the `CampaignCreator` record.

**Required**: Make plan explicit: call `createDraftOrder(brandId, campaignCreator.creatorId, campaignId)`.

### 3. Plan only fixes 1 of 3 `getAccessToken` copies — ingest.ts ignored
**Source**: Opus P3 + RED TEAM 24a
**Files**: `lib/gmail/send.ts:17`, `lib/gmail/ingest.ts:30` (identical copies)

If caching is added only to `send.ts`, inbox polling via `ingest.ts` still makes fresh token calls every time.

**Required**: Extract to shared `lib/gmail/token.ts`, import from both files.

### 4. No in-flight deduplication in token cache — thundering herd
**Source**: Opus P3 + RED TEAM 24a

Concurrent sends for same brand both see expired cache, both call Google's token endpoint.

**Required**: Add `pendingRefresh` Map that stores the in-flight Promise.

---

## HIGH Findings

### 5. Feature flag `shopifyOrderEnabled` not checked in Inngest function
Brands with orders disabled could still have orders auto-created.

### 6. No lifecycle guard — can approve address for `opted_out` creators
API should reject approval unless lifecycle is `replied` or `address_confirmed`.

### 7. No Shopify connection pre-validation in approve-address API
User sees "success" but gets intervention later when Inngest function fails.

### 8. No campaign product pre-validation in approve-address API
Same pattern as #7 — preventable async failure.

### 9. `process-reply.ts` sets `address_confirmed` prematurely (pre-existing)
Sets lifecycle to `address_confirmed` before human approval of the extracted address. Misleading in UI.

### 10. No cache invalidation on Gmail 401 — stale token served for up to 50 min
If user revokes Gmail access, cached token keeps failing until TTL expires.

### 11. Token cache Map needs size bound
Unbounded growth in pathological cases (many brands in warm container).

### 12. TTL should use Google's `expires_in`, not hardcoded 50 min
Google could return shorter-lived tokens in some configurations.

---

## MEDIUM Findings

### 13. `inngest-events.test.ts` hardcodes event count (10) — will fail when `shipping/address.approved` added
### 14. Double-approve race creates orphan Shopify order (not tracked locally)
### 15. `createDraftOrder()` does not record `CostRecord` for product cost
### 16. Address name splitting is fragile (mononyms, cultural formats)
### 17. Pre-existing `gmail.test.ts` failure should be triaged before adding new tests

---

## Sequencing Change

**Original**: Phase 23 (a→b) + Phase 24a in parallel
**Corrected**: Phase 24a first (extract shared token module), then Phase 23a + 23b

Reason: If 24a extracts `getAccessToken` to `lib/gmail/token.ts`, Phase 23b's send-pipeline mocks must target the new module. Running 23b before 24a means tests break when 24a lands.

**New order**:
1. Phase 24a — Extract + cache tokens (shared module)
2. Phase 23a — Address→order automation
3. Phase 23b — Integration tests (after both 24a and 23a)

---

## Required Plan Updates

### Phase 23a:
- [ ] Add `{ type: "order_created" }` to OutcomeEvent union + schema migration
- [ ] Fix parameter: `createDraftOrder(brandId, campaignCreator.creatorId, campaignId)`
- [ ] Add feature flag check in Inngest function
- [ ] Add lifecycle guard in API (only `replied` or `address_confirmed` allowed)
- [ ] Pre-validate Shopify connection + campaign product in API
- [ ] Accept `snapshotId` in request body (multiple snapshots possible)
- [ ] Update inngest-events.test.ts to expect 11 events
- [ ] Consider changing process-reply to set `address_received` instead of `address_confirmed`

### Phase 24a:
- [ ] Extract `getAccessToken` to shared `lib/gmail/token.ts` (covers both send.ts and ingest.ts)
- [ ] Add in-flight deduplication (pendingRefresh Map)
- [ ] Add retry-on-401 with cache invalidation
- [ ] Use Google's `expires_in` for TTL (fall back to 50 min default)
- [ ] Add LRU_MAX size bound (100 entries)
- [ ] Add test: cache isolation between different refresh tokens

### Phase 23b:
- [ ] Fix `$transaction` mock to execute callbacks: `$transaction: vi.fn((cb) => cb(mockPrisma))`
- [ ] Triage pre-existing gmail.test.ts failure
- [ ] Create shared `__tests__/_helpers/prisma-mock.ts` factory
- [ ] Use `vi.useFakeTimers()` for send pipeline delay
- [ ] Mock `lib/gmail/token.ts` (not `lib/gmail/send.ts`) after 24a extraction
