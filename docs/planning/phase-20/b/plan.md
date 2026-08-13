# Phase 20b — Identity Graph v1: Schema, Matching Pipeline & Review Queue

## Focus

Replace handle-based identity collapse with a first-class identity graph. The current system treats `normalized_instagram_handle` as the identity key, which breaks on handle changes, cross-platform creators, agency-managed profiles, and ambiguous duplicates. This subphase introduces a canonical InfluencerIdentity entity, links platform profiles via evidence-based IdentityEdges, and creates a "possible match" review queue so ambiguous merges are surfaced to ops rather than silently applied or ignored.

The identity graph is the single highest-priority structural fix identified in both the user's diagnosis and the deep research report.

## Inputs

- Phase 20a outputs: 4-state validation, source confidence tiers, raw payload storage
- Current models: Creator (brand-scoped, IG-handle keyed), CreatorProfile (per-platform)
- Current merge: `candidate-merge.ts` collapses by normalized handle
- Deep research report: proposed InfluencerIdentity + InfluencerPlatformProfile + IdentityEdge schema
- User directive: "canonical influencer identity layer — not just Creator and CreatorProfile, but a true identity object plus evidence-based profile links"

## Skills Available for This Subphase

- `database-design` / `database-schema-designer` — Identity graph schema
- `backend-coding-agent` — Matching pipeline implementation
- `superpowers:test-driven-development` — TDD for identity matching
- `context7-docs` — Prisma relations documentation

## Work

### 1. Schema Design

**Design decision: extend existing models, don't replace them.**

The current `Creator` model is brand-scoped (unique on `[brandId, instagramHandle]`). A global identity layer sits *above* brands — the same influencer can be discovered by multiple brands. We add global identity models and link them to the existing brand-scoped Creator records.

```prisma
// ── Global Identity Layer (brand-agnostic) ──────────────────────

model InfluencerIdentity {
  id              String   @id @default(cuid())
  displayName     String?
  primaryLanguage String?
  homeRegion      String?
  mergedIntoId    String?  // soft-merge: points to canonical identity if merged
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  mergedInto      InfluencerIdentity?  @relation("IdentityMerge", fields: [mergedIntoId], references: [id])
  mergedFrom      InfluencerIdentity[] @relation("IdentityMerge")

  platformProfiles InfluencerPlatformProfile[]
  creators         Creator[] // brand-scoped Creator records linked to this identity

  @@index([mergedIntoId])
}

model InfluencerPlatformProfile {
  id              String   @id @default(cuid())
  influencerId    String
  platform        String   // "instagram" | "tiktok" | "youtube" | "twitter"
  platformUserId  String?  // native platform ID if known
  handle          String
  normalizedHandle String  // lowercase, trimmed, @-stripped
  profileUrl      String?
  profileImageUrl String?
  websiteUrl      String?
  bioText         String?
  isPrivate       Boolean  @default(false)
  isVerified      Boolean  @default(false)
  lastFetchedAt   DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  influencer      InfluencerIdentity @relation(fields: [influencerId], references: [id])

  edgesFrom       IdentityEdge[] @relation("EdgeFrom")
  edgesTo         IdentityEdge[] @relation("EdgeTo")
  contactPoints   ContactPoint[]
  metricsDaily    InfluencerMetricsDaily[]

  @@unique([platform, normalizedHandle])
  @@index([influencerId])
  @@index([platform, platformUserId])
}

model IdentityEdge {
  id              String   @id @default(cuid())
  fromProfileId   String
  toProfileId     String
  matchScore      Float    // 0.0 - 1.0
  matchBand       String   // "auto_linked" | "possible_match" | "rejected" | "human_confirmed"
  evidenceJson    Json     // { signals: [{type, value, weight}], method, version }
  createdAt       DateTime @default(now())
  reviewedBy      String?  // userId who reviewed (null if auto)
  reviewedAt      DateTime?
  reviewOutcome   String?  // "confirmed" | "rejected" | "deferred"

  fromProfile     InfluencerPlatformProfile @relation("EdgeFrom", fields: [fromProfileId], references: [id])
  toProfile       InfluencerPlatformProfile @relation("EdgeTo", fields: [toProfileId], references: [id])

  @@unique([fromProfileId, toProfileId])
  @@index([matchBand])
  @@index([reviewOutcome])
}

model ContactPoint {
  id              String   @id @default(cuid())
  profileId       String
  contactType     String   // "email" | "agency_email" | "manager_email" | "dm" | "form" | "website_contact"
  contactValue    String   // the actual email address, URL, etc.
  confidence      Float    // 0.0 - 1.0
  source          String   // where we found this contact
  isStale         Boolean  @default(false)
  lastVerifiedAt  DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  profile         InfluencerPlatformProfile @relation(fields: [profileId], references: [id])

  @@index([profileId])
  @@index([contactType, confidence])
}
```

**Link to existing Creator model:**

```prisma
model Creator {
  // ... existing fields ...
  influencerIdentityId String?  // NEW: link to global identity
  influencerIdentity   InfluencerIdentity? @relation(fields: [influencerIdentityId], references: [id])
}
```

### 2. Identity Matching Pipeline

**New file: `lib/identity/matching.ts`**

The matching pipeline runs after discovery and produces IdentityEdges. It uses multi-signal comparison:

**Matching signals and weights:**

