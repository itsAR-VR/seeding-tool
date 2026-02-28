# Phase 4c — Implement marketing runners (owned + competitors) + route inventories

## Focus
Implement route discovery + capture for:
- Owned marketing site (`aha.inc`)
- Competitor marketing sites (`tks.world`, `refunnel.com`) with throttling/anti-bot hygiene and “no asset/code copying” constraints.

## Inputs
- Phase 4b shared capture primitives.
- Sites (canonical URLs per Phase 4 root plan):
  - Owned marketing: `https://aha.inc`
  - Competitors: `https://www.tks.world`, `https://refunnel.com`

## Work
1. Owned marketing route discovery (Aha):
   - fetch `robots.txt` and parse sitemap URL(s)
   - parse `sitemap.xml` `<loc>` URLs
   - BFS crawl from `/` (same-origin `<a href>`) up to `MAX_DEPTH`
   - normalize routes and verify status; handle casing/redirect drift (e.g., `/caseStudies` vs `/case-studies`)
   - output `artifacts/<run-id>/marketing/routes.json`.
2. Competitor route discovery (site-by-site):
   - TKS: parse sitemap (`/sitemap.xml`) into candidates
   - Refunnel: crawl-based candidates (no sitemap), strict canonicalization, exclude tracking query params
   - verify each route and detect “blocked/challenge” pages (Cloudflare/Turnstile markers)
   - output:
     - `artifacts/<run-id>/competitors/tks/routes.json`
     - `artifacts/<run-id>/competitors/refunnel/routes.json`.
3. Capture strategy:
   - Owned marketing: baseline + motion by default (higher fidelity)
   - Competitors: baseline always; motion only for prioritized pages + patterns (to reduce bot triggers)
4. Anti-bot hygiene for competitors:
   - headed mode, low concurrency (1 page at a time)
   - jittered delay between navigations (`RATE_LIMIT_MS` range)
   - **Challenge detection heuristics:**
     - DOM markers: `#challenge-running`, `.cf-turnstile`, `#cf-please-wait`, `[data-cf-turnstile]`
     - HTTP: status 403 + `cf-ray` header present
     - Title contains "Just a moment" or "Attention Required"
   - **Stop-on-challenge behavior:**
     - Capture screenshot as evidence (`blocked-<route>.png`)
     - Mark route in `routes.json` with `"status": "blocked", "note": "Cloudflare challenge detected; run headed and solve manually"`
     - Log to console: `⚠️ Challenge detected at <url>. Run with HEADLESS=false to solve.`
     - Continue to next route (don't abort entire run)
5. Extraction:
   - for all sites: tokens + animations + (optional) resource/tooling detection (GSAP/Lenis/Swiper/etc. presence via loaded scripts)
   - write aggregated:
     - `artifacts/<run-id>/marketing/tokens.json` + `animations.json`
     - `artifacts/<run-id>/competitors/<site>/typography.json` + `motion.json`.

## Output
- Route inventories and per-route artifacts for marketing pages across owned + competitors.
- Minimal competitor indexes:
  - `docs/audit/pages/competitors/<site>/index.md` documenting crawl method, caps, and blocked pages.

## Output (Actual)
- Implemented owned marketing runner: `src/audit/runners/marketing.ts`
  - Sitemap + crawl discovery, per-route capture (baseline + motion), aggregated tokens + animations.
- Implemented competitor runner: `src/audit/runners/competitors.ts`
  - Sitemap-or-crawl discovery, challenge detection, baseline capture, motion sampling, aggregated typography/motion JSON.
- Added supporting utilities:
  - `src/audit/utils/url.ts`, `src/audit/utils/robots.ts`, `src/audit/utils/challenge.ts`, `src/audit/utils/crawl.ts`

## Verification
## Verification
- [ ] `npm run audit:marketing` produces `artifacts/<run-id>/marketing/routes.json` with ≥5 routes
- [ ] Each route entry has `url`, `status` (200/blocked/redirect), and `title`
- [ ] `artifacts/<run-id>/marketing/tokens.json` contains color and typography entries
- [ ] `npm run audit:competitors` produces separate `routes.json` for tks and refunnel
- [ ] Blocked routes (if any) have `"status": "blocked"` and a screenshot in artifacts
- [ ] No crash on Cloudflare challenge (runner continues to next route)

## Handoff
Phase 4d should implement the authenticated app runners (manual OAuth bootstrap + onboarding recorder + IA crawl with HAR capture) using the shared capture primitives.
