# Phase 12c — Refresh tests, screenshots, and phase records against the new architecture

## Focus
Replace the old single-stage assertions with corridor-aware tests, rerun the marketing regression loop, and record the final behavior and remaining risks.

## Inputs
- Phase 12a and 12b outputs
- `tests/hero-media-stage.spec.ts`
- `tests/marketing-redesign.spec.ts`
- Updated homepage components and styles

## Work
1. Rewrite hero tests around separate hero and dashboard regions.
2. Run the targeted verification loop and refresh tracked screenshots if needed.
3. Update the root phase summary plus summary/review artifacts for this iteration.

## Validation
- `npx playwright test tests/hero-media-stage.spec.ts --workers=1`
- `npx playwright test tests/marketing-redesign.spec.ts --workers=1`

## Output
- `tests/hero-media-stage.spec.ts`
  - Rewrote the assertions around separate hero and dashboard regions, proof-rail ordering, mentions-area docking, mobile simplified dock behavior, and reduced-motion fallback.
- `tests/screenshots/home-desktop.png`
  - Refreshed to the new separate-carousel hero architecture.
- `tests/screenshots/home-mobile.png`
  - Refreshed to the calmer mobile first viewport that no longer lets cards overlap the copy.
- Verification
  - `npx playwright test tests/hero-media-stage.spec.ts --workers=1` — pass (`3 passed`, `3 skipped`)
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` — pass (`9 passed`, `1 skipped`)
  - `npx playwright test tests/hero-media-stage.spec.ts tests/marketing-redesign.spec.ts --workers=1` — pass (`12 passed`, `4 skipped`)

## Coordination Notes
- Accepted the existing tracked screenshot updates from the marketing regression suite instead of treating them as unrelated noise.
- Did not touch the older package/runtime files that remain dirty in the worktree from prior phases.

## Handoff
Phase 12 is complete. Any follow-up work should be a new phase focused on tighter mobile hero staging or broader landing-page iteration, not on restoring the old single-stage dock model.
