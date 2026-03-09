# Phase 11 — Hero media carousel + dashboard dock integration

## Original User Request (verbatim)
Also, something that I would actually want to do instead of this animation thing that we've created is have some video/reel content present on the initial hero where this item currently is. What essentially is going to happen is maybe we'll have two pieces of content on that portion that we have right now, and there will be a carousel where you can see the other items in the background. It'll be very clean, not overlapping with anything, and then as you scroll, those items that are currently present within that carousel get pulled downward in an animation and get pushed into the dashboard that we're creating. 

 very similar to the way we funneled it. Another thing that's very important here is that we have stuff on GitHub now, which is what I'm talking about: the dashboard and all the stuff that currently exists. All that stuff is right now on our GitHub. Right now we're behind on our branch; we're not actually ahead. What we're working on right now is our local stuff, but we have more stuff on GitHub, so maybe we pull that and make sure that any overlap is solved. I don't know; maybe we do like a stash and then we pull it and then we do like a pop, and we work on all of this and make sure that the landing page is integrated properly.

I'm not sure about the best way for the GitHub flow to work where we can pull all the information to save the changes that we have here, because the other changes are from another session that another computer was working on. Just figure that out. We want to be able to use the changes that we've already done within our current local session, but we want to make these changes that I'm saying, which is more similar to refunnel. If you need video/real content, just put placeholders for now, and then we'll go ahead and add those later.

The carousel should again not just be two videos, but it should be two videos with maybe some other videos to the side of them that are a little bit smaller. It cycles through, going left to right, shifting all the videos to the left so you can see the setting content. When you scroll, it'll pull down, like whatever four videos into the dashboard or maybe eight videos into the dashboard, with a really cool animation. I need to do iterations on this, use Playwright in order to verify it and do the validation loop so that it is exactly the way that we want it to be. A part of this request is  To start with a very solid plan in implementing this

continue

I'm Mmoahid, isnt the owner of this seeding tool on GitHub anymore. ItsAR-VR is.

Implement the plan.

## Purpose
Replace the current hero illustration with a calmer media carousel that reads like real creator content in the first viewport, then scroll-morphs into a dashboard-derived dock state. Preserve the existing local marketing work while integrating against the canonical `ItsAR-VR/seeding-tool` remote and validating the interaction in-browser with Playwright.

## Context
- Phase 10 is complete and should remain the baseline marketing polish phase.
- The user wants a new hero interaction, not another refinement of the SVG-style product scene.
- The current branch already preserved the pre-sync local work via a WIP commit and moved `origin` to `ItsAR-VR/seeding-tool`.
- The feature branch is currently ahead by the preserved WIP commit and behind newer remote platform-only commits.
- The remote repo now contains richer platform dashboard patterns that should inform the visual target of the docked state.
- The working hero implementation has already started locally in:
  - `apps/web/app/(marketing)/components/HeroScene.tsx`
  - `apps/web/app/(marketing)/components/HeroScene.module.css`
  - `apps/web/app/globals.css`
- Local validation is currently blocked by a Next.js 16 Turbopack root-resolution issue in `apps/web/next.config.mjs`, so that must be fixed before the browser loop is trustworthy.

## Skills Available for Implementation
- `find-local-skills` / `find-skills` routing is not exposed as an invokable tool in this session; fallback is manual selection from the installed skill catalog plus direct `SKILL.md` reads.
- `terminus-maximus` — execution discipline, per-turn documentation, RED TEAM wrap-up
- `karpathy-guidelines` — keep changes surgical and verifiable
- `recursive-reasoning-operator` — ground decisions in the existing phase docs and repo state
- `frontend-design` — editorial SaaS hero design direction and anti-slop constraints
- `playwright-testing` — verify the interaction in-browser after each meaningful change
- `context7-docs` — confirm version-sensitive Next.js config behavior

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 10 | Complete | `apps/web/app/globals.css`, `apps/web/app/(marketing)/components/**` | Treat as baseline. Phase 11 replaces only the hero interaction without regressing the broader polish. |
| Phase 9 | Active platform implementation | `apps/web/app/(platform)/**`, shared app runtime, package/config state | Borrow dashboard visual cues only. Do not rewrite platform flows while landing the marketing hero. |

## Objectives
* [x] Keep the current local hero work while integrating cleanly against `ItsAR-VR/main`
* [x] Replace the current hero mock with a poster-style media carousel using placeholders
* [x] Show two dominant center cards and smaller side previews without overlap into the copy column
* [x] Morph the carousel into a restrained dashboard dock state on scroll
* [x] Respect reduced motion and maintain a calm mobile variant
* [x] Add hero-specific Playwright coverage for carousel motion and dock behavior
* [x] Re-run the marketing regression loop against the final state

## Constraints
- No real video assets yet; use poster placeholders only.
- Keep the overall warm, light editorial system established in Phase 10.
- No overlapping or noisy card stacks; motion should clarify state, not decorate.
- The hero remains marketing-only; the docked dashboard is a visual shell, not a live protected app embed.
- Do not revert unrelated platform changes from other sessions.
- Treat the latest remote platform commits as canonical, but avoid interrupting the hero validation loop for platform-only drift unless it overlaps touched files.

