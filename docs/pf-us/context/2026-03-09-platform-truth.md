# P&F U.S. writer context, platform-truth pass

Date: 2026-03-09
Purpose: give writer-studio a reality-based platform brief for answering P&F U.S. questions without sales fluff.

## Top-line truth

The earlier answer overstated what the platform currently does.

Today, creator identification is **dataset-first + AI scoring**, not a fully configurable autonomous influencer-finding agent.

The current live app path works like this:
1. Brand onboarding optionally captures a website snapshot and stores it as `brandProfile`.
2. Campaign products and brand profile are converted into a lightweight ICP summary.
3. Search criteria + ICP keywords are used to filter a **local Collabstr JSONL dataset**.
4. The shortlisted creators are scored for brand fit either:
   - by the optional Fly worker, or
   - by local OpenAI fallback.
5. The scored creators are written into `Creator`, `CreatorProfile`, and `CampaignCreator` rows.

## Exact identification flow

### 1) Brand context / ICP generation
- Brand onboarding accepts `name` and optional `websiteUrl`.
- If `websiteUrl` is provided, the app fetches the page HTML and extracts:
  - title
  - description / OG / Twitter metadata
  - top H1/H2 headings
  - body text signals
- That snapshot is stored as `BrandSettings.brandProfile`.
- Campaign products are also included in the brand ICP.
- The actual derived ICP currently boils down to:
  - brand name
  - website URL
  - target audience if present in `brandProfile`
  - niche/category if present in `brandProfile`
  - brand voice
  - campaign products
  - a human-readable summary string
- ICP keywords are built mostly from:
  - niche
  - target audience
  - up to 3 product names

Important limitation:
- there is **not** currently a rich backend rule engine for custom influencer persona logic.
- there is no explicit UI today for configuring advanced fit logic like weighted scoring dimensions.

## 2) Search inputs that actually exist today
The real campaign search API currently accepts:
- `platform`
- `keywords[]`
- `minFollowers`
- `maxFollowers`
- `category`
- `location`
- `limit`

Important limitation:
- there is **no direct search input for engagement rate threshold, avg views threshold, conversion signals, audience demographics, or custom weighted performance metrics** in the current campaign search path.
- those things were overstated in the earlier answer.

## 3) Discovery source
Current source is the local file:
- `scripts/collabstr-influencers.jsonl`

This means:
- the search is **not** currently open-web discovery
- it is **not** currently crawling Instagram broadly on demand
- it is **not** currently querying Meta Creator Marketplace directly in the app path
- it is filtering and scoring against the existing local dataset first

## 4) How shortlist filtering works
A creator is shortlisted if:
- follower count passes min/max filters
- niche text matches category if provided
- location text matches location if provided
- and the creator text blob matches at least one merged keyword

The merged keyword haystack is simple text matching against fields like:
- niche
- bio
- name
- profileDump
- instagram handle

Important limitation:
- this is currently **string matching + ranking**, not a sophisticated semantic retrieval layer.

## 5) How fit scoring works
After shortlist generation, the system scores creators using a prompt that includes:
- brand summary
- creator handle
- creator niche
- creator bio / profile snippet
- follower count

The AI returns JSON:
- `score`
- `reasoning`
- `approved`

Approval threshold is effectively:
- approve if score >= 0.65

Important limitations:
- the current scoring prompt is relatively compact
- there is no formal evaluation harness proving accuracy yet
- there is no quantified benchmark for "match quality"
- accuracy claims should be presented as directional, not scientific

## 6) Worker vs local scoring
If these env vars are present in the web app:
- `CREATOR_SEARCH_WORKER_BASE_URL`
- `CREATOR_SEARCH_WORKER_TOKEN`

then the app tries the Fly worker first.

If worker is unavailable or fails, it falls back to local OpenAI scoring.

Important truth:
- the worker does **not** discover creators by itself from the open web in the current integration
- it receives a pre-filtered creator list from the app and scores those creators
- if `profileDump` is missing, it may open the creator profile URL with Playwright and scrape `document.body.innerText`

## 7) Throughput / how fast a list populates
The current search path is effectively synchronous from the app user’s point of view.

What actually happens:
- user clicks Discover Creators
- API call runs search immediately
- shortlist is filtered from dataset
- creators are scored
- results are persisted
- API returns counts like `added`, `analyzed`, `usedWorker`

Current built-in limits:
- app default search limit is 20, clamped to max 25
- worker only analyzes up to 10 creators per call
- local fallback scores up to the requested limit

So any external answer should avoid pretending this is a giant background autonomous crawl.
It is closer to:
- dataset filter
- small-batch AI fit scoring
- immediate persistence into campaign records

## 8) Credits, real behavior
The platform has credit costs defined for:
- `creator_search`: 5
- `collabstr_search`: 1
- `ai_fit_score`: 1 each
- `enrichment`: 2

