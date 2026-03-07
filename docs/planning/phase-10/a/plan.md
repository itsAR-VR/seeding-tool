# Phase 10a — Critical fixes: touch targets + intelligence section de-slop

## Focus
Fix the two critical audit findings that block basic quality: (1) navigation links failing WCAG touch target minimums, and (2) the intelligence section glassmorphism that is the single biggest AI slop tell on the site.

## Inputs
- Audit report from the current session (C1: touch targets, C2: glassmorphism)
- Current CSS: `apps/web/app/globals.css` (~3220 lines)
- Intelligence section styles around lines 2345-2370
- Nav/footer link styles in header and footer rule blocks

## Skills Available for This Subphase
- `find-local-skills` / `find-skills` routing is not exposed as an invokable tool in this session; fallback is manual selection from the installed skill catalog plus direct `SKILL.md` reads.
- `impeccable:simplify` — strip the glassmorphism to its essence
- `impeccable:critique` — evaluate the replacement design
- `frontend-design` — design principles (DON'T use glassmorphism decoratively)
- `playwright` — screenshot before/after

## Work

### 1. Fix nav/footer touch targets (C1)
- Add `min-height: 44px` and appropriate padding to nav links in both `banner nav a` and `footer nav a`
- Use flexbox `align-items: center` to keep text vertically centered
- Verify on mobile (390px) that touch targets now meet the 44px minimum
- Screenshot before and after

### 2. Replace intelligence section glassmorphism (C2)
The current `.intelligence-card` uses:
- `background: rgba(255, 253, 248, 0.08)` (nearly invisible)
- `backdrop-filter: blur(16px)` (GPU-intensive glass effect)
- `border-color: rgba(255, 253, 248, 0.14)` (translucent border)
- Multiple `!important` overrides

Replace with:
- **Solid dark card backgrounds** using `color-mix(in srgb, var(--ink) 85%, var(--primary-soft) 15%)` or similar
- Remove `backdrop-filter` entirely from these cards
- Use real borders with enough contrast, not translucent ones
- Keep the dark section background but make cards feel weighty, not glassy
- Consider a subtle texture (dot grid is already there) instead of blur effects
- Ensure body text contrast ratio >= 4.5:1 on the dark backgrounds

### 3. Verify
- Playwright screenshot of intelligence section before and after
- Run `npx playwright test tests/marketing-redesign.spec.ts --workers=1`
- All 9 tests must pass

## Validation (RED TEAM)
- Measure `getBoundingClientRect().height` for `.top-nav nav a` and `.site-footer nav a`; expected result is `>= 44`.
- Measure computed `backdrop-filter` on `.intelligence-card`; expected result is `none`.
- Capture a direct `#intelligence` screenshot after `scrollIntoViewIfNeeded()` because the full-bleed section can clip with generic role-based element capture.
- Run `npx playwright test tests/marketing-redesign.spec.ts --workers=1`; expected result is 9 passes with only the desktop-only mobile check skipped.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Re-read `apps/web/app/globals.css`, `apps/web/app/(marketing)/components/Shell.tsx`, and `apps/web/app/(marketing)/components/HomeContent.tsx` first because the worktree already had in-flight marketing edits.
  - Updated the late-stage header/footer link rules in `apps/web/app/globals.css` so both nav surfaces render at `45.99px` instead of the audited `43.99px` / `20px`.
  - Replaced the intelligence section glass cards with solid accent-tinted dark surfaces, real borders, and no `backdrop-filter`.
- Commands run:
  - `git status --short` — pass; detected existing marketing screenshot/CSS changes and preserved them.
  - `ls -dt docs/planning/phase-* | head -10` — pass; overlap is limited to earlier marketing phases, especially Phase 7.
  - Playwright DOM measurements on `/` — pass; baseline `nav ~43.99px`, `footer 20px`; final `nav/footer ~45.99px`.
  - Playwright screenshots — pass; saved `phase10a-before-home-full.png`, `phase10a-after-home-full.png`, and `phase10a-after-intelligence-direct.png`.
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` — pass; `9 passed`, `1 skipped`.
- Blockers:
  - Generic role-based element screenshots were unreliable for the full-bleed intelligence section; Phase 10e should use `#intelligence` + `scrollIntoViewIfNeeded()` for section captures.
- Next concrete steps:
  - Start Phase 10b in `apps/web/app/(marketing)/components/HeroScene.tsx` and the `scene-*` rules in `apps/web/app/globals.css`.

## Output
- `apps/web/app/globals.css`
  - Header links now render at `45.99px`.
  - Footer links now render at `45.99px`.
  - `.home-main .intelligence-card` no longer uses `backdrop-filter` and now uses solid dark accent-tinted surfaces.
- Screenshot evidence:
  - `phase10a-before-home-full.png`
  - `phase10a-after-home-full.png`
  - `phase10a-after-intelligence-direct.png`
- Validation:
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` → `9 passed`, `1 skipped`

## Handoff
Pass the updated CSS to Phase 10b. The intelligence section is now de-slopped and header/footer navigation is accessible. The hero SVG upgrade can proceed independently in `apps/web/app/(marketing)/components/HeroScene.tsx`.

## Coordination Notes
- Shared file overlap: `apps/web/app/globals.css` was already dirty from the current marketing iteration. This turn merged semantically with those changes instead of assuming a clean baseline.
- Cross-phase risk: Phase 7 and Phase 10 both touch marketing presentation files; Phase 9 remains platform-only and unaffected by this subphase.
