# Phase 17b — Implement Doc-Backed Website Synthesis with GPT-5-Mini and Typed Persistence

## Focus
Add the server-side analysis layer that converts raw website content into a typed Business DNA artifact using the current OpenAI JavaScript API patterns confirmed through docs.

## Inputs
- Contract from `docs/planning/phase-17/a/plan.md`
- Current raw scraper in `apps/web/lib/brands/profile.ts`
- Current onboarding brand route in `apps/web/app/api/onboarding/brand/route.ts`
- Context7 findings:
  - `openai.chat.completions.parse(...)` supports typed parsing in JavaScript with `zodResponseFormat(...)`
  - `POST /v1/responses` supports strict `json_schema` structured outputs, but this phase should prefer the chat parse helper for consistency with the repo

## Skills Available for This Subphase
- `find-local-skills` output: unavailable because the documented skill index is missing on this machine
- `find-skills` output: unavailable because no invokable tool is exposed in this environment
- Planned invocations:
  - `context7-docs`
  - `backend-development`
  - `javascript-typescript`
  - `react-dev`

## Work
1. Create `apps/web/lib/brands/synthesis.ts` with a `synthesizeBusinessDna()` function.
   - Input: `BrandProfileSnapshot` + brand name
   - Output: typed Business DNA fields (using the schema from 17a)
   - Field names MUST include: `targetAudience`, `niche`, `category`, `tone`, `brandVoice`, `brandSummary`, `keyProducts`, `proofSignals` — verified against `icp.ts:114-130` expectations
2. Use `openai.chat.completions.parse()` with `zodResponseFormat(...)` for structured output.
   - Model: **`gpt-5-mini`** (confirmed by user)
   - Import pattern: `import OpenAI from "openai"` + `new OpenAI({ apiKey: process.env.OPENAI_API_KEY })` (matches `apps/web/lib/ai/outreach-drafter.ts:4-9`)
   - Add `AbortSignal.timeout(20_000)` to the model call
3. Feed the helper:
   - brand name (from form input)
   - normalized website URL
   - raw text signals/headings/metadata from `fetchBrandProfile` output
   - OG image + twitter image URLs + hero image candidates (up to 5 `<img>` URLs from `<main>`/first `<section>`, filtered per 17a contract)
4. Update `apps/web/app/api/onboarding/brand/route.ts` to:
   - Call `synthesizeBusinessDna()` after `fetchBrandProfile()` succeeds
   - Check `process.env.OPENAI_API_KEY` before attempting synthesis — skip if missing
   - Merge synthesis output into the `brandProfile` JSON blob alongside existing `BrandProfileSnapshot` fields
   - Total timeout budget: 8s fetch + 20s model = 28s max
5. Preserve a non-destructive degraded path:
   - if fetch succeeds and model fails → keep the raw profile without synthesis fields (log warning)
   - if fetch fails but the brand name is valid → create brand with null profile (existing behavior)
   - if OPENAI_API_KEY is missing → skip synthesis, store raw profile only (log info)
6. **Update all existing `gpt-4o-mini` model strings in the codebase to `gpt-5-mini`.**
   - Search all files for `gpt-4o-mini` and replace with `gpt-5-mini`
   - Verify no runtime regressions by checking that affected modules still compile
7. Add vitest unit test at `apps/web/__tests__/brands/synthesis.test.ts`:
   - Test: valid `BrandProfileSnapshot` input → output has expected field names
   - Test: model failure → returns null gracefully
   - Test: output field names match `deriveBrandICP()` lookup expectations

## Validation (RED TEAM)

- Run `npx vitest run apps/web/__tests__/brands/synthesis.test.ts` — all pass
- Run `npx vitest run apps/web/__tests__/brands/profile.test.ts` — still passes (no regression)
- Confirm `deriveBrandICP()` can successfully extract `targetAudience`, `niche`, `brandVoice` from a `brandProfile` blob that includes synthesis fields
- Verify the brand route still works when `OPENAI_API_KEY` is unset (degraded path)

## Assumptions / Open Questions (RED TEAM)

- **`chat.completions.parse` over `responses.parse`** — The repo already uses chat completions everywhere else, so the typed parse helper is the lowest-risk structured-output path here.
- **Synchronous call confirmed** — User locked the decision: synthesis runs inline in the POST handler. Total wait budget: 8s fetch + 20s model = 28s max. The UI (17c) MUST cover up to ~30s with extended cinematic animation. No background processing or polling needed.

## Output
Implemented.

- Added `apps/web/lib/brands/synthesis.ts` with a `gpt-5-mini` Business DNA synthesis pass using `openai.chat.completions.parse()` plus `zodResponseFormat(...)`, which is the Context7-backed structured-output path chosen for this repo.
- Expanded `apps/web/lib/brands/profile.ts` so raw extraction now captures `heroImageCandidates`, rejects non-HTML fetches, and exposes `BrandBusinessDna`-compatible fields on the stored profile blob.
- Updated `apps/web/app/api/onboarding/brand/route.ts` to:
  - synthesize Business DNA after a successful scrape,
  - persist partial vs complete analysis metadata,
  - preserve degraded paths when fetch/model/env fail,
  - return the enriched profile to the client for the reveal state,
  - set `BrandSettings.brandVoice` from the synthesized profile when available.
- Added `apps/web/lib/brands/signals.ts` and refactored `apps/web/lib/brands/icp.ts` to use the pure compatibility helper instead of hardcoding the field-name lookup inside the Prisma-backed module.
- Updated all `gpt-4o-mini` references under `apps/web` to `gpt-5-mini`.
- Normalized the GPT-5-mini chat-completions parameter contract against live behavior and current docs:
  - replaced `max_tokens` with `max_completion_tokens`,
  - removed unsupported `temperature`,
  - kept the synthesis response schema concise enough to fit within the completion budget.
- Added `apps/web/__tests__/brands/synthesis.test.ts` and extended `apps/web/__tests__/brands/profile.test.ts` to cover hero-image extraction/filtering and Business DNA compatibility fields.

## Handoff
Phase 17c is unblocked and should assume the route now returns `{ brandId, slug, brandProfile, analysisStatus, analysisNote }`. The client can render the real synthesized Business DNA instead of re-fetching or faking a reveal state.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Implemented the raw scrape + hero-image candidate extraction contract.
  - Added the typed GPT-5-mini synthesis helper and merge logic for partial/complete analysis states.
  - Wired the onboarding brand route to persist enriched profile data and return it to the client.
  - Refactored ICP signal extraction into a pure helper so compatibility can be tested without Prisma.
  - Replaced every `gpt-4o-mini` model string in `apps/web` with `gpt-5-mini`.
  - Fixed the live GPT-5-mini runtime incompatibilities discovered during localhost verification (`max_tokens`, `temperature`).
- Commands run:
  - `npx vitest run __tests__/brands/profile.test.ts __tests__/brands/synthesis.test.ts __tests__/brands/category-suggestions.test.ts` — pass (`10/10` tests)
  - `npx tsc -p tsconfig.json --noEmit` — pass
  - `npx eslint ...` across touched backend files — pass
  - `rg -n 'gpt-4o-mini' apps/web -g '!**/.next/**'` — pass (zero matches)
- Blockers:
  - None inside 17b.
- Next concrete steps:
  - None. This subphase is complete.
