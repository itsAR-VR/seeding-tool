# Phase 10b — Hero SVG upgrade: from wireframe diagram to product-credible UI

## Focus
Transform the hero SVG from an abstract wireframe diagram into something that builds product credibility. Competitors show real dashboards; our hero needs to feel like a real product interface, not a Figma sketch.

## Inputs
- Phase 10a output (intelligence section fixed, nav accessible)
- Current hero SVG: `apps/web/app/(marketing)/components/HeroScene.tsx`
- Current hero CSS: globals.css scene-* rules (~lines 1800-1990)
- Competitor reference: Refunnel shows actual dashboard screenshots, Aha shows real product UI

## Skills Available for This Subphase
- `find-local-skills` / `find-skills` routing is not exposed as an invokable tool in this session; fallback is manual selection from the installed skill catalog plus direct `SKILL.md` reads.
- `impeccable:bolder` — amplify the hero to feel more confident
- `impeccable:animate` — review and improve animation choreography
- `frontend-design` — design principles for hero sections
- `playwright` — screenshot at each iteration

## Work

### 1. Audit the current HeroScene.tsx
- Read the full SVG structure
- Identify what reads as "wireframe" vs "product UI"
- Key problems: flat shapes, generic labels, no data density, no realistic UI chrome

### 2. Upgrade SVG to feel like a product interface
Options (choose based on what's achievable in SVG):

**Option A: Enrich the existing SVG** (preferred if structure is good)
- Add realistic UI chrome: proper input fields, table rows, avatar circles, status badges with real-looking data
- Add depth: subtle shadows within the SVG, layered card panels
- Add data density: numbers, percentages, date stamps — things that make it feel like real software
- Refine the color palette within the SVG to match the tricolor system

**Option B: Simplify to a confident abstract** (fallback)
- If the SVG structure can't support product-level detail, lean into confident abstraction
- Use bold geometric shapes, meaningful iconography, and the tricolor system
- Make it feel intentional and designed, not like a wireframe

### 3. Refine animation choreography
- Ensure entrance animations stagger meaningfully (cards lift in sequence, not all at once)
- Float animations should feel organic (different durations, different amplitudes)
- Signal pulses should draw the eye to key interaction points
- Verify `prefers-reduced-motion` still disables all animation

### 4. Verify
- Playwright screenshot of hero viewport (desktop 1440x900)
- Playwright screenshot of hero viewport (mobile 390x844)
- Compare before/after — does it feel more like a product and less like a wireframe?
- All 9 tests pass

## Validation (RED TEAM)
- Verify the accessibility snapshot for the hero scene exposes real product cues: campaign toolbar, creator queue, active creator state, and live metrics.
- Capture hero screenshots at desktop (`1440x900`) and mobile (`390x844`) after a short settle.
- Run `npx playwright test tests/marketing-redesign.spec.ts --workers=1`; expected result is 9 passes with only the desktop-only mobile check skipped.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Re-read `apps/web/app/(marketing)/components/HeroScene.tsx` and the `scene-*` rules in `apps/web/app/globals.css` before editing.
  - Replaced the abstract wireframe SVG with a product-credible control surface: campaign toolbar, creator queue, active creator workflow, live metrics, and contextual callout cards.
  - Added supporting `scene-*` typography, toolbar, queue, and metric styles in `apps/web/app/globals.css` while preserving the existing reduced-motion guardrails and restrained float/pulse choreography.
- Commands run:
  - Playwright hero screenshots — pass; saved `phase10b-before-hero.png`, `phase10b-after-hero-desktop.png`, and `phase10b-after-hero-mobile.png`.
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` — pass; `9 passed`, `1 skipped`.
- Blockers:
  - None.
- Next concrete steps:
  - Start Phase 10c by restructuring at least two equal-card sections away from uniform grids, beginning with the pain strip and proof/evidence rhythm.

## Output
- `apps/web/app/(marketing)/components/HeroScene.tsx`
  - Hero illustration now communicates a believable seeding workspace instead of an abstract diagram.
- `apps/web/app/globals.css`
  - Added hero-scene support styles for toolbar, queue rows, metric cards, and darker workflow panes.
- Screenshot evidence:
  - `phase10b-before-hero.png`
  - `phase10b-after-hero-desktop.png`
  - `phase10b-after-hero-mobile.png`
- Validation:
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` → `9 passed`, `1 skipped`

## Handoff
Hero is upgraded. Pass to Phase 10c for layout variety work. The hero change shifts the page’s visual weight upward, so 10c should take a fresh full-page screenshot before starting and use that to rebalance the middle sections.

## Coordination Notes
- Shared file overlap: `apps/web/app/globals.css` was already dirty from the current marketing iteration. This turn added hero-only `scene-*` support without rewriting unrelated section rules.
- Cross-phase risk: future work in 10c/10d should re-read both `HeroScene.tsx` and the `scene-*` block before editing so the credibility upgrade is preserved while the remaining page sections are restructured.
