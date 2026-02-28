# Phase 1b — Implement marketing route discovery + capture pipeline

## Focus
Automatically discover all marketing routes and capture stable visual + structural references (multi-viewport screenshots, DOM snapshots, tokens, and animation inventory) for each route.

## Inputs
- Phase 1a scaffold:
  - Playwright config
  - Config/env var contract
  - Artifact output directories
  - `audit:marketing` command
- Marketing discovery sources:
  - `robots.txt` and `sitemap.xml`
  - Internal link crawl starting at `/`

## Work
1. Route discovery (two sources, then merge):
   - Sitemap parse:
     - Fetch `${MARKETING_BASE_URL}/robots.txt`, detect sitemap URL(s), fetch sitemap XML.
     - Extract `<loc>` URLs and normalize to route keys (strip origin, normalize slashes).
   - Crawl:
     - Start at `${MARKETING_BASE_URL}/`.
     - Collect all internal `<a href>` targets (same origin), BFS up to `MAX_DEPTH`.
   - Merge and normalize:
     - Deduplicate by normalized routeKey.
     - Keep a `discoveredFrom: ['sitemap','crawl']` list.
2. Route verification:
   - For each candidate URL, `goto` and record:
     - initial URL, final URL, redirect chain, HTTP status code.
     - “Next.js 404 shell” detection (title/heading patterns).
   - Produce `artifacts/<run-id>/marketing/routes.json`.
3. Baseline capture (deterministic reference):
   - Emulate reduced motion.
   - Wait for `document.fonts.ready`.
   - Scroll page to trigger lazy loads, return to top.
   - Capture per viewport:
     - full-page screenshot
     - above-the-fold screenshot
     - DOM snapshot (`page.content()`)
4. Motion/interaction capture:
   - Motion enabled.
   - For each route, perform:
     - hover over primary nav items and CTAs
     - open/close menus, accordions, modals (if present)
     - slow scroll to capture scroll-triggered animations
   - Capture short video and “before/after” screenshots of key states.
5. Token + animation inventory:
   - Extract computed typography tokens (font families, sizes, weights, tracking, line-heights) for headings/buttons/body.
   - Extract color palette usage (color/background/border/shadow).
   - Parse CSS responses to extract `@keyframes` names and map any observed `animation-name` usage on DOM elements.
   - Produce `artifacts/<run-id>/marketing/tokens.json` and `animations.json`.

## Output
- Marketing artifacts:
  - `artifacts/<run-id>/marketing/routes.json`
  - `artifacts/<run-id>/marketing/<routeKey>/{screenshots,dom,tokens,animations,video}/...`
  - `artifacts/<run-id>/marketing/tokens.json`
  - `artifacts/<run-id>/marketing/animations.json`

## Handoff
Subphase 1c should reuse the same capture primitives for the platform app, but add an auth bootstrap and SPA-aware route discovery/crawling.

