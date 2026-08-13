# Phase 26 — Deep Sweep Findings

Date: 2026-04-08
Models: Opus 4.6 (5 parallel deep analysis agents) + GPT-5.4 (Codex cross-verification) + Opus cross-comparison agent

## Confidence After Sweep

| Phase | Before | After | Key Risk |
|-------|--------|-------|----------|
| 24c HTML Templates | 70% | **88%** | Three send paths (not two); bodyHtml through entire chain |
| 25c Embeddings | 35% | **32%** | DEFERRED — calibration contamination, no infrastructure, score distribution shift |
| 26a Mention Enhancement | 75% | **85%** | Plan premise was wrong (lifecycle already works); descoped @mentions |
| 26b Multi-Platform | 60% | **72%** | 29-file instagramHandle blast radius; UnifiedDiscoveryPlatform literal |
| 26c Analytics Dashboard | 85% | **88%** | Page is 301 lines not minimal; needs recharts; 11 stages not 5 |

---

## CRITICAL Findings

### 26a-C1: Plan premise factually wrong — lifecycle wiring already works
`createAndAttributeMention()` in `attribution.ts` ALREADY calls `attributeMention()` which sets `lifecycleStatus = "posted"` and fires `recordOutcomeEvent()`. The poll at `instagram-mention-poll.ts:146` already calls it with `campaignCreatorId`. Work item 1 was already done.
**Resolution**: Removed Work item 1. Rescoped 26a to: pagination, token refresh, feature flag, testing.

### 26b-C1: Creator.instagramHandle baked into unique constraint
`Creator` model has `@@unique([brandId, instagramHandle])`. 29 files reference `instagramHandle` directly. No TikTok equivalent exists.
**Resolution**: Backward-compatible approach — add `tiktokHandle` to Creator (same pattern), do NOT remove `instagramHandle`. Avoids 29-file migration.

### 26b-C2: UnifiedDiscoveryPlatform is a literal, not a union
`contracts.ts:19` has `"instagram"` literal. Zod schema uses `z.literal("instagram")` — rejects anything else.
**Resolution**: Widen to `"instagram" | "tiktok"`. Update Zod to `z.enum(["instagram", "tiktok"]).default("instagram")`.

### 26c-C1: No charting library in package.json
Zero chart dependencies. Plan calls for visualizations without specifying library.
**Resolution**: Install `recharts`. Best fit for React/shadcn ecosystem.

### 25c-C1: Score distribution shift breaks triage thresholds
Cosine similarity (0.6-0.8) vs keyword overlap (0.1-0.4). A +0.1125 composite score increase from topical match alone pushes borderline candidates across AUTO_SHORTLIST (0.8) and REVIEW (0.65) thresholds.
**Resolution**: DEFERRED. Need score normalization layer and 60-90 days calibration data.

### 25c-C2: Calibration data contamination
Mixing keyword-era and embedding-era `scoreComponentsAtSeed` in calibration report produces meaningless correlations.
**Resolution**: Add `scoringVersion` field to `CampaignOutcome`. DEFERRED with rest of 25c.

### 25c-C3: No embedding/vector infrastructure exists anywhere in repo
Codex confirmed: grep for `embedding|vector|pgvector|cosine` returned zero implementation hits.
**Resolution**: Foundation work needed before 25c can proceed. DEFERRED.

---

## HIGH Findings

### 24c
- H1: THREE send paths, not two — mention-check.ts is the third caller of sendEmail()
- H2: `SendEmailParams`, `DraftToSend`, `GeneratedDraft` all lack `bodyHtml`
- H3: Bulk outreach drafts are transient JSON (not AIDraft rows) — `/api/outreach/draft` returns `{ subject, body }` only. HTML must be generated at send time for this path.
- H4: `buildRawEmail()` lacks MIME boundary generation for multipart/alternative
- H5: Template variables use raw `.replace()` with no HTML escaping (XSS)
- H6: Message.bodyHtml exists in schema but never written for outbound messages (two creation sites)
- H7: AIDraft model has no bodyHtml field
- H8: OutreachTemplate model has no bodyHtml column

