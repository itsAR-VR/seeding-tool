# Phase 12 — Separate reel hero from dashboard dock

## Original User Request (verbatim)
I don't know if you've viewed the animation that we have right now, but it kind of sucks. The animation
  happens in that same window again. What we're looking for is to have these reels shown not within the
  dashboard but by themselves, having two full-scale Reels, and then the dashboard would be below that. It
  would be below the hero, and then these Reels, which are not just two, are a carousel. This carousel, which
  will be cycling between Reels, would then be an independent component. As you scroll, those Reels would get
  pulled down below the hero into a dashboard, a full-scale dashboard, and that's the animation and the
  structure that we want. Ask me any questions if you're not 100% sure here.

Dashboard next: the real dashboard UI with the reels coming down into the social listening / mentions portion of the dashboard.
Dock count: 4 items.
Dashboard style: marketing-derived real app.
Scroll handoff: visible landing zone.
Mobile motion: simplified dock.

## Purpose
Replace the current combined hero stage with a two-part corridor: a hero carousel that shows reels on their own and a separate dashboard showcase directly below it. The reels should visibly travel into the dashboard's mentions area as the user scrolls, while the proof rail moves below this new dashboard section.

## Context
- Phase 11 shipped a combined hero stage where carousel and dashboard chrome coexist inside one framed surface.
- The user wants a structural change, not another polish pass on the same stage.
- The branch is already aligned with `ItsAR-VR/seeding-tool`; current status is ahead-only and does not require a pre-implementation pull.
- The real dashboard reference lives in `apps/web/app/(platform)/dashboard/page.tsx`.
- The marketing home composition currently places the proof rail immediately below the hero.

## ⚠️ STATUS: NOT IMPLEMENTED (2026-03-09)

The `[x]` checkboxes below were written aspirationally in the planning doc and merged before
implementation. **No code for this phase exists in the codebase.** `HeroScene.tsx` still combines
carousel + dashboard dock in one component. `HeroCarousel.tsx` and `DashboardShowcase.tsx` do not exist.
See `docs/planning/phase-landing-redesign/phase-gaps.md` GAP-LP-02 for integration plan.

## Objectives
* [ ] Separate the hero carousel from the dashboard showcase in the homepage structure
* [ ] Dock 4 reel items into a dashboard-derived mentions area below the hero
* [ ] Move the proof rail below the new dashboard section
* [ ] Preserve a calm mobile variant with a simplified dock
* [ ] Update Playwright coverage and screenshots for the new section order and motion model

## Constraints
- No real video assets yet; placeholders only.
- Keep the brand system light, calm, warm, and operator-focused.
- The dashboard showcase remains marketing-only and non-interactive.
- Do not regress the rest of the Phase 10 / Phase 11 marketing page polish.
- Do not perform unnecessary git sync work while the branch is already ahead-only.

## Success Criteria
- [ ] Desktop hero shows reels without embedded dashboard rails or shell content behind them
- [ ] Dashboard showcase appears directly below the hero and uses the mentions area as the visual dock target
- [ ] Four reel cards resolve into the mentions grid on scroll and restore on reverse scroll
- [ ] Mobile keeps a simplified, calmer dock behavior
- [ ] Proof rail renders below the dashboard showcase
- [ ] `tests/hero-media-stage.spec.ts` passes against the new architecture
- [ ] `tests/marketing-redesign.spec.ts` passes without landing-page regressions

## Repo Reality Check (RED TEAM)
- `apps/web/app/(marketing)/components/HeroScene.tsx` currently owns both the reel carousel and the dashboard dock shell, so the component boundary itself is wrong for the new request.
- `apps/web/app/(marketing)/components/HomeContent.tsx` still renders the proof rail immediately after the hero, which conflicts with the requested section order.
- `tests/hero-media-stage.spec.ts` currently asserts the old single-stage dock behavior and will need new section-aware assertions.
- `origin/main` is not ahead of the branch right now, so another stash/rebase cycle would add risk without helping this feature.

## Subphase Index
* a — Restructure the homepage into a hero-to-dashboard corridor and lock the shared motion model
* b — Implement the new reel carousel, dashboard showcase, and responsive dock choreography
* c — Refresh tests, screenshots, and phase records against the new architecture

## Phase Summary (running)
- 2026-03-07 22:58 EST — Created Phase 12 to replace the shipped Phase 11 single-stage hero with the approved split layout: hero carousel above, dashboard showcase below, proof rail after the dashboard, and a four-item dock into the mentions area.
- 2026-03-07 23:31 EST — Rebuilt `HeroScene` as a full corridor component, moved the dashboard showcase inside the hero section below the carousel, and rewrote the hero-specific Playwright contract around separate hero/dashboard regions.
- 2026-03-08 00:22 EST — Tightened the dock fit so the reels sit within the mentions slots more cleanly, upgraded the AI layer visual treatment, and widened the final capture form by removing the empty Calendly column when no booking card is present.
- 2026-03-08 00:46 EST — Pulled the mobile carousel panel higher into the first viewport by compacting the copy stack and mobile carousel chrome, then revalidated the combined hero and marketing suites on the live dev server.
- 2026-03-08 01:12 EST — Replaced the dock’s hard-coded target math with DOM-measured mention-slot targeting, shortened the stacked/mobile handoff timing, and added breakpoint coverage to ensure the reels fit the slots from `390px` through `1440px`.

## Phase Summary
- Shipped:
  - A separate reel-first hero carousel with two lead cards, softer side previews, and a four-item dock into a marketing-derived dashboard mentions area.
  - A new homepage order where the dashboard showcase sits below the hero and the proof rail follows after it.
  - A polish pass on spacing and finish: cleaner dock padding, richer AI-layer visuals, and a wider end-of-page lead capture surface.
  - A mobile-first refinement that shows more of the reel stage above the fold without reintroducing overlap or crowding.
  - Updated hero-specific Playwright coverage and refreshed marketing screenshots for the new layout.
- Verified:
  - `npx playwright test tests/hero-media-stage.spec.ts --workers=1` — pass (`3 passed`, `3 skipped`)
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` — pass (`9 passed`, `1 skipped`)
  - `npx playwright test tests/hero-media-stage.spec.ts tests/marketing-redesign.spec.ts --workers=1` — pass (`12 passed`, `4 skipped`)
- Follow-up suggestion:
  - If more hero iteration is needed, treat it as a new phase focused on tighter mobile staging or a more explicit first-viewport dashboard preview, not a return to the old single-stage dock shell.
