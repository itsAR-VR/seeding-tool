# Phase 3d — Motion/typography “library” spec + component pattern catalog

## Focus
Turn raw teardown observations into an implementable, reusable **design system slice**: named typography tokens, layout primitives, and a compact motion library that recreates the “feel” (not the source code) of TKS + Refunnel.

## Inputs
- `artifacts/<run-id>/competitors/tks/typography.json` + `motion.json`
- `artifacts/<run-id>/competitors/refunnel/typography.json` + `motion.json`
- Per-page docs under `docs/audit/pages/competitors/`

## Work
1. Typography tokens:
   - Define `font.body`, `font.heading`, and scale tokens (`text-xs…text-6xl`) aligned to observed hierarchy.
   - Define tracking/leading tokens to support TKS-like oversized typography and Refunnel-like headline rhythm.
2. Component catalog:
   - Create a merged list of reusable components (hero variants, stats chips, feature grids, FAQ accordion, testimonial/case modules, CTA blocks).
   - For each component, document:
     - structure (slots/props)
     - responsive behavior
     - motion hooks (on-mount, on-scroll, on-hover)
3. Motion library spec (GSAP-first):
   - Define a small set of primitives with parameters:
     - `reveal.fadeUp`, `reveal.splitTextLines`, `hover.lift`, `parallax.y`, `marquee.loop`, `accordion.expand`, etc.
   - For each primitive, document:
     - trigger (scroll position / hover / mount)
     - duration, delay, easing, stagger, and reduced-motion behavior
     - failure modes (fonts not loaded, SplitText timing) and mitigations
4. Evidence mapping:
   - Link each token/primitive to at least one captured artifact (screenshot/video) to ground the spec.

## Output
- `docs/audit/competitors/fusion-typography.md` (tokens + usage)
- `docs/audit/competitors/fusion-motion.md` (motion primitives + parameters)
- `docs/audit/competitors/component-catalog.md` (components + mapping)

## Handoff
Subphase 3e should translate these specs into a concrete site IA + page templates for our product, and produce a prioritized implementation backlog tied to the existing roadmap.

