# Phase 11c — Validate, polish, and reconcile with the newest remote main without regressing the marketing site

## Focus
Lock the final hero state with tests and screenshots, then fold in the newest remote commits cleanly so the branch is not left behind after the feature is stable.

## Inputs
- Phase 11a and 11b outputs
- `tests/hero-media-stage.spec.ts`
- `tests/marketing-redesign.spec.ts`
- Current `origin/main`

## Skills Available for This Subphase
- `find-local-skills` / `find-skills` routing is not exposed as an invokable tool in this session; fallback is manual selection from the installed skill catalog plus direct `SKILL.md` reads.
- `playwright-testing`
- `karpathy-guidelines`
- `terminus-maximus`

## Work
- Finalize the hero-specific Playwright coverage.
- Run the marketing regression checks against the final hero state.
- Clean up obsolete hero-specific code if it is no longer used.
- Rebase or otherwise reconcile against the latest `origin/main` once the feature is stable.
- Record the resulting sync posture and any remaining blockers in the phase docs.

## Validation
- `npx playwright test tests/hero-media-stage.spec.ts --workers=1`
- `npx playwright test tests/marketing-redesign.spec.ts --workers=1`
- Strongest available local build/lint checks that are not blocked by known unrelated remote env issues

## Progress This Turn (Terminus Maximus)
- Work done:
  - Updated `tests/hero-media-stage.spec.ts` to assert the calmer mobile contract instead of the earlier wider-preview assumption.
  - Ran the combined hero + marketing Playwright suites successfully on the rebased branch.
  - Rebased `feature/hero-media-dock` onto the latest `origin/main` using stash/rebase/pop after the hero stabilized.
  - Re-ran the production build and confirmed the remaining failures are unrelated platform env requirements, not the hero work.
- Commands run:
  - `npx playwright test tests/hero-media-stage.spec.ts --workers=1` — pass; `3 passed`, `3 skipped`.
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` — pass; `9 passed`, `1 skipped`.
  - `git stash push -u -m 'phase11 hero media dock wip' && git fetch origin && git rebase origin/main && git stash pop` — pass; branch is no longer behind remote main.
  - `npx playwright test tests/hero-media-stage.spec.ts tests/marketing-redesign.spec.ts --workers=1` — pass; `12 passed`, `4 skipped`.
  - `npm run web:build` — fail; build compiles, then stops on platform env requirements: `DATABASE_URL is required` and `Neither apiKey nor config.authenticator provided`.
- Blockers:
  - Production build remains blocked by existing platform env/config requirements outside the marketing hero scope.
- Next concrete steps:
  - No further hero work required for this phase.

## Output
- `tests/hero-media-stage.spec.ts`
  - Hero interaction coverage now matches the shipped desktop/mobile behavior.
- Branch state
  - `feature/hero-media-dock` rebased cleanly onto `origin/main`; local branch is ahead only.
- Verification
  - Combined Playwright suites passed after the rebase.

## Handoff
Phase 11 is complete. If a follow-up phase is needed, it should be separate from the hero feature and focus on the platform env/build blockers or the Turbopack dev-resolution issue.

## Coordination Notes
- Reconcile with the latest remote only after the hero feature is visually stable, unless a new overlapping remote commit appears earlier.