## Success Criteria
- [x] `origin` remains pointed to `ItsAR-VR/seeding-tool` and the branch has a documented sync path
- [x] Desktop hero shows 2 primary media cards plus side previews in a calm composition
- [x] Scroll progress docks the visible cards into a dashboard-style grid without clipping or overlap
- [x] Reduced motion renders an immediately understandable static docked state
- [x] Mobile hero remains legible and materially calmer than desktop
- [x] `tests/hero-media-stage.spec.ts` passes
- [x] `tests/marketing-redesign.spec.ts` passes on the final hero state

## Repo Reality Check (RED TEAM)
- `origin/main` has advanced by platform-only commits (`ae75a7a`, `288fa2e`, `aeef2bc`) and does not currently overlap the hero files being edited.
- `apps/web/app/(marketing)/components/HeroScene.tsx` already contains a first-pass client carousel implementation, but it still needs browser validation and visual tuning.
- `apps/web/app/globals.css` still carries the old `scene-*` SVG styles; they are now legacy baggage and should be removed only if the new hero is verified stable.
- `apps/web/next.config.mjs` does not yet set `turbopack.root`, which is why local `next dev` resolves the wrong root after the remote sync.
- `apps/web/next-env.d.ts` changed as a generated artifact during local dev and should not drive feature decisions.

## RED TEAM Findings (Gaps / Weak Spots)
- Highest-risk failure mode: the carousel technically animates but still feels cluttered or generic. Mitigation: validate in-browser at desktop and mobile before adding more detail.
- Highest-risk integration gap: rebasing mid-iteration could waste time if the remote commits remain platform-only. Current default: finish the hero validation loop first, then rebase once the feature is in a stable state.
- Underspecified dashboard target: the dock state should borrow rhythm from the real platform dashboard, not from the old marketing SVG. Mitigation: inspect the current platform dashboard code before final visual polish.
- Testing gap: the new hero spec checks state and progress, but not text clipping or visual calm. Mitigation: add viewport assertions and screenshots during final polish.

## Subphase Index
* a — Stabilize local runtime, confirm remote-sync posture, and lock the hero stage architecture
* b — Refine carousel composition and scroll-to-dashboard motion across desktop and mobile
* c — Validate, polish, and reconcile with the newest remote main without regressing the marketing site

## Phase Summary (running)
- 2026-03-07 15:09 EST — Created Phase 11 to track the hero media carousel work, confirmed the latest remote commits are platform-only, and identified `apps/web/next.config.mjs` as the first blocker to clear before visual iteration. (files: `docs/planning/phase-11/plan.md`)
- 2026-03-07 15:21 EST — Landed the new hero media stage in `HeroScene.tsx`, added `HeroScene.module.css`, tightened the hero shell height in `globals.css`, and added `tests/hero-media-stage.spec.ts` for carousel/dock coverage. (files: `apps/web/app/(marketing)/components/HeroScene.tsx`, `apps/web/app/(marketing)/components/HeroScene.module.css`, `apps/web/app/globals.css`, `tests/hero-media-stage.spec.ts`)
- 2026-03-07 15:22 EST — Rebased `feature/hero-media-dock` onto the latest `origin/main` with a stash/rebase/pop flow; the remote platform commits merged cleanly and the branch is now only ahead by the preserved local work. (files: repo branch state)
- 2026-03-07 15:23 EST — Post-rebase verification passed for the hero and marketing suites; `npm run web:build` still fails on unrelated platform env requirements (`DATABASE_URL` and provider authenticator/apiKey config) outside the hero scope. (files: `docs/planning/phase-11/plan.md`, `docs/planning/phase-11/a/plan.md`, `docs/planning/phase-11/b/plan.md`, `docs/planning/phase-11/c/plan.md`)
- 2026-03-07 22:23 EST — Installed the CSS-resolved packages at the repo root (`tailwindcss`, `tw-animate-css`, `shadcn`), which fixes the Turbopack CSS resolver path that was incorrectly walking the repo root during `npm run web:dev`. `web:dev` is back on the default Turbopack path, with `web:dev:webpack` kept as an explicit fallback. (files: `package.json`, `package-lock.json`, `node_modules/**`, `apps/web/package.json`)

## Phase Summary

- Shipped:
  - A new hero media carousel that replaces the prior animation mock with taller reel-style posters, clean side previews, and a scroll-linked dock into a dashboard-like shell.
  - Hero-specific Playwright coverage for carousel advance, dock progression, mobile composition, and reduced-motion fallback.
  - A clean rebase of the feature branch onto the latest `ItsAR-VR/main` without hero-file conflicts.
- Verified:
  - `npx playwright test tests/hero-media-stage.spec.ts tests/marketing-redesign.spec.ts --workers=1` — pass (`12 passed`, `4 skipped`)
  - `npm run web:build` — blocked by pre-existing platform env requirements (`DATABASE_URL is required`; `Neither apiKey nor config.authenticator provided`)
- Notes:
  - `npm run web:dev` now starts successfully on Turbopack after the root CSS-package install; `npm run web:dev:webpack` remains available as an explicit fallback.
