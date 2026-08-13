# Phase 26b — Multi-Platform Validation Framework

## Focus

Abstract the Instagram-only validation into a platform-agnostic interface. Add TikTok validation as the first additional platform. This requires significant schema migration and pipeline updates — the scope is much larger than initially estimated.

Confidence: **72%** (after corrections applied — high risk due to 29-file blast radius)

## Deep Sweep Corrections Applied

- [x] CRITICAL: `Creator` model has `instagramHandle` with `@@unique([brandId, instagramHandle])` — no TikTok equivalent. 29 files reference `instagramHandle` directly (orchestrator, send-pipeline, mention poll, validation, facets, enrichment, API routes, tests).
- [x] CRITICAL: `UnifiedDiscoveryPlatform = "instagram"` is a literal type in `contracts.ts:19`, not a union. Zod schema uses `z.literal("instagram").default("instagram")` at line 114 — will REJECT any query with `platform: "tiktok"`.
- [x] HIGH: No Apify TikTok actor IDs or functions exist in `apify/client.ts`. Plan doesn't specify which actor to use or response type mapping.
- [x] HIGH: All orchestrator discovery lanes are Instagram-specific (Apify search, following, keyword email, hashtag). No platform routing concept exists.
- [x] HIGH: `validation-ops.ts` hardcodes `platform: "instagram"` in `creatorProfile.upsert` at lines 103, 154, 167. `job-runner.ts` hardcodes it at lines 289, 395, 425, 671.
- [x] HIGH: All Inngest functions (`creator-avg-views-enrichment`, `creator-validation-cleanup`) directly import and call `validateInstagramCreators`.
- [x] MEDIUM: Proposed `PlatformValidator` interface is too simple — Instagram uses batch validation with adaptive delay, proxy rotation, block detection. TikTok via Apify has completely different error modes (API quotas, rate limits). Need batch interface with platform-specific options.
- [x] MEDIUM: "Best platform metrics" scoring strategy undefined — what does "best" mean for multi-platform creators?
- [x] MEDIUM: Discovery speed impact not analyzed — TikTok via Apify adds 5-30s per actor execution. No parallel validation strategy specified.
- [x] LOW: Fly.io worker is for AI scoring enrichment, NOT validation. Plan conflates the two.

## Inputs

- `apps/web/lib/instagram/validator.ts` (531 lines) — Playwright scraping with `AdaptiveDelayController`, proxy support, batch processing
- `apps/web/lib/creator-search/contracts.ts` — `UnifiedDiscoveryPlatform` type + Zod schema
- `apps/web/lib/creator-search/orchestrator.ts` — 4 discovery lanes, all Instagram-specific
- `apps/web/lib/creator-search/job-runner.ts` — `persistDiscoveredCandidate()`, validation calls, `instagramHandle` dedup
- `apps/web/lib/creators/validation-ops.ts` — `applyValidationResultToCreator()` hardcodes `platform: "instagram"`
- `apps/web/lib/creator-search/scoring/features.ts` — platform-agnostic metrics (followerCount, avgViews, engagementRate)
- `apps/web/prisma/schema.prisma` — `Creator.instagramHandle`, `CreatorProfile.platform`, `InfluencerPlatformProfile`
- User decision: keep Playwright worker on Fly.io for Instagram scraping

## Skills Available

- `architect` — validation interface design, migration strategy
- `backend-coding-agent` — TikTok validator, orchestrator routing, schema migration
- `tdd-guide` — migration safety tests
- `code-review` — post-implementation

## Work

### 0. Schema & Type Migration (PREREQUISITE — highest risk)

**File**: `apps/web/lib/creator-search/contracts.ts`
- Change `UnifiedDiscoveryPlatform` from `"instagram"` to `"instagram" | "tiktok"`
- Update Zod schema from `z.literal("instagram")` to `z.enum(["instagram", "tiktok"]).default("instagram")`
- Add `"apify_tiktok"` to `UnifiedDiscoverySource` union type

