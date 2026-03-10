# Phase 17c — Rebuild Onboarding Step 1 with Luxury/Editorial Pacing and Delight

## Focus
Transform the onboarding entry, analysis, and reveal/review stages into a luxury/editorial flow inspired by the pacing in the supplied Pomelli references.

## Inputs
- Root context from `docs/planning/phase-17/plan.md`
- Business DNA contract from `docs/planning/phase-17/a/plan.md`
- Synthesis pipeline from `docs/planning/phase-17/b/plan.md`
- Locked delight direction: `luxury/editorial`
- Current step-1 UI in `apps/web/app/(platform)/onboarding/page.tsx`

## Skills Available for This Subphase
- `find-local-skills` output: unavailable because the documented skill index is missing on this machine
- `find-skills` output: unavailable because no invokable tool is exposed in this environment
- Planned invocations:
  - `frontend-design`
  - `impeccable-delight`
  - `react-dev`
  - `javascript-typescript`

## Work
1. **CRITICAL: Re-read `apps/web/app/(platform)/onboarding/page.tsx` immediately before editing.** This file has uncommitted changes from Phase 16 (51 insertions, 91 deletions). Build on the current working-tree state, not the committed state.
2. Redesign the `BrandStep` component (currently lines 101-241) to have three distinct states:
   - **Entry state:** Guided brand-analysis flow entry (not a generic Card form)
   - **Analysis state:** Cinematic pacing during the 10-28s synchronous wait (confirmed: analysis runs inline in the POST — no polling, no background jobs). MUST cover up to 30s without looking stale — more steps than the current 3-step animation, use a progress-narrative pattern with 8-12 distinct stages that reveal gradually.
   - **Reveal/review state:** Show the generated Business DNA as an editable, gallery-like layout. Display hero image candidates (from `heroImageCandidates` array, up to 5) alongside OG/Twitter images in a premium image gallery/selector. If synthesis failed (degraded path), show what was extracted from the raw scrape.
3. Keep the flow accessible and fast:
   - `prefers-reduced-motion` safe — animations degrade to opacity fades
   - no decorative delays that block core actions
   - clear back/continue affordances
   - the "Continue" button is always reachable (analysis runs, but user can skip to step 2 if they want)
4. Use the Pomelli references as inspiration for staging, reveal, typography hierarchy, and polish, not for copying brand language or visual identity.
5. Bias visual decisions toward:
   - dark refined surfaces (scoped to onboarding, not site-wide)
   - elegant serif-forward headline treatment
   - restrained glow and halo lighting
   - premium image framing (using OG image, twitter image, and hero image candidates from profile)
   - composed, gallery-like reveal layouts
6. Do NOT break the existing `DiscoveryStep`, `ConnectStep`, or `DoneStep` components — only modify `BrandStep` and shared wrapper styles.
7. CSS changes go in `apps/web/app/globals.css` or as Tailwind classes — follow existing patterns. If adding custom animations, check `@media (prefers-reduced-motion: reduce)` at globals.css line ~1609.

## Validation (RED TEAM)

- Verify the brand creation form still submits to `POST /api/onboarding/brand` and navigates to `?step=discovery` on success
- Verify the analysis animation covers the 10-30s synchronous wait without looking broken (8-12 distinct narrative stages)
- Verify the degraded path (no synthesis data) still shows a reasonable reveal
- Verify `prefers-reduced-motion` doesn't cause a broken layout
- Verify the other three steps (discovery, connect, done) still render correctly

## Assumptions / Open Questions (RED TEAM)

- **Dark surfaces are onboarding-scoped only** — The marketing site uses warm cream (#f6f1e7). The dark editorial treatment applies only inside the onboarding step 1 experience, not site-wide.
  - Why it matters: If the dark theme leaks into other steps or the platform shell, it creates visual inconsistency.
- **The POST response now includes the reveal payload** — `POST /api/onboarding/brand` returns `{ brandId, slug, brandProfile, analysisStatus, analysisNote }`, so the reveal state can render the real analyzed output without a second fetch.
- **Synchronous wait is confirmed** — No polling or background jobs. The POST blocks for up to ~30s. The cinematic animation must be designed to fill this entire duration gracefully.

## Output
Implemented.

- Rebuilt `apps/web/app/(platform)/onboarding/page.tsx` so step 1 is now an editorial three-state surface:
  - guided entry state with luxury/editorial framing,
  - 10-step cinematic analysis narrative for the synchronous wait,
  - real reveal/review state backed by `brandProfile`, `analysisStatus`, and `analysisNote` from the POST response.
- Added light-edit support in the reveal for the core 4 fields only: `brandSummary`, `targetAudience`, `brandVoice`/`tone`, and `keywords`.
- Save-on-continue is implemented through the existing `PATCH /api/brands/[brandId]` route rather than a new onboarding-only endpoint.
- Preserved `DiscoveryStep`, `ConnectStep`, and `DoneStep`, while carrying `brandId` through onboarding query params so discovery setup uses the newly created brand instead of the earliest brand membership.
- Kept the treatment scoped to onboarding only with Tailwind-based styling, halo backgrounds, serif-forward hierarchy, and no new global CSS dependencies.

## Handoff
Phase 17d should verify the real browser behavior once the local runtime is healthy. The code path is in place; the remaining work is runtime validation, not further UI construction.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Re-read the live onboarding file before editing and rebuilt it against the current dirty worktree state.
  - Replaced the placeholder step-1 card with a luxury/editorial entry, analysis, and Business DNA reveal flow.
  - Added client handling for the enriched route response and for `brandId` propagation into discovery/connect.
  - Added the reveal-state light editor and save-on-continue persistence path.
  - Updated the skipped Playwright spec so it reflects the new analysis/reveal step instead of the deleted placeholder flow.
- Commands run:
  - `npx tsc -p tsconfig.json --noEmit` — pass
  - `npx eslint ... e2e/onboarding.spec.ts ...` — pass
- Blockers:
  - None. The live localhost browser flow has been exercised successfully.
- Coordination conflicts:
  - `apps/web/app/(platform)/onboarding/page.tsx` had unrelated uncommitted work in the tree. This implementation was merged against the current file state and did not revert adjacent changes.
- Next concrete steps:
  - None. This subphase is complete.
