# Phase 11 — Review

## Summary
- Phase 11 shipped the new hero interaction direction: media carousel first, dashboard dock second.
- The feature branch was rebased onto the latest `ItsAR-VR/main` after the hero stabilized, with no conflicts in the touched marketing files.

## Verification

### Commands
- `npx playwright test tests/hero-media-stage.spec.ts --workers=1` — pass (`3 passed`, `3 skipped`)
- `npx playwright test tests/marketing-redesign.spec.ts --workers=1` — pass (`9 passed`, `1 skipped`)
- `npx playwright test tests/hero-media-stage.spec.ts tests/marketing-redesign.spec.ts --workers=1` — pass (`12 passed`, `4 skipped`)
- `npm run web:build` — fail outside feature scope (`DATABASE_URL is required`; `Neither apiKey nor config.authenticator provided`; final collection failure on `/api/brands/current`)

### Observations
- Desktop hero now presents two lead posters without bleeding into the queue/metric rails.
- Mobile hero now presents one dominant poster plus a readable next preview.
- Reduced motion degrades to an understandable docked state rather than a blank hero.
- The rebase did not introduce platform conflicts into the hero files.

## Remaining Risks
- Turbopack dev is now working again after the root CSS-package install, but the fix depends on keeping `tailwindcss`, `tw-animate-css`, and `shadcn` available at the repo root as well as under `apps/web`.
- Production builds still require platform env/config to satisfy `/api/brands/current` and related provider initialization; this was pre-existing and remains outside the hero feature.

## Recommendation
- Ship the hero feature on this branch.
- Treat platform env/build recovery and Turbopack-dev recovery as separate follow-up work, not blockers for the hero interaction itself.