| Signal | Method | Weight | Precision |
|---|---|---|---|
| Handle exact match | normalizedHandle equality across platforms | 0.25 | High when cross-platform |
| Display name similarity | Jaro-Winkler string distance | 0.15 | Medium |
| Bio text similarity | Cosine similarity of TF-IDF vectors | 0.10 | Medium |
| Website/link-in-bio overlap | URL domain normalization + match | 0.20 | High |
| Email domain match | Same email or same domain | 0.15 | High |
| Profile image hash | Perceptual hash (pHash) distance | 0.10 | High |
| Location consistency | Region/city string match | 0.05 | Low |

**Thresholds (Fellegi-Sunter inspired):**

```typescript
export const IDENTITY_THRESHOLDS = {
  AUTO_LINK: 0.82,    // High precision — merge automatically
  POSSIBLE_MATCH: 0.55, // Review queue — human decides
  REJECT: 0.55,       // Below possible = keep separate (implicit)
};
```

**Pipeline steps:**

```
1. For each new/updated profile:
   a. Generate comparison features (normalized handle, bio hash, image hash, etc.)
   b. Query existing profiles for potential matches:
      - Same handle on different platform
      - Same email domain
      - Similar display name + overlapping website
   c. Compute pairwise match score
   d. Classify: auto_link / possible_match / rejected
   e. If auto_link: assign to same InfluencerIdentity (or create one)
   f. If possible_match: create IdentityEdge with matchBand="possible_match"
   g. If rejected: create IdentityEdge with matchBand="rejected" (evidence trail)
```

**New file: `lib/identity/signals.ts`**

Individual signal computation functions:

```typescript
export function computeHandleMatchSignal(a: string, b: string, platformA: string, platformB: string): Signal;
export function computeNameSimilaritySignal(nameA: string | null, nameB: string | null): Signal;
export function computeWebsiteOverlapSignal(urlA: string | null, urlB: string | null): Signal;
export function computeEmailDomainSignal(emailA: string | null, emailB: string | null): Signal;
export function computeLocationSignal(regionA: string | null, regionB: string | null): Signal;
// Image hash deferred to Phase 20d (requires image fetching infrastructure)
```

### 3. Identity Resolution in the Discovery Pipeline

**Modify `lib/creator-search/job-runner.ts`:**

After `orchestrateUnifiedDiscovery()` returns candidates and after validation, add a new step:

```
Discovery → Validation → Identity Resolution → Persistence
```

The identity resolution step:
1. For each validated candidate, find or create an InfluencerPlatformProfile
2. Run the matching pipeline against existing profiles
3. Auto-link where confidence is high
4. Queue possible matches for review
5. Attach the resolved InfluencerIdentity to the Creator record

### 4. Contact Point Extraction

**Modify `lib/enrichment/service.ts`:**

Currently stores email directly on Creator. New flow:
1. Extract email → create ContactPoint with type="email", source, and confidence score
2. If email found via public profile: confidence=0.8
3. If email found via Apify keyword scrape: confidence=0.5
4. If email matches agency domain pattern: type="agency_email", confidence=0.6
5. Still copy best email to Creator.email for backward compatibility

**New file: `lib/identity/contact-extraction.ts`**

```typescript
export function extractContactPoints(profile: InfluencerPlatformProfile, sources: DiscoverySource[]): ContactPoint[];
export function scoreContactConfidence(contact: RawContact, source: string): number;
export function isAgencyEmail(email: string): boolean; // common patterns: @mgmt, @talent, @agency, @pr
```

### 5. Review Queue API

**New route: `app/api/identity/review/route.ts`**

```
GET  /api/identity/review          — list possible matches for brand's creators
POST /api/identity/review/[edgeId] — confirm or reject a match
```

Response includes evidence breakdown:
```json
{
  "edges": [{
    "id": "...",
    "fromProfile": { "platform": "instagram", "handle": "janedoe", "imageUrl": "..." },
    "toProfile": { "platform": "tiktok", "handle": "jane.doe", "imageUrl": "..." },
    "matchScore": 0.72,
    "evidence": [
      { "signal": "handle_similarity", "value": 0.85, "weight": 0.25 },
      { "signal": "website_overlap", "value": 1.0, "weight": 0.20 },
      { "signal": "name_similarity", "value": 0.60, "weight": 0.15 }
    ]
  }]
}
```

### 6. Backfill Existing Creators

**Migration script:**
1. For each existing Creator, create an InfluencerIdentity
2. Create InfluencerPlatformProfile from Creator + CreatorProfile records
3. Run matching pipeline on all profiles to detect existing duplicates
4. Link Creator.influencerIdentityId to the resolved identity
5. Extract existing emails into ContactPoint records

### 7. Tests

- Unit tests for each matching signal function
- Unit tests for threshold classification (auto/possible/reject)
- Unit tests for contact point extraction and confidence scoring
- Integration test: two creators with same handle on different platforms get auto-linked
- Integration test: similar-but-ambiguous creators land in review queue
- Test: backfill creates correct identity links for existing data

## Output

- New Prisma models: InfluencerIdentity, InfluencerPlatformProfile, IdentityEdge, ContactPoint
- `lib/identity/matching.ts` — identity matching pipeline
- `lib/identity/signals.ts` — individual signal computation
- `lib/identity/contact-extraction.ts` — contact point extraction + scoring
- Updated `lib/creator-search/job-runner.ts` — identity resolution step
- Updated `lib/enrichment/service.ts` — contact point creation
- `app/api/identity/review/` — review queue API
- Migration + backfill script
- Comprehensive test suite

## Handoff

Phase 20c builds the scoring engine on top of the identity graph. The scoring engine uses identity confidence (from IdentityEdge match scores), contact point confidence, and multi-source corroboration as input features. Without the identity graph, scoring would be limited to the same shallow signals available today. The `matchScore` and `evidenceJson` from IdentityEdges become first-class inputs to the fit score computation.
