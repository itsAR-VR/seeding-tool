# Phase 3a — Establish competitor capture runner + route inventories

## Focus
Create a repeatable, throttled capture workflow and produce an initial verified route inventory for `tks.world` and `refunnel.com` that downstream subphases can consume deterministically.

## Inputs
- Phase 3 root plan (constraints, caps, outputs).
- Phase 2 output contract (target: reuse `artifacts/<run-id>/…` and `docs/audit/…` conventions).
- Target domains:
  - `https://www.tks.world`
  - `https://refunnel.com`

## Work
1. Define a single **run id** format and folder layout (no per-subphase drift):
   - `RUN_ID = YYYY-MM-DD--competitors--tks-refunnel`
   - Artifact roots:
     - `artifacts/<run-id>/competitors/tks/`
     - `artifacts/<run-id>/competitors/refunnel/`
2. Route discovery:
   - TKS: fetch and parse `https://www.tks.world/sitemap.xml` into a candidate URL list.
   - Refunnel: build a crawl-based candidate URL list:
     - Start from `/`, then follow internal `<a>` links (same origin), plus nav/footer links, with `MAX_DEPTH=5`.
     - Track visited canonicalized URLs; strip hash + known tracking queries (`utm_*`, `gclid`, `fbclid`, etc.).
3. Route verification:
   - For every candidate URL, record: final URL after redirects, HTTP status, page title, and whether content appears blocked (CAPTCHA/Turnstile page markers).
   - Maintain `routes.json` with stable keys and ordering.
4. Capture baseline assets per route (minimal pass to support later analysis):
   - Screenshots: desktop/tablet/mobile (full page).
   - DOM snapshot: serialized HTML after `networkidle` (or a timeboxed “rendered DOM” dump if `networkidle` never settles).
   - Loaded resources: list JS/CSS URLs used on the page (for motion/tooling detection).
5. Throttling + anti-bot hygiene:
   - Default to headed mode, `slowMo` enabled for crawl runs.
   - Add `RATE_LIMIT_MS=500–1500` jitter between navigations and limit concurrency (1–2 pages at a time).
   - If a challenge page appears (Cloudflare/Turnstile), stop the batch run and record the failure state + manual next step.

## Output
- `artifacts/<run-id>/competitors/tks/routes.json`
- `artifacts/<run-id>/competitors/refunnel/routes.json`
- Baseline screenshot + DOM snapshot folders per site
- A short `docs/audit/pages/competitors/<site>/index.md` describing:
  - route discovery method
  - caps/exclusions used
  - any pages blocked or skipped (with reasons)

## Handoff
Subphase 3b should use the finalized TKS `routes.json` as the authoritative page list and deepen captures (structure + typography + motion evidence) without changing the route inventory format.

