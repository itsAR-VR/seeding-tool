# Phase 1 RED TEAM Analysis

## Repo Reality ✅
- ✅ Creator model exists with all referenced fields (name, email, instagramHandle, bioCategory, imageUrl, followerCount, discoverySource)
- ✅ CreatorProfile model exists (platform, handle, url) — used for TikTok handles
- ✅ `@@unique([brandId, instagramHandle])` constraint exists — natural dedup key
- ✅ Brand ID `9d4f824b-639a-43ce-93f9-cbf233912f91` (Sleepkalm) exists in DB
- ✅ Apify enrichment already built (lib/enrichment/) — can reuse for IG email extraction

## Data Model ✅
- ✅ No schema changes needed — all fields already exist
- ✅ `discoverySource` will be tagged as "collabstr"
- ⚠️ No dedicated `location` field on Creator — plan uses `bio` field (acceptable)
- ⚠️ TikTok handle storage: plan uses CreatorProfile record (correct), but needs `creatorId` foreign key — verified exists

## Gaps Found

### GAP 1: Collabstr rate limiting / anti-bot (MEDIUM)
- **Risk:** Collabstr may use Cloudflare, CAPTCHAs, or rate limiting that blocks automated scraping
- **Mitigation:** Use real browser (not headless), add human-like delays (2-5s random), use session cookies from manual login
- **Confidence:** 78% — need to validate during recon subphase
- **Fallback:** If blocked, extract from page source / API calls visible in network tab

### GAP 2: Collabstr directory size unknown (LOW)
- **Risk:** Don't know if it's 500 or 50,000 influencers — affects runtime estimates
- **Mitigation:** Count during recon phase, adjust batch strategy accordingly
- **Confidence:** 90%

### GAP 3: IG email bio scraping at scale (MEDIUM)
- **Risk:** Instagram blocks automated profile visits aggressively (login walls, rate limits)
- **Mitigation:** Use existing Apify enrichment service instead of direct IG scraping. Apify handles proxy rotation.
- **Decision:** Skip direct IG scraping → use Apify enrichment post-scrape
- **Confidence:** 92%

### GAP 4: Credential storage (LOW)
- **Risk:** Collabstr credentials in plan file
- **Mitigation:** Move to `.env.local` before execution, never in memory files
- **Action:** Store as `COLLABSTR_EMAIL` and `COLLABSTR_PASSWORD` in `.env.local`
- **Confidence:** 98%

### GAP 5: Concurrent write conflicts (LOW)
- **Risk:** Background scraper writing to same Creator table while other operations (enrichment, import) run
- **Mitigation:** Upsert with `instagramHandle` + `brandId` unique constraint — Prisma handles this
- **Confidence:** 95%

### GAP 6: Competitor platforms need AR account creation (BLOCKER-HUMAN)
- **Status:** AR confirmed they'll handle account creation
- **Platforms identified for AR:** Heepsy, Influence.co, Afluencer, JoinBrands, Hypefy
- **Action:** Document platforms, AR creates accounts, then we log in and scrape
- **Confidence:** 95%

## RED TEAM Checklist Results

| Check | Status | Notes |
|-------|--------|-------|
| Referenced files exist | ✅ | All Prisma models and fields verified |
| Schema changes needed | ✅ | None — existing model sufficient |
| Auth/secret checks | ✅ | Collabstr creds via env vars |
| Input validation | ✅ | All scraped data treated as untrusted, sanitized before DB write |
| Timeouts and retries | ✅ | Planned in script (retry failed pages, resume from checkpoint) |
| Idempotency/dedup | ✅ | `@@unique([brandId, instagramHandle])` + upsert |
| Success criteria measurable | ✅ | ≥90% directory, min name+handle+niche per creator |
| Error surfacing | ✅ | Checkpoint reporting + error log file |
| Multi-agent overlap | ✅ | No other phases active. Recent commits only add new files, no conflicts |
| Human input items captured | ✅ | GAP 6: competitor account creation |

## Refined Execution Order

1. **Recon** (subphase 1.1) — browser snapshot of Collabstr, identify selectors, count pages
2. **Login** (1.2) — authenticate via browser, store session
3. **Build script** (1.3) — Playwright scraper with pagination, per-profile extraction, DB upsert
4. **Execute** (1.4) — autonomous background with checkpoints every 50 creators
5. **Enrich** (1.5) — use existing Apify service for email enrichment (skip direct IG scraping)
6. **Competitor research** (1.6) — document platforms, return list for AR

## Open Questions (Need Human Input)

None below 84.7% confidence that blocks execution. Proceeding autonomously.

## Skills Available
- `browser-automation` — for Playwright/browser control
- `coding-agent` — for script building if needed
- Direct browser tool — OpenClaw browser control for recon

## Skills Missing
- No dedicated scraping skill — browser-automation covers the use case
