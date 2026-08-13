# Phase 20a — Foundation Hardening: Validation Reclassification, Source Confidence & Structured Logging

## Focus

Fix the two most damaging assumptions in the current pipeline before building new layers on top. First: validation outcomes are binary (valid/invalid), which means "blocked by Instagram" = "bad creator" — a false negative factory. Second: all discovery sources are treated equally, so a keyword email scrape carries the same weight as a validated profile or a marketplace import. This subphase also adds structured logging of raw payloads, validation reasons, and score components so that every subsequent subphase has the observability it needs.

## Inputs

- Current validation system: `lib/instagram/validator.ts` (Playwright-based, returns `status: "valid" | "invalid"` with errorCode)
- Current cache policy: `lib/creator-search/cache-policy.ts` (72h TTL, bypass for cached valid creators)
- Current merge logic: `lib/creator-search/candidate-merge.ts` (all sources merged equally)
- Current error codes: `missing_profile`, `blocked_or_login_wall`, `timeout`, `follower_count_not_found`, `zero_followers`, `out_of_range`, `navigation_failed`
- Current Creator.validationStatus: single string field
- Deep research report sections on validation brittleness and source tiering

## Skills Available for This Subphase

- `backend-coding-agent` — API + schema changes
- `database-design` — Migration design
- `superpowers:test-driven-development` — TDD for validation logic
- `context7-docs` — Prisma migration docs

## Work

### 1. Reclassify Validation Outcomes (4-State Model)

**Schema change** — Add to Creator model:

```prisma
model Creator {
  // ... existing fields ...
  validationStatus     String?   // CHANGE: now stores "valid" | "unknown" | "retry" | "invalid"
  validationErrorCode  String?   // NEW: stores the specific error code
  validationAttempts   Int       @default(0) // NEW: retry counter
  lastValidationError  String?   // NEW: human-readable reason
}
```

**Mapping from current error codes to new states:**

| Error Code | Current State | New State | Rationale |
|---|---|---|---|
| (none — success) | valid | valid | Confirmed real profile with follower count |
| `blocked_or_login_wall` | invalid | unknown | Collection method failure, not creator failure |
| `timeout` | invalid | retry | Transient — should retry with backoff |
| `navigation_failed` | invalid | retry | Transient — should retry with backoff |
| `follower_count_not_found` | invalid | unknown | Page loaded but couldn't parse — try corroboration |
| `missing_profile` | invalid | invalid | Profile genuinely doesn't exist |
| `zero_followers` | invalid | invalid | Real profile but zero followers = not an influencer |
| `out_of_range` | invalid | invalid | Real profile but outside campaign's follower band |

**Update `lib/instagram/validator.ts`:**
- Change return type from `status: "valid" | "invalid"` to `status: "valid" | "unknown" | "retry" | "invalid"`
- Map each errorCode to the correct new state
- Return `validationAttempts` count

**Update `lib/creator-search/job-runner.ts`:**
- `validateDiscoveryCandidates()` now partitions into 3 buckets: `{valid, unknown, invalid}` (not 2)
- `unknown` candidates are still included in results with a flag, not silently dropped
- `retry` candidates are queued for re-validation (see retry logic below)

**Update `lib/creator-search/cache-policy.ts`:**
- `shouldBypassDiscoveryValidation()` now also returns true for `unknown` status within cache window
- Add `shouldRetryValidation(creator)`: true if status=retry AND attempts < 3 AND last attempt > 1h ago

### 2. Add Source Confidence Tiers

**New file: `lib/creator-search/source-confidence.ts`**

```typescript
export type SourceConfidenceTier = "official" | "validated" | "marketplace" | "scraped" | "inferred";

export const SOURCE_CONFIDENCE: Record<string, { tier: SourceConfidenceTier; weight: number }> = {
  // Official APIs (highest trust)
  youtube_api:           { tier: "official",     weight: 1.0 },
  tiktok_display_api:    { tier: "official",     weight: 1.0 },

  // Browser-validated (high trust — we saw the real page)
  instagram_validated:   { tier: "validated",    weight: 0.85 },

  // Marketplace imports (medium trust — curated but possibly stale)
  collabstr:             { tier: "marketplace",  weight: 0.65 },

  // Apify search/scrape (lower trust — automated, ToS-sensitive)
  apify_search:          { tier: "scraped",      weight: 0.50 },
  apify_keyword_email:   { tier: "scraped",      weight: 0.40 },

  // Inferred (lowest trust — derived from weak signals)
  seed_following:        { tier: "inferred",     weight: 0.35 },
  approved_seed_following: { tier: "inferred",   weight: 0.45 }, // slightly higher — seed was approved
};

export function getSourceConfidence(source: string): { tier: SourceConfidenceTier; weight: number } {
  return SOURCE_CONFIDENCE[source] ?? { tier: "inferred", weight: 0.30 };
}

export function computeCompositeSourceConfidence(sources: string[]): number {
  if (sources.length === 0) return 0;
  // Multi-source corroboration boosts confidence
  const weights = sources.map(s => getSourceConfidence(s).weight);
  const maxWeight = Math.max(...weights);
  const corroborationBonus = Math.min(0.15, (sources.length - 1) * 0.05);
  return Math.min(1.0, maxWeight + corroborationBonus);
}
```

