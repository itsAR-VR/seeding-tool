# Phase 7e - Humanize copy, polish interactions, and verify with Playwright

## Focus
Finish the redesign with human copy, disciplined interaction polish, and evidence-driven browser verification. This subphase produces the QA evidence that proves the redesign is ship-ready.

## Inputs
- `docs/planning/phase-7/plan.md` (success criteria, constraints)
- `docs/planning/phase-7/a/brief.md` (copy posture, banned patterns)
- All implemented files from 7b-7d:
  - `apps/web/app/components/HomeContent.tsx`
  - `apps/web/app/components/PricingContent.tsx`
  - `apps/web/app/components/Shell.tsx`
  - `apps/web/app/components/HeroScene.tsx`
  - `apps/web/app/components/CtaLink.tsx`
  - `apps/web/app/globals.css`
- `playwright.config.ts` (existing config at repo root)
- `package.json` (existing `@playwright/test` devDep)

## Work

### Step 1 — Copy humanization pass
- Invoke skills: `humanizer`, `copywriting`
- Read all marketing copy in `HomeContent.tsx`, `PricingContent.tsx`, `Shell.tsx`, and `CtaLink.tsx`
- Remove AI-sounding phrasing, repetitive CTA language, sterile sentence rhythm
- Apply the copy posture from 7a brief:
  - **BANNED** (grep for and remove ALL instances): "request teardown", "book a teardown", "workflow teardown", "map this phase", "AI-powered", "intelligent automation"
  - Prefer: operational language, concrete outcomes, human voice
- Check heading hierarchy for SEO and readability
- Verify CTA labels are clear and human (per 7a brief alternatives)

### Step 2 — Interaction polish pass
- Review spacing and visual hierarchy on both routes
- Check hover/focus behavior on all interactive elements (buttons, links, FAQ accordions, cards)
- Verify mobile layout at 390px viewport:
  - Sticky CTA does not cover hero content or pricing details
  - Hamburger nav opens and closes cleanly
  - Forms are reachable and usable
- Check reduced-motion behavior:
  - All animations suppressed
  - Hero shows static composition
  - Reveal animations show content immediately

### Step 3 — Update playwright config for automated use
- Edit `playwright.config.ts`:
  - Set `headless: true` (or `process.env.HEADED === 'true'` for flexibility)
  - Add `baseURL: 'http://localhost:3000'` to `use` config
  - Confirm viewport projects (desktop 1440x900, mobile 390x844) are correct for the redesign

### Step 4 — Create Playwright test files
- Create `tests/marketing-redesign.spec.ts` with tests for:
  - **Route load tests:**
    - `/` returns 200, has expected `<h1>`, no console errors
    - `/pricing` returns 200, has expected `<h1>`, no console errors
  - **Desktop layout tests (1440x900):**
    - Homepage hero is visible above the fold
    - Navigation shows all links (no hamburger on desktop)
    - Pricing shows 3 tier cards in a row
  - **Mobile layout tests (390x844):**
    - Hamburger toggle opens and closes nav
    - Mobile sticky CTA is visible
    - Sticky CTA does not overlap pricing card content
  - **Screenshot baselines:**
    - Capture full-page screenshots for `/` desktop, `/` mobile, `/pricing` desktop, `/pricing` mobile
    - Save as baseline references in `tests/screenshots/`
  - **Reduced-motion test:**
    - Set `prefers-reduced-motion: reduce` via `page.emulateMedia()`
    - Verify hero content is visible (no opacity: 0 stuck state)
    - Verify no CSS animations are running
  - **Form submission test:**
    - Fill and submit the homepage form
    - Verify success state is shown (or graceful degradation without `FORM_WEBHOOK_URL`)
    - Fill and submit the pricing form
    - Verify same success behavior
  - **Copy audit test:**
    - Grep page content for banned phrases: "request teardown", "AI-powered", "intelligent automation"
    - Assert zero matches

