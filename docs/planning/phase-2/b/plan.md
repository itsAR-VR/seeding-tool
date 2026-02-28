# Phase 2b — TKS teardown (page-by-page structure + typography + motion evidence)

## Focus
Perform a deep, page-by-page teardown of TKS pages: information architecture, layout patterns, typography, and micro-animations; produce reusable notes that can be mapped to our product funnel.

## Inputs
- `artifacts/<run-id>/competitors/tks/routes.json` (authoritative list).
- Baseline screenshots/DOM snapshots from Phase 2a.

## Work
For each high-priority TKS page (start with `/`, `/apply-now`, `/in-person`, `/virtual`, `/summer-program`, `/about`, `/financial-aid`, `/faq`, `/alumni`):
1. **Structure outline**
   - Break the page into sections and components (hero, social proof, program breakdown, outcomes, FAQ, CTA blocks, footer).
2. **Typography inventory**
   - Capture computed styles for body, H1/H2/H3, nav, buttons, and key callouts (family, size, weight, letter-spacing, line-height).
   - Note any Webfont loading behavior and fallback fonts.
3. **Motion inventory (TKS-specific)**
   - Identify scroll-triggered animations, text-splitting effects, hover interactions, and transitions.
   - Capture evidence as either:
     - short per-interaction videos, or
     - step screenshots with timestamps (start → mid → end states).
4. **Interaction walkthroughs**
   - Document how navigation, “menu” behavior, and key CTAs behave (including any sticky/animated header behaviors).
5. **Reusable pattern extraction**
   - Normalize patterns into named templates (e.g., “mega-hero + marquee CTA”, “program section scroller”, “testimonial slider”, “FAQ accordion”).

Documentation method: for each page, apply a strict loop (Plan → Locate → Extract → Solve → Verify → Synthesize) so claims are grounded in captured artifacts.

## Output
- `docs/audit/pages/competitors/tks/<path>.md` (one file per page) containing:
  - section map
  - component list
  - typography table
  - motion notes with links to local artifacts (screenshots/videos)
  - “what we’ll reuse” vs “what we’ll change for our product”
- `artifacts/<run-id>/competitors/tks/typography.json` and `motion.json` updated with aggregated findings.

## Handoff
Subphase 2c should mirror this process for Refunnel, producing comparable docs and JSON so we can later synthesize cross-site patterns directly.

