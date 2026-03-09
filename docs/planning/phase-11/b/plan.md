# Phase 11b — Refine carousel composition and scroll-to-dashboard motion across desktop and mobile

## Focus
Take the verified hero stage scaffold and tune it into the intended experience: two dominant center cards, smaller side previews, calm autoplay, and a clear downward dock animation into the dashboard shell.

## Inputs
- Phase 11a output
- `apps/web/app/(marketing)/components/HeroScene.tsx`
- `apps/web/app/(marketing)/components/HeroScene.module.css`
- `apps/web/app/globals.css`
- Browser screenshots / Playwright observations from the local validation loop

## Skills Available for This Subphase
- `find-local-skills` / `find-skills` routing is not exposed as an invokable tool in this session; fallback is manual selection from the installed skill catalog plus direct `SKILL.md` reads.
- `frontend-design`
- `playwright-testing`
- `karpathy-guidelines`

## Work
- Tune the desktop carousel so two center cards dominate and side previews stay clearly secondary.
- Simplify card copy and chrome until no visual clutter remains.
- Refine the scroll-progress choreography so cards pull downward into the dock grid in a readable, reversible way.
- Create a calmer mobile arrangement with one dominant card and a meaningful adjacent preview.
- Preserve reduced-motion clarity by rendering a static docked interpretation.

## Validation
- Browser screenshots for desktop and mobile hero states
- DOM/state checks for carousel and dock progress
- No clipped text or overlapping card surfaces in the hero viewport

## Progress This Turn (Terminus Maximus)
- Work done:
  - Constrained the carousel to the central dock canvas so it no longer overlaps the queue/metric rails.
  - Shifted the posters to a taller reel-like aspect ratio with two dominant center cards and smaller clipped side previews.
  - Added a clearer dock grid with subtle slot copy so the scroll destination reads like a dashboard instead of an empty shell.
  - Reduced the hero shell height budget in `globals.css` so the dock transition completes with less empty gradient tail below the hero.
- Commands run:
  - Playwright browser snapshots/screenshots — pass; desktop and mobile hero states were iterated against live browser captures.
- Blockers:
  - None in the feature scope.
- Next concrete steps:
  - Run the hero spec and the broader marketing regression suite on the refined layout.

## Output
- `apps/web/app/(marketing)/components/HeroScene.tsx`
  - Carousel slot math, dock slot math, and copy visibility now match the calmer media-first composition.
- `apps/web/app/(marketing)/components/HeroScene.module.css`
  - Card proportions, dock canvas, and poster styling now read as placeholder reels instead of washed generic tiles.
- `apps/web/app/globals.css`
  - Hero shell height tuned for a shorter, more purposeful scroll segment.

## Handoff
The hero composition is visually stable. Phase 11c should lock it with tests, rebase onto the newest remote main, and record the remaining build blocker.

## Coordination Notes
- Hero-only changes should stay inside the marketing hero surface unless a browser-tested issue proves a surrounding layout adjustment is necessary.