**Integration points:**
- `lib/creator-search/candidate-merge.ts` — source confidence affects merge precedence (higher-tier source wins field conflicts)
- `lib/creator-search/orchestrator.ts` — relevance score computation uses source confidence as a weighted factor
- CreatorSearchResult — add `sourceConfidence: Float?` field

### 3. Structured Logging & Raw Payload Persistence

**Schema change — new model:**

```prisma
model CreatorRawPayload {
  id          String   @id @default(cuid())
  creatorId   String?
  searchJobId String?
  source      String   // "apify_search", "collabstr", "validator", etc.
  eventType   String   // "discovery", "validation", "enrichment"
  payload     Json     // raw response from source
  createdAt   DateTime @default(now())

  creator     Creator?          @relation(fields: [creatorId], references: [id])
  searchJob   CreatorSearchJob? @relation(fields: [searchJobId], references: [id])

  @@index([creatorId])
  @@index([searchJobId])
  @@index([source, createdAt])
}
```

**Logging integration:**
- `lib/apify/client.ts` — log raw Apify actor responses before mapping
- `lib/instagram/validator.ts` — log raw validation HTML/response data
- `lib/enrichment/providers/apify-email.ts` — log raw email enrichment responses
- `lib/creator-search/orchestrator.ts` — log per-lane timing, candidate counts, merge decisions

**Structured log format** (console.log for Vercel log drains):

```typescript
console.log(JSON.stringify({
  event: "creator_search.lane_complete",
  jobId: "...",
  lane: "apify_search",
  candidateCount: 23,
  durationMs: 4500,
  source: "apify_search",
  tier: "scraped",
}));
```

### 4. Update Candidate Merge to Respect Source Tiers

**Modify `lib/creator-search/candidate-merge.ts`:**

Current merge logic takes incoming values for followerCount, avgViews, engagementRate etc. unconditionally. New logic:

```typescript
// Only overwrite if incoming source is equal or higher tier
function mergeField<T>(current: T | null, incoming: T | null, currentTier: number, incomingTier: number): T | null {
  if (incoming == null) return current;
  if (current == null) return incoming;
  return incomingTier >= currentTier ? incoming : current;
}
```

### 5. Migration

- Add `validationErrorCode`, `validationAttempts`, `lastValidationError` to Creator
- Add `sourceConfidence` to CreatorSearchResult
- Create `CreatorRawPayload` table
- Backfill existing `invalid` creators with `blocked_or_login_wall` errors → `unknown`

### 6. Tests

- Unit tests for 4-state validation mapping (all 7 error codes → correct state)
- Unit tests for source confidence computation (single source, multi-source corroboration)
- Unit tests for tier-aware merge precedence
- Integration test: "blocked" validation no longer drops creator from results

## Output

- `lib/creator-search/source-confidence.ts` — new module
- Updated `lib/instagram/validator.ts` — 4-state returns
- Updated `lib/creator-search/candidate-merge.ts` — tier-aware merging
- Updated `lib/creator-search/cache-policy.ts` — retry logic
- Updated `lib/creator-search/job-runner.ts` — 3-bucket validation
- Prisma migration adding new fields + CreatorRawPayload table
- Structured logging throughout pipeline
- Test coverage for all new logic

## Handoff

Phase 20b builds the Identity Graph on top of these foundations. The source confidence tiers, raw payload storage, and 4-state validation are prerequisites for evidence-based identity linking — without them, the identity graph would inherit the same "scraped data = truth" problem. The `CreatorRawPayload` table also provides the training data substrate for the future ML ranker (Phase 21+).
