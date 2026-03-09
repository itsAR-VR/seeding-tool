# Phase 11a — Stabilize local runtime, confirm remote-sync posture, and lock the hero stage architecture

## Focus
Get the integrated branch into a reliable local-dev state, make the Git sync posture explicit, and land the hero stage structure so the remaining work happens inside a clean browser iteration loop instead of blind code edits.

## Inputs
- `docs/planning/phase-11/plan.md`
- `apps/web/next.config.mjs`
- `apps/web/app/(marketing)/components/HeroScene.tsx`
- `apps/web/app/(marketing)/components/HeroScene.module.css`
- `apps/web/app/globals.css`
- Remote dashboard reference in `apps/web/app/(platform)/dashboard/page.tsx`

## Skills Available for This Subphase
- `find-local-skills` / `find-skills` routing is not exposed as an invokable tool in this session; fallback is manual selection from the installed skill catalog plus direct `SKILL.md` reads.
- `karpathy-guidelines` — keep the architecture change minimal and testable
- `frontend-design` — keep the hero stage clean and editorial
- `playwright-testing` — validate the stage in the real browser
- `context7-docs` — verify the Next.js Turbopack root fix

## Work

### 1. Fix the local Next.js runtime
- Add the explicit `turbopack.root` configuration in `apps/web/next.config.mjs`
- Restart local dev and confirm `/` loads without the Tailwind resolution failure

### 2. Confirm sync posture
- Verify the latest remote commits remain platform-only
- Keep the current feature work on top of the preserved WIP path
- Defer the actual rebase until the hero changes are stable unless an overlapping remote commit appears

### 3. Lock the hero stage architecture
- Replace the hero SVG path with the DOM/CSS media-stage implementation
- Keep six placeholder media cards with stable test hooks
- Establish the dashboard shell, queue rail, and metric rail that the cards will dock into
- Keep the copy density low enough to avoid clipping before motion polish begins

## Validation
- `npm run web:dev` (or an equivalent existing local server) loads `/` successfully
- Browser snapshot confirms the new hero stage renders
- Playwright / DOM checks confirm six hero cards and hero data attributes exist

## Progress This Turn (Terminus Maximus)
- Work done:
  - Created Phase 11 to track the new hero direction after Phase 10 completion.
  - Verified the newest `origin/main` commits were platform-only and safe to merge later.
  - Added `turbopack.root` to `apps/web/next.config.mjs`, then moved the local validation loop to `next dev --webpack` when Turbopack still failed to resolve the Tailwind import chain in dev.
  - Replaced the hero SVG path with the DOM/CSS media stage and locked the test hooks/data attributes for the carousel and dock states.
- Commands run:
  - `git fetch origin && git log --oneline --decorate --left-right --cherry-pick HEAD...origin/main` — pass; branch is behind 3 platform-only commits.
  - `git show --name-only ae75a7a 288fa2e aeef2bc` — pass; changes are confined to platform settings/auth/bootstrap files.
  - `sed`/`git diff` inspections across the hero files and phase docs — pass; confirmed current working surface.
  - `cd apps/web && npx next dev --webpack` — pass; local browser loop became reliable.
- Blockers:
  - Turbopack dev still resolves the Tailwind import chain from the wrong parent directory. Current fallback is Webpack dev mode, which works.
- Next concrete steps:
  - Move to Phase 11b for visual tuning of the carousel composition and dock motion.

## Output
- `apps/web/next.config.mjs`
  - Added explicit `turbopack.root` configuration for the Next 16 app directory.
- `apps/web/app/(marketing)/components/HeroScene.tsx`
  - Converted the hero from SVG output to a client-side media stage with stable data hooks and scroll-linked state.
- `apps/web/app/(marketing)/components/HeroScene.module.css`
  - Added the new stage styles for toolbar, queue/metric rails, dock canvas, and media cards.

## Handoff
Runtime is stable enough for browser iteration via Webpack dev. Phase 11b can focus on visual polish and choreography instead of bootstrapping.

## Coordination Notes
- Shared file overlap exists with completed Phase 10 in `apps/web/app/globals.css` and marketing components; preserve that work and change only the hero-specific surface.
- Current remote drift is limited to platform files, so the hero implementation can continue without an immediate rebase.