**File**: `apps/web/prisma/schema.prisma`
- Strategy decision for Creator dedup: add `tiktokHandle String? @map("tiktok_handle")` to Creator model with `@@unique([brandId, tiktokHandle])`. This is simpler than migrating `instagramHandle` away (which would break 29 files) and follows the existing Collabstr pattern where `tiktokHandle` is already captured.
- Do NOT remove or rename `instagramHandle` — backward-compatible addition only.

**Migration SQL**:
```sql
ALTER TABLE "creators" ADD COLUMN "tiktok_handle" TEXT;
CREATE UNIQUE INDEX "creators_brand_id_tiktok_handle_key" ON "creators"("brand_id", "tiktok_handle") WHERE "tiktok_handle" IS NOT NULL;
```

### 1. Abstract Validator Interface

**New file**: `apps/web/lib/validation/types.ts`

```ts
export interface PlatformValidator {
  platform: string;
  validateBatch(
    targets: ValidationTarget[],
    options?: PlatformValidationOptions
  ): Promise<ValidationResult[]>;
}

export interface ValidationTarget {
  handle: string;
  existingProfile?: { followerCount?: number };
}

export interface ValidationResult {
  handle: string;
  status: "valid" | "invalid" | "unknown" | "retry";
  followerCount?: number;
  avgViews?: number;
  engagementRate?: number;
  errorCode?: string;
}

export interface PlatformValidationOptions {
  concurrency?: number;
  timeout?: number;
  // Platform-specific options via extension
}
```

Batch interface because Instagram has sophisticated concurrency/delay/proxy management, and TikTok via Apify runs as actor executions (fundamentally different).

### 2. Wrap Instagram Validator

**New file**: `apps/web/lib/validation/instagram-validator.ts`

Implements `PlatformValidator` by wrapping existing `validateInstagramCreators()` from `validator.ts`. No behavior change to Instagram validation — pure adapter.

### 3. Add TikTok Validator

**New file**: `apps/web/lib/validation/tiktok-validator.ts`

Uses Apify TikTok profile scraper (specify actor: e.g., `clockworks/tiktok-scraper`):
- Add actor ID to `apps/web/lib/apify/client.ts` as `TIKTOK_PROFILE_ACTOR_ID`
- Add `runTikTokProfileScraper()` function with typed response mapping
- Map TikTok-specific fields (heart count, video count, follower count) to `ValidationResult`
- Environment variable: `APIFY_TIKTOK_ACTOR_ID`

### 4. Platform Validator Registry

**New file**: `apps/web/lib/validation/registry.ts`

```ts
const validators = new Map<string, PlatformValidator>();
export function getValidator(platform: string): PlatformValidator | undefined;
export function registerValidator(validator: PlatformValidator): void;
```

Registered at app init. Allows future platforms without code changes to the caller.

### 5. Update Persistence Layer

**File**: `apps/web/lib/creators/validation-ops.ts`
- Add `platform` parameter to `applyValidationResultToCreator()`
- Replace hardcoded `platform: "instagram"` with the parameter
- Profile URL generation based on platform (`instagram.com/${handle}` vs `tiktok.com/@${handle}`)

**File**: `apps/web/lib/creator-search/job-runner.ts`
- `persistDiscoveredCandidate()`: accept `platform` parameter, use for `creatorProfile.upsert`
- Dedup logic: check `instagramHandle` for Instagram, `tiktokHandle` for TikTok
- Identity sync: platform-aware profile linking

### 6. Update Inngest Functions

**File**: `apps/web/lib/inngest/functions/creator-avg-views-enrichment.ts`
- Accept platform parameter, use validator registry to dispatch

**File**: `apps/web/lib/inngest/functions/creator-validation-cleanup.ts`
- Query all platform profiles (not just `instagramHandle: { not: null }`)
- Dispatch to appropriate validator per platform

### 7. TikTok Discovery Lane (Optional — can be deferred)

