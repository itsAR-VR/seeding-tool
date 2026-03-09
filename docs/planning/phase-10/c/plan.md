# Phase 10c — Layout variety: break card-grid monotony in 2-3 sections

## Focus
The audit found that the entire page is a march of card grids (3-across, 3-across, 2x2, 3-across, 3-across). Elite SaaS sites break rhythm with asymmetric layouts, feature spotlights, or unexpected compositions. This subphase restructures 2-3 sections to create visual variety.

## Inputs
- Phase 10b output (hero upgraded, intelligence fixed, nav accessible)
- Current page structure: hero → logo rail → 3 pain cards → 3 workflow cards → 4 AI cards → 3 evidence cards + aside → bridge → form → footer
- Competitor reference: Refunnel uses bento grids, sticky pin interactions, dashboard mockups; Aha uses extreme whitespace and asymmetric layouts

## Skills Available for This Subphase
- `find-local-skills` / `find-skills` routing is not exposed as an invokable tool in this session; fallback is manual selection from the installed skill catalog plus direct `SKILL.md` reads.
- `impeccable:bolder` — push safe layouts into more confident territory
- `impeccable:critique` — evaluate layout changes
- `frontend-design` — layout variety principles ("break the grid intentionally for emphasis")
- `playwright` — screenshot each layout change

## Work

### Target sections for layout restructure (pick 2-3):

**Option 1: Workflow section — from 3 equal cards to asymmetric feature layout**
- Instead of 3 equal cards in a row, make it a staggered/stepped layout
- Lead card (Find) could be larger/featured, with Reach and Collect as supporting
- Or use a vertical timeline with alternating left/right content
- CSS-only change: restructure the grid template, no JSX changes needed if possible

**Option 2: Evidence wall — from 3 cards + aside to editorial testimonial layout**
- Large featured quote (full-width, bigger text) + 2 supporting quotes below
- Or an asymmetric 2-column: large quote left, 2 stacked quotes right
- The "Why it lands" aside could become a full-width summary bar
- May need minor JSX restructure in HomeContent.tsx

**Option 3: Pain strip — from 3 equal cards to numbered list or stacked layout**
- Instead of a card grid, use a numbered vertical list with bold headings
- Or a single-column accordion-style layout that doesn't look like cards at all
- This would break the card-grid-card-grid rhythm at the top of the page

### Approach
1. Take full-page screenshot (baseline)
2. Pick 2 sections from the options above
3. Implement CSS layout changes (prefer CSS-only, minimize JSX changes)
4. Screenshot each change individually
5. Evaluate: does the page now have visual rhythm and variety?
6. Run all 9 tests

### Design principles to follow
- Asymmetry should feel designed, not broken
- At least one section should NOT be a grid of equal cards
- Whitespace variation matters — some sections tight, some generous
- Mobile must still work (stacked layouts on small screens)

## Validation (RED TEAM)
- Capture a fresh full-page home screenshot before and after the layout work to confirm the middle-page rhythm changed.
- Inspect the pain strip and evidence wall in the browser at desktop width; expected result is one featured block plus supporting cards instead of repeated equal tiles.
- Run `npx playwright test tests/marketing-redesign.spec.ts --workers=1`; expected result is 9 passes with only the desktop-only mobile check skipped.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Re-read `apps/web/app/(marketing)/components/HomeContent.tsx` and the section CSS in `apps/web/app/globals.css` before editing.
  - Turned the pain strip into a featured-left / stacked-right editorial layout with numbered cards and a stronger lead block.
  - Turned the evidence wall into a lead-quote composition with two supporting quotes and a full-width summary band, reducing the repeated equal-card feel.
- Commands run:
  - Playwright screenshots — pass; saved `phase10c-before-home-full.png` and `phase10c-after-home-full.png`.
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` — pass; `9 passed`, `1 skipped`.
- Blockers:
  - Full-page screenshots still do not trigger reveal animations for offscreen sections, so 10e must use scroll-and-capture for section proof rather than trusting one raw full-page capture.
- Next concrete steps:
  - Start Phase 10d to remove remaining `!important` / `backdrop-filter` debt and clean up typography, proof-rail copy, and required field affordances.

## Output
- `apps/web/app/globals.css`
  - Pain strip is no longer a three-across equal-card row.
  - Evidence wall now has a featured testimonial composition instead of three identical quote cards.
- Screenshot evidence:
  - `phase10c-before-home-full.png`
  - `phase10c-after-home-full.png`
- Validation:
  - `npx playwright test tests/marketing-redesign.spec.ts --workers=1` → `9 passed`, `1 skipped`

## Handoff
Layout variety established. Pass to Phase 10d for code quality cleanup and typography fixes. The layout changes added no new `!important` usage, but 10d should audit the remaining CSS debt and fix the proof-rail / typography issues against the new editorial rhythm.

## Coordination Notes
- Shared file overlap: `apps/web/app/globals.css` continues to be the shared marketing surface. This turn touched only the pain/evidence composition rules and preserved the 10a/10b work already present in the same file.
- Cross-phase risk: 10e screenshot verification must account for the known reveal/full-page-capture mismatch documented above.
