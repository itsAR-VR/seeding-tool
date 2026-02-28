# Phase 3b — Implement marketing route discovery + capture pipeline

## Focus
Automatically discover all marketing pages and capture deterministic references (screenshots, DOM, tokens) plus observed micro-interactions/animations.

## Inputs
- Phase 3a scaffold: config loader, artifact directories, Playwright config.
- Marketing sources:
  - `https://aha.inc/robots.txt` → `sitemap.xml`
  - internal crawl starting at `/`

## Work
1. Discover routes (merge two sources):
   - Parse sitemap URLs and normalize to route keys.
   - Crawl internal links via BFS up to `MAX_DEPTH`, collecting same-origin routes.
   - Merge/dedupe and retain provenance (`discoveredFrom: ['sitemap','crawl']`).
2. Verify routes:
   - `goto` each candidate and record final URL, redirect chain, status, and “soft 404” heuristics.
   - Write `artifacts/<run-id>/marketing/routes.json`.
3. Baseline capture (reduced motion):
   - wait for fonts (`document.fonts.ready`)
   - scroll to load lazy content
   - per viewport: full-page screenshot, above-the-fold screenshot, DOM snapshot, a11y snapshot.
4. Motion/micro-interaction capture:
   - enable motion
   - install listeners for `animation*` and `transition*` events
   - run interaction script per page: hover CTAs/nav, open menus/accordions/modals, segmented scroll for scroll-triggered animations.
   - save event logs and short video (at least desktop).
5. Token extraction:
   - fonts used (computed styles), type scale, color histogram, radii, shadows
   - extract CSS `@keyframes` names from CSS responses and map to observed usage where possible.
   - write `artifacts/<run-id>/marketing/tokens.json` + `animations.json`.

## Output
- `artifacts/<run-id>/marketing/routes.json`
- Per-route artifacts under `artifacts/<run-id>/marketing/<routeKey>/...`
- `artifacts/<run-id>/marketing/tokens.json`
- `artifacts/<run-id>/marketing/animations.json`

## Handoff
Phase 3c reuses the same capture primitives but adds a manual auth bootstrap and flow recording for onboarding.