### 25c
- H1: JSON embedding storage risks metadata collision (CreatorProfile.metadata is the real hotspot, confirmed by Codex)
- H2: AIArtifact is thread-scoped — wrong model for batch scoring logs
- H3: No embedding model versioning — cached embeddings become incomparable on model change
- H4: Cost estimation missing — 75 embedding calls per search run with no batch optimization
- H5: Feature flag should be per-brand (not env var) following established pattern

### 26a
- H1: getMentionedMedia() requires mediaId — cannot enumerate mentions like tags. @mention detection requires webhook subscription.
- H2: Poll only processes first page of getTaggedMedia results — misses older tagged media
- H3: refreshLongLivedToken() exists but has ZERO callers — tokens expire silently after 60 days

### 26b
- H1: No Apify TikTok actors exist — plan doesn't specify which actor or response mapping
- H2: All 4 orchestrator discovery lanes hardcoded to Instagram Apify actors (Codex correction: 3 Apify + 1 DB lane, but all Instagram-centric)
- H3: validation-ops.ts hardcodes `platform: "instagram"` at 3 locations. job-runner.ts at 4 locations.
- H4: All Inngest validation functions directly import `validateInstagramCreators`

### 26c
- H1: Plan used 5 lifecycle stages — actual schema has 11
- H2: Existing analytics page is 301 lines with full Server Component implementation (NOT minimal)
- H3: Page is Server Component but interactive features need Client Components — architecture decision needed

---

## MEDIUM Findings

### 24c
- M1: Extract unsubscribe URL generation from buildRawEmail into standalone utility
- M2: Gmail clips messages >102KB — images must be URLs, not data URIs
- M3: In-Reply-To/References headers not passed by inbox reply route

### 25c
- M1: Campaign brief embedding staleness — ICP summary changes after embedding cached
- M2: Fallback path creates score discontinuity in mixed batches
- M3: Latency budget not accounted for — 75 concurrent OpenAI calls

### 26a
- M1: `"reminded"` status in matching filter but never set anywhere
- M2: No feature flag for mention polling per-brand
- M3: Matching false-positive risk — returns first candidate when no handle match

### 26b
- M1: Proposed interface too simple — need batch interface with platform-specific options
- M2: "Best platform metrics" scoring strategy undefined
- M3: Discovery speed impact not analyzed

### 26c
- M1: API route missing conversion rates, time-to-post, leaderboard data
- M2: No CSV export pattern exists in codebase
- M3: Test plan incomplete (3 tests → 11 tests)

---

## Cross-Subphase Interactions

### Resource Conflicts
- `schema.prisma`: Touched by 24c, 25c (deferred), 26a, 26b. Serialize migrations.
- `features.ts`: Touched by 25c (deferred) and 26b. If 25c un-defers, must coordinate with 26b.
- `orchestrator.ts`: Touched by 25c (deferred) and 26b. Same coordination needed.

### Dependency Chain
26a → 26b → 26c (sequential). 24c is independent. 25c is deferred.

### Assumption Conflicts
- 26b assumes `instagramHandle` can be migrated; resolution: backward-compatible addition instead
- 25c assumes JSON storage sufficient; 26b may increase creator volume. Resolution: 25c deferred, will re-evaluate storage when it un-defers.

---

## Execution Order (Updated)

### Tier 2 (next to build — all deps met):
- **24c** (HTML templates) — independent, can run in parallel with 26a

### Tier 3 (sequential after Tier 2):
- **26a** (mention enhancement) — after 24c for template reuse
- **26b** (multi-platform) — after 26a (uses instagramHandle)
- **26c** (analytics) — after 26a (needs mention data)

### Deferred:
- **25c** (embeddings) — 32% confidence, needs 60-90 days calibration data + prerequisite infrastructure

---

## All Plans Auto-Corrected

Per Phase 6.5 of the deep-sweep procedure, all subphase plan.md files have been updated on disk with corrections incorporated. The confidence numbers above reflect the CORRECTED plans, not the originals.
