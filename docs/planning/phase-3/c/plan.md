# Phase 3c — Refunnel teardown (page-by-page structure + typography + motion evidence)

## Focus
Perform a deep teardown of Refunnel’s marketing site with an emphasis on its premium visual language and motion polish, while translating SaaS-specific content patterns into structures reusable for a TKS-like program funnel.

## Inputs
- `artifacts/<run-id>/competitors/refunnel/routes.json` (authoritative list).
- Baseline screenshots/DOM snapshots from Phase 3a.

## Work
1. Prioritize pages for deep capture:
   - `/` (home), `/pricing`, `/case-studies`, `/blog`, and the top product pages reachable from nav/footer.
2. Typography + UI token extraction:
   - Capture computed styles for body, headings, nav, buttons, cards, and stats chips.
   - Note font families (observed signals include SF Pro Display + Cabinet Grotesk) and how they’re applied by hierarchy.
3. Motion and micro-interactions:
   - Identify motion primitives used repeatedly (card hover lifts, scroll reveals, section transitions, sticky elements).
   - Detect animation tooling presence (GSAP, ScrollTrigger, SplitText, Lenis, Rive canvas) and map where it’s used.
4. Visual composition patterns:
   - Document recurring layout patterns (hero with floating objects, “stats” chips, feature blocks, content grids, testimonial/case modules).
5. Anti-bot robustness:
   - If Cloudflare/Turnstile blocks capture runs, switch to:
     - headed/manual pass for the blocked pages
     - reduced concurrency and increased throttling
   - Always record which pages were blocked and what evidence we captured anyway.

## Output
- `docs/audit/pages/competitors/refunnel/<path>.md` (one file per page) containing:
  - section map + reusable component list
  - typography table
  - motion notes with links to artifacts
  - “SaaS-to-program translation notes” (what to replace with program/admissions equivalents)
- `artifacts/<run-id>/competitors/refunnel/typography.json` and `motion.json` aggregated.

## Handoff
Subphase 3d should combine the TKS and Refunnel findings into a unified component catalog and a small, implementable motion library spec.