### Step 5 — Run the QA gates
- Start the production build: `npm run web:build && cd apps/web && npm run start`
- Run Playwright: `npx playwright test tests/marketing-redesign.spec.ts`
- Record pass/fail results
- If failures:
  - Fix the issues in the relevant component/CSS files
  - Re-run until all tests pass
- Stop the server after tests complete

### Step 6 — Produce the ship-readiness checklist
- Document in this plan's Output section:
  - All Playwright test results (pass/fail per test)
  - Screenshot locations
  - Any acceptable follow-up issues (not blockers) vs. must-fix blockers
  - Final `npm run web:build` confirmation

## Skills to invoke during this subphase
- `humanizer` — remove all AI-sounding phrasing
- `impeccable:polish` — final visual quality pass
- `impeccable:critique` — UX evaluation before ship
- `copywriting` — final copy refinement
- `form-cro` — final form usability check
- `playwright-testing` — automated QA verification

## Output
- Modified files:
  - `apps/web/app/components/HomeContent.tsx` (copy humanized)
  - `apps/web/app/components/PricingContent.tsx` (copy humanized)
  - `apps/web/app/globals.css` (polish fixes if any)
  - `playwright.config.ts` (headless + baseURL)
- New files:
  - `tests/marketing-redesign.spec.ts`
  - `tests/screenshots/` (baseline screenshot directory)
- QA evidence:
  - All Playwright tests passing
  - Screenshot baselines captured
  - Ship-readiness checklist documented in this plan

### Execution Result - 2026-03-05
- Updated `playwright.config.ts` for headless local regression testing with `baseURL`, `testDir`, and `webServer`.
- Created `tests/marketing-redesign.spec.ts` and `tests/screenshots/.gitkeep`.
- Ran `npx playwright test tests/marketing-redesign.spec.ts` with results:
  - 9 passed
  - 1 skipped (desktop skip for the mobile-only sticky CTA test)
- Captured screenshots:
  - `tests/screenshots/home-desktop.png`
  - `tests/screenshots/home-mobile.png`
  - `tests/screenshots/pricing-desktop.png`
  - `tests/screenshots/pricing-mobile.png`
- Confirmed the banned CTA and generic AI phrases are absent from homepage and pricing content.

## Coordination Notes

**Integrated from prior subphases:** shared shell behavior, real Server Action form, homepage hero rewrite, and pricing decision-page structure.
**Files affected:** `playwright.config.ts`, `tests/marketing-redesign.spec.ts`, `tests/screenshots/.gitkeep`
**Potential conflicts with:** future marketing or platform changes that alter route copy, hero structure, or sticky CTA behavior
**Integration notes:** kept the regression file focused on the current marketing routes so later changes can extend it without weakening the current visual and behavioral assertions.

## Handoff
After this subphase, the redesign is ready for implementation review, stakeholder review, or deployment. The Playwright test file serves as a regression gate for future changes.

## Validation (RED TEAM)
- `npm run web:build` passes
- `tests/marketing-redesign.spec.ts` exists
- `npx playwright test` passes with zero failures
- No console errors on `/` or `/pricing` in any viewport
- Screenshots captured for all 4 route/viewport combinations
- Reduced-motion test confirms no stuck opacity:0 elements
- Copy contains zero instances of "request teardown", "book a teardown", "workflow teardown", "map this phase", "AI-powered", or "intelligent automation"
- Form submission works on both `/` and `/pricing` (success state shown)
- Mobile sticky CTA does not visually overlap hero or pricing card content (verified by screenshot)

## Assumptions / Open Questions (RED TEAM)
- Playwright tests run against a local production build on port 3000 (confidence ~90%)
  - Why it matters: dev mode may have different behavior (e.g., HMR overlays, slower rendering)
  - Current default: test against `next build && next start`
- Screenshot baselines are stored in git (confidence ~85%)
  - Why it matters: if screenshots are too large or environment-dependent, they may cause flaky tests
  - Current default: store in `tests/screenshots/` and commit
