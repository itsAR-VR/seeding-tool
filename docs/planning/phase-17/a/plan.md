# Phase 17a — Audit the Current Step-1 Intake Path and Define the Business DNA Contract

## Focus
Map the current onboarding brand-creation flow end to end, identify exactly what is scraped today versus what is missing, and define the typed Business DNA shape that later subphases will implement.

## Inputs
- Root context from `docs/planning/phase-17/plan.md`
- Current step-1 UI in `apps/web/app/(platform)/onboarding/page.tsx`
- Current route and raw scraper in:
  - `apps/web/app/api/onboarding/brand/route.ts`
  - `apps/web/lib/brands/profile.ts`
- Current downstream consumers:
  - `apps/web/lib/brands/icp.ts`
  - `apps/web/lib/brand/brand-identity.ts`

## Skills Available for This Subphase
- `find-local-skills` output: unavailable because the documented skill index is missing on this machine
- `find-skills` output: unavailable because no invokable tool is exposed in this environment
- Planned invocations:
  - `requirements-clarity`
  - `javascript-typescript`
  - `backend-development`

## Work
1. Document the current request/response contract for `POST /api/onboarding/brand`.
2. Separate the raw inputs into:
   - fetchable website metadata
   - visible text blocks
   - candidate media/image URLs:
     - `ogImage` — from `<meta property="og:image">`
     - `twitterImage` — from `<meta name="twitter:image">`
     - `heroImageCandidates` — `<img>` tags from `<main>` or first `<section>`, filtered:
       - Exclude SVGs (`src` ending in `.svg` or `data:image/svg+xml`)
       - Exclude tracking pixels (1×1 images, `src` containing known trackers)
       - Exclude images with explicit `width` or `height` attributes < 100px
       - Keep up to 5 candidates, ordered by DOM position
   - brand-entered data from the form
3. Define the first typed Business DNA schema for persistence. It should cover at minimum:
   - brand summary
   - category / niche
   - audience
   - voice / tone
   - key products or offers inferred from the site
   - supporting proof/signals pulled from raw scrape content
   - selected brand images or image candidates
4. Decide whether this schema lives inside `BrandSettings.brandProfile`, adjacent metadata, or a new nested contract inside the same JSON blob.
5. Record the degraded-path rules when fetch or model analysis fails.

## Validation (RED TEAM)

- Confirm the Business DNA schema field names include `targetAudience`, `niche`, `category`, `tone`, `brandVoice` — these are the exact property names `deriveBrandICP()` looks up at `icp.ts:114-130`
- Confirm the schema is designed to be merged into the existing `brandProfile` JSON blob (not a separate column) to avoid Prisma migration
- Confirm the degraded-path rules cover: (1) fetch fails → brand created with null profile, (2) fetch succeeds + model fails → raw profile stored without synthesis fields, (3) OPENAI_API_KEY missing → skip synthesis entirely
- Document which `BrandProfileSnapshot` fields are preserved vs overwritten by synthesis

## Assumptions / Open Questions (RED TEAM)

- **ICP field-name compatibility is the highest-priority constraint.** If the schema uses `target_audience` instead of `targetAudience`, ICP derivation silently returns null. This must be validated as part of the audit output, not left to implementation.
  - Current default: Use camelCase field names matching `icp.ts` expectations
- **Image candidates scope — LOCKED:** Extract OG image + Twitter image + hero `<img>` tags from `<main>`/first `<section>`. Filter out SVGs, tracking pixels, and images < 100px. Store as `heroImageCandidates: string[]` (up to 5 URLs). This is required, not optional enrichment.

## Output
A concrete contract for “raw website snapshot in, typed Business DNA out,” with:
- The exact TypeScript interface for the Business DNA schema (field names verified against `icp.ts` expectations)
- The file path for the synthesis helper (`apps/web/lib/brands/synthesis.ts`)
- The persistence strategy (merge into `brandProfile` JSON blob)
- The degraded-path rules (three failure scenarios documented)
- A list of `BrandProfileSnapshot` fields that are preserved vs enriched
- The `heroImageCandidates` extraction contract (filtering rules, max 5 candidates, sources: `<main>` or first `<section>`)

## Handoff
Phase 17b should implement the server-side synthesis pipeline against this contract, using structured model output rather than free-form completions. The schema field names MUST match exactly what was specified here — do not rename them.