Current creator-search debit is:
- base Collabstr search cost
- plus per-creator AI fit score cost
- plus creator_search worker cost if Fly worker was used

Important truth:
- if credits are too low, current code logs a warning and continues for verification rather than hard-blocking the search.
- so credits enforcement is not fully fail-closed today.

## 9) Review flow truth, and an important mismatch
The UI copy says matching creators are added to the review queue.

But the current persistence logic actually creates `CampaignCreator` rows as:
- `reviewStatus: "approved"` when AI approved
- `reviewStatus: "declined"` when AI declined
- `lifecycleStatus: "ready"` or `"stalled"`
- `reviewedAt` is written immediately

So the current implementation is **not** a pure pending-review queue for creator search results.

This is important because any external answer that says "it always lands in a human review queue" is not fully true for the current code path.

## 10) Separate workspace truth
The data model supports multiple brands/workspaces via:
- `Organization`
- `Client`
- `Brand`
- `BrandMembership`

So conceptually yes, P&F U.S. can exist as its own brand/workspace.

But there is a real implementation caveat:
- many routes simply load the **first** `BrandMembership` for the current user with `orderBy: { createdAt: "asc" }`
- so multi-brand / multi-workspace support is **not fully surfaced or safely switchable everywhere**

That means the truthful answer is:
- the schema supports separate workspaces
- the current app UX and routing still have first-brand assumptions
- so a clean P&F sandbox may require either:
  - dedicated brand-switching work, or
  - a separate deployment / isolated environment if we want zero cross-brand ambiguity

## 11) What deployment actually means right now
The current architecture is:
- Next.js web app
- Supabase auth
- Prisma-backed database
- optional Fly.io creator-search worker for Playwright + scoring assistance

To deploy the stronger creator-identification path, you need:
- web app deployed with brand + campaign search routes
- database migrated
- optional Fly worker deployed with:
  - `CREATOR_SEARCH_WORKER_TOKEN`
  - `OPENAI_API_KEY`
- web app env configured with:
  - `CREATOR_SEARCH_WORKER_BASE_URL`
  - `CREATOR_SEARCH_WORKER_TOKEN`

## 12) How to answer accuracy questions truthfully
Do **not** say things like:
- "it learns your ideal influencer over time" unless we mean manual rubric iteration, not a formal training loop
- "it uses performance metrics and advanced scoring rules" unless we explicitly say those are future/planned, not current default behavior
- "it can accurately match audience demographics" because that is not what the current path proves

Safer truthful framing:
- today it is strongest as a shortlist-and-fit-score workflow over an existing creator dataset
- it can use brand website context, products, and a few search filters to improve relevance
- match quality depends heavily on the quality of the brand profile, campaign products, keyword filters, and dataset coverage
- current accuracy is practical but not yet benchmarked with a formal eval suite
- the best use right now is assisted discovery + ranking, not blind trust in fully autonomous identification

## 13) Biggest gaps writer-studio should not paper over
1. Separate workspace support is conceptually present, but first-brand assumptions still exist in app routes.
2. Search is against a local Collabstr dataset, not broad live web discovery.
3. Search criteria are narrower than the earlier answer implied.
4. Performance-metric configuration is not first-class in the current campaign search path.
5. Review queue behavior is currently inconsistent with UI copy.
6. Accuracy is not benchmarked.
7. Worker path helps score / verify, but does not magically create a universal influencer search engine.

## Source files reviewed
- `apps/web/app/api/onboarding/brand/route.ts`
- `apps/web/lib/brands/profile.ts`
- `apps/web/lib/brands/icp.ts`
- `apps/web/lib/brand/brand-identity.ts`
- `apps/web/lib/workers/creator-search.ts`
- `workers/creator-search/server.mjs`
- `workers/creator-search/README.md`
- `apps/web/app/api/campaigns/[campaignId]/search/route.ts`
- `apps/web/app/(platform)/campaigns/[campaignId]/_components/TriggerSearchButton.tsx`
- `apps/web/app/(platform)/campaigns/[campaignId]/discover/page.tsx`
- `apps/web/app/(platform)/campaigns/[campaignId]/review/page.tsx`
- `apps/web/app/api/campaigns/[campaignId]/creators/[creatorId]/review/route.ts`
- `apps/web/app/api/brands/current/route.ts`
- `apps/web/app/api/brands/[brandId]/route.ts`
- `apps/web/lib/credits.ts`

## What writer-studio should do with this
Write a response that:
- sounds confident but not fluffy
- explains the current platform honestly
- distinguishes clearly between:
  - what exists now
  - what is partial
  - what is planned / possible next
- does not oversell configurability, autonomy, accuracy, or workspace isolation
- gives P&F U.S. a realistic test plan based on the actual current product
