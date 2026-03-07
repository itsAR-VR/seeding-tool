# Phase 10d — Code quality + typography cleanup

## Focus
Fix the remaining high and medium audit issues: remove all `!important` declarations, fix typography issues (eyebrow size, proof rail copy, Georgia outlier), reduce unnecessary `backdrop-filter` usage, add required field indicators, and add `will-change` hints.

## Inputs
- Phase 10c output (layout variety established, intelligence fixed, hero upgraded)
- Audit findings: H2 (21 !important), H3 (eyebrow size), H5 (proof rail copy), M1 (backdrop-filter), M2 (will-change), M3 (logo treatment), M4 (Georgia font), M5 (required indicators)

## Skills Available for This Subphase
- `find-local-skills` / `find-skills` routing is not exposed as an invokable tool in this session; fallback is manual selection from the installed skill catalog plus direct `SKILL.md` reads.
- `simplify` — review code for quality and efficiency
- `impeccable:harden` — improve resilience
- `impeccable:clarify` — fix UX copy issues (proof rail heading)
- `frontend-design` — typography principles

## Work

### 1. Remove all `!important` declarations (H2)
- Search for all 21 instances: `grep -n '!important' globals.css`
- For each instance:
  - Understand WHY it was needed (specificity conflict)
  - Fix the root cause: increase selector specificity naturally, or reorder rules
  - Remove the `!important`
- Verify no visual regressions after each batch of removals
- Target: 0 `!important` declarations remaining

### 2. Fix eyebrow typography (H3)
- Current `.eyebrow` font-size is ~11.5px (computed)
- Increase to `clamp(0.8rem, 1vw, 0.875rem)` — minimum 12.8px, up to 14px
- Verify readability at both desktop and mobile viewports

### 3. Fix proof rail copy (H5)
- Current heading: "One lane from shortlist to post." — this is a product value prop, not social proof
- Options:
  - Remove the heading entirely, keep just "Trusted by teams at" + logos (cleanest)
  - Rewrite to be about the brands: "These teams run seeding from one lane"
  - Keep as-is if the user prefers (note in output)
- This may require a JSX change in HomeContent.tsx

### 4. Replace Georgia serif outlier (M4)
- Line 2436: `font-family: Georgia, serif` on evidence quotes
- Replace with `var(--font-body)` in italic, or keep Georgia if it's a deliberate design choice
- Verify quote readability after change

### 5. Reduce `backdrop-filter` usage (M1)
- Current: 10 instances across the CSS
- Keep only essential instances (sticky nav blur, maybe 1-2 more)
- Remove from intelligence cards (already done in 10a), form containers, and any decorative uses
- Target: 3 or fewer `backdrop-filter` instances

### 6. Add `will-change` hints (M2)
- Add `will-change: transform` to `.scene-card-a`, `.scene-card-b`, `.scene-card-c`, `.scene-signal`
- Only on elements that actually animate
- Add `will-change: transform, opacity` to `[data-reveal]` elements

### 7. Add required field indicators (M5)
- Add visual asterisk or "(required)" text to required form fields
- This requires a JSX change in LeadForm component
- Keep it subtle — just enough to communicate which fields are mandatory

### 8. Standardize logo treatment (M3)
- Ensure all brand logos in proof rail have consistent max-height
- Consider applying `filter: grayscale(1) opacity(0.6)` for visual uniformity
- Hover state: `filter: none` to show color on interaction

### 9. Verify
- `grep -c '!important' globals.css` returns 0
- `grep -c 'backdrop-filter' globals.css` returns <= 3
- Playwright screenshots show no visual regressions
- All 9 tests pass

## Validation (RED TEAM)
- `grep -c '!important' apps/web/app/globals.css`; expected result is `0`.
- `grep -c 'backdrop-filter' apps/web/app/globals.css`; expected result is `<= 3`.
- Verify computed eyebrow size is `>= 12.8px`, required field labels show `(required)`, and proof-rail copy reads as social proof.
- Run `npx playwright test tests/marketing-redesign.spec.ts --workers=1`; expected result is 9 passes with only the desktop-only mobile check skipped.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Removed every remaining `!important` declaration by replacing them with later, specific reduced-motion overrides instead of brute-force specificity.
  - Reduced `backdrop-filter` usage to the sticky nav only, replacing decorative blur on buttons/cards with solid surfaces.
  - Raised eyebrow typography, rewrote the proof-rail headline, replaced the Georgia quote-mark font, added required field indicators, and added `will-change` hints to reveal/scene surfaces.
- Commands run:
  - `grep -c '!important' apps/web/app/globals.css` — pass; returned `0`.
  - `grep -c 'backdrop-filter' apps/web/app/globals.css` — pass; returned `2`.
  - Playwright DOM checks on `/` — pass; eyebrow computed to `14px`, proof-rail heading updated, required labels now include `(required)`, and animated elements expose the intended `will-change` values.
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` — pass; `9 passed`, `1 skipped`.
- Blockers:
  - None.
- Next concrete steps:
  - Start Phase 10e to capture the final after set, run the broader visual-after sweep, and write the ship/no-ship summary.

## Output
- `apps/web/app/globals.css`
  - `!important` count reduced to `0`.
  - `backdrop-filter` count reduced to `2`.
  - Eyebrow size now computes to `14px`.
  - Quote-mark styling now uses the project typography instead of Georgia.
  - Reveal/scene surfaces now expose `will-change` hints.
  - Logo marks now share a tighter `height`/`max-width` treatment.
- `apps/web/app/(marketing)/components/HomeContent.tsx`
  - Proof rail copy now reads as social proof rather than product value copy.
- `apps/web/app/(marketing)/components/LeadForm.tsx`
  - Required form fields now show `(required)` inline in the label.
- Validation:
  - `grep -c '!important' apps/web/app/globals.css` → `0`
  - `grep -c 'backdrop-filter' apps/web/app/globals.css` → `2`
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` → `9 passed`, `1 skipped`

## Handoff
All code quality and typography issues resolved. Pass to Phase 10e for final independent verification and summary writing.

## Coordination Notes
- Shared file overlap: `apps/web/app/globals.css` now contains the accumulated 10a-10d work. 10e should re-read the live file before auditing and treat the reveal/full-page screenshot caveat from 10c as part of the verification method.