**Note**: Full TikTok discovery (search, following, hashtag) requires significant new Apify actors and orchestrator lanes. For v1, TikTok data can come from:
1. Collabstr data (already captures `tiktokHandle` and `tiktokUrl`)
2. Manual import via CSV

Full TikTok discovery lanes are a future enhancement. This phase focuses on validation and scoring.

### 8. Multi-Platform Scoring Strategy

**File**: `apps/web/lib/creator-search/scoring/features.ts`

The scoring functions (`computeScaleFit`, `computeEngagementQuality`) already accept platform-agnostic numeric inputs. For multi-platform creators:
- Use highest follower count across platforms for `computeScaleFit()`
- Use highest engagement rate across platforms for `computeEngagementQuality()`
- Add `crossPlatformCount` to `computeIdentityConfidence()` (already has this factor)
- Expose `primaryPlatform` on scoring result for transparency

### 9. Tests

- Test: Instagram validator still works via interface (adapter pass-through)
- Test: TikTok validator returns follower count from Apify response
- Test: TikTok validator handles Apify actor failure gracefully
- Test: Platform registry dispatches to correct validator
- Test: `applyValidationResultToCreator` handles both Instagram and TikTok platforms
- Test: Creator dedup works with `tiktokHandle` (separate from `instagramHandle`)
- Test: Multi-platform creator scored on best platform metrics
- Test: Existing Instagram-only creators unaffected by schema migration
- Test: `UnifiedDiscoveryPlatform` Zod schema accepts "tiktok"
- Test: Inngest cleanup queries all platform profiles

## Open Questions

1. Which specific Apify TikTok actor to use? (`clockworks/tiktok-scraper` vs `novi/fast-tiktok-api` vs other) — need to evaluate response schema, cost, and reliability.
2. Should TikTok validation run in parallel with Instagram validation for multi-platform creators? (Recommended: yes, via `Promise.allSettled`)
3. Performance budget: what's the acceptable total discovery time increase from adding TikTok? (Recommended: <2x current, ~6s/profile max including both platforms)

## Output

Implementation complete. All 25 tests pass. No new TypeScript errors introduced.

### Files Created
- `apps/web/lib/validation/types.ts` — PlatformValidator interface, ValidationTarget, ValidationResult, PlatformValidationOptions
- `apps/web/lib/validation/instagram-validator.ts` — Adapter wrapping existing validateInstagramCreators()
- `apps/web/lib/validation/tiktok-validator.ts` — TikTok validator using Apify clockworks/tiktok-scraper
- `apps/web/lib/validation/registry.ts` — Platform validator registry with getValidator(), registerValidator()
- `apps/web/lib/validation/multi-platform.ts` — selectBestPlatformMetrics() for multi-platform scoring
- `apps/web/__tests__/validation/platform-validation.test.ts` — 21 tests
- `apps/web/__tests__/validation/tiktok-mapper.test.ts` — 4 tests

### Files Modified
- `apps/web/lib/creator-search/contracts.ts` — UnifiedDiscoveryPlatform union, Zod enum, apify_tiktok source
- `apps/web/prisma/schema.prisma` — tiktokHandle field + unique constraint on Creator model
- `apps/web/lib/apify/client.ts` — TikTok actor ID, types, runTikTokProfileScraper(), mapTikTokProfileToCreator()
- `apps/web/lib/creators/validation-ops.ts` — platform parameter on applyValidationResultToCreator()
- `apps/web/lib/creator-search/job-runner.ts` — platform parameter on persistDiscoveredCandidate()
- `apps/web/lib/inngest/functions/creator-avg-views-enrichment.ts` — validator registry dispatch for non-Instagram
- `apps/web/lib/inngest/functions/creator-validation-cleanup.ts` — queries all platforms (OR instagramHandle/tiktokHandle)

## Handoff

Phase 26c (Analytics Dashboard) can display data from both platforms. The validation interface allows future platforms (YouTube, Twitter) to be added via new validator implementations without changing the core pipeline.
