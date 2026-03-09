# Phase 12 — Summary

## Outcome
- Replaced the Phase 11 single-stage hero with a split corridor: reels first in the hero, dashboard showcase below, proof rail after the dashboard.
- The dashboard landing zone now targets the marketing-derived `Recent mentions` area instead of an internal dashboard shell embedded in the hero.

## What Changed
- `apps/web/app/(marketing)/components/HeroScene.tsx`
  - Rebuilt as the full hero corridor component with hero copy, autoplay carousel, scroll-linked dock, dashboard showcase, and reduced-motion behavior.
- `apps/web/app/(marketing)/components/HeroScene.module.css`
  - Replaced the old single-surface stage styles with a new editorial carousel layout, cleaner dock spacing, dashboard showcase styling, and responsive poster/dock motion geometry.
- `apps/web/app/globals.css`
  - Upgraded the AI layer treatment and widened the final capture section so the page ends with more visual weight.
- `apps/web/app/(marketing)/components/HomeContent.tsx`
  - Simplified the hero section so the proof rail now sits below the dashboard showcase by composition rather than by extra page surgery.
- `apps/web/app/(marketing)/components/LeadForm.tsx`
  - Removed the empty second column when Calendly is absent so the homepage form can use the full available width.
- `tests/hero-media-stage.spec.ts`
  - Rewritten around separate hero/dashboard regions and mentions-area docking, then expanded with a breakpoint sweep so slot fit is enforced across key widths.
- `tests/screenshots/home-desktop.png`
  - Refreshed to the separate-carousel hero.
- `tests/screenshots/home-mobile.png`
  - Refreshed to the calmer mobile hero.

## Verification
- `npx playwright test tests/hero-media-stage.spec.ts --workers=1` → `3 passed`, `3 skipped`
- `npx playwright test tests/marketing-redesign.spec.ts --workers=1` → `9 passed`, `1 skipped`
- `npx playwright test tests/hero-media-stage.spec.ts tests/marketing-redesign.spec.ts --workers=1` → `12 passed`, `4 skipped`
- `npx playwright test tests/hero-media-stage.spec.ts --workers=1` → `4 passed`, `4 skipped`
- `npx playwright test tests/hero-media-stage.spec.ts tests/marketing-redesign.spec.ts --workers=1` → `13 passed`, `5 skipped`

## Notes
- The desktop dock geometry is now aligned with the mentions area rather than hovering above the metric row.
- The mentions slot labels now follow the currently docking reel set, so the visual landing state and the underlying box copy stay in sync.
- The dock now uses the real mention-slot geometry at runtime rather than hard-coded percentage endpoints, which is why it now scales across tablet, narrow desktop, and mobile widths.
- Mobile no longer lets the reel cards overlap the hero copy stack.
- The AI layer now uses a more deliberate frosted-board treatment instead of reading like a flat dark gap.
- The mobile carousel panel now starts materially higher in the first viewport, so the reel stage is visible above the fold rather than only hinted at.
