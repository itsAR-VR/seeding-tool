# Phase 11 — Summary

## Outcome
- Replaced the old hero mock with a media-first carousel that shows two lead reel placeholders, side previews, and a scroll-linked dock into a dashboard shell.
- Kept the work aligned with the canonical `ItsAR-VR` repo by rebasing the feature branch onto the latest `origin/main` after the hero stabilized.

## What Changed
- `apps/web/app/(marketing)/components/HeroScene.tsx`
  - New client-side media stage, autoplay carousel state, scroll progress, reduced-motion fallback, and stable `data-hero-*` hooks.
- `apps/web/app/(marketing)/components/HeroScene.module.css`
  - New layout/styling for the dashboard shell, dock grid, rails, and reel-style cards.
- `apps/web/app/globals.css`
  - Shorter hero scroll budget for a tighter carousel-to-dock transition.
- `apps/web/next.config.mjs`
  - Explicit `turbopack.root` config for the app directory.
- `package.json`
  - Added the CSS-resolved packages at the repo root so Turbopack can satisfy the repo-root lookup path, and kept a `web:dev:webpack` fallback script.
- `apps/web/package.json`
  - `dev` remains `next dev`; `dev:webpack` is available as the fallback path.
- `tests/hero-media-stage.spec.ts`
  - New Playwright coverage for the hero interaction.

## Verification
- `npx playwright test tests/hero-media-stage.spec.ts --workers=1` → `3 passed`, `3 skipped`
- `npx playwright test tests/marketing-redesign.spec.ts --workers=1` → `9 passed`, `1 skipped`
- `npx playwright test tests/hero-media-stage.spec.ts tests/marketing-redesign.spec.ts --workers=1` → `12 passed`, `4 skipped`
- `npm run web:build` → still blocked by existing platform env requirements (`DATABASE_URL is required`; `Neither apiKey nor config.authenticator provided`)

## Notes
- `npm run web:dev` now starts the app successfully on Turbopack again.
- `npm run web:dev:webpack` is available if Turbopack regresses.
- The branch is no longer behind `origin/main`.
