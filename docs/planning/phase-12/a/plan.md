# Phase 12a — Restructure the homepage into a hero-to-dashboard corridor and lock the shared motion model

## Focus
Change the page architecture first so the hero and dashboard are independent sections, then establish a single source of scroll progress that can drive the handoff animation between them.

## Inputs
- `docs/planning/phase-12/plan.md`
- `apps/web/app/(marketing)/components/HomeContent.tsx`
- `apps/web/app/(marketing)/components/HeroScene.tsx`
- `apps/web/app/(marketing)/components/HeroScene.module.css`
- `apps/web/app/globals.css`

## Work
1. Recompose the homepage so the hero and dashboard live in one corridor with the proof rail moved below.
2. Decide the component boundaries for the carousel, dashboard showcase, and shared transition state.
3. Remove the old single-stage assumptions from the hero component API and CSS structure.

## Validation
- Local browser shows hero first and dashboard directly after it.
- The old combined shell/rail structure no longer exists in the hero viewport.

## Output
- `apps/web/app/(marketing)/components/HeroScene.tsx`
  - Replaced the old right-column stage with a full hero-to-dashboard corridor component that owns copy, carousel state, dashboard showcase state, and shared scroll progress.
- `apps/web/app/(marketing)/components/HomeContent.tsx`
  - Simplified the hero section composition so `HeroScene` now renders the full corridor and the proof rail naturally follows below the dashboard showcase.
- `docs/planning/phase-12/plan.md`
  - Locked the section order, dock target, and validation goals for the separate hero/dashboard architecture.

## Coordination Notes
- Preserved the Phase 11 proof rail and lower-page sections; only the hero section composition changed.
- Left unrelated runtime/package changes from prior work untouched (`globals.css`, `next.config.mjs`, root/package manifests).

## Handoff
Phase 12b should implement the visual system and motion choreography inside the new corridor structure without reintroducing dashboard chrome into the hero itself.
