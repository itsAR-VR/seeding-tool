# Phase 1f — Local evaluation loop + CRO experiment backlog + handoff

## Focus
Document what is ready, what remains, and how to iterate with local evidence.

## Inputs
- Implemented app and planning outputs from subphases a-e

## Work
1. Define local QA loop (Playwright screenshot + console/network checks).
2. Define first CRO experiment queue.
3. Mark completion status and handoff to next phase.

## Output
Local QA runbook for next pass:
1. `cd apps/web && npm install`
2. `npm run dev`
3. Run Playwright checks for:
   - desktop + mobile screenshots
   - console error scan
   - CTA link behavior to booking URL

Initial CRO experiment backlog:
- Hero headline angle test (workflow automation vs revenue outcome framing)
- CTA copy test (`Book demo` vs `Get my seeding audit`)
- Social proof ordering (logos-first vs testimonial-first)
- Problem-section compression (6 bullets vs 3 grouped statements)
- Follow-up completed: deferred pricing page now implemented at `apps/web/app/pricing/page.tsx`

QA evidence captured:
- Home screenshot: `/tmp/seeding-home-local-after-fix.png`
- Pricing screenshot: `/tmp/seeding-pricing-local.png`
- Console errors: none on `/` and `/pricing`
- Runtime fix applied: added `apps/web/public/favicon.ico` to remove `GET /favicon.ico` 404

## Handoff
Phase 1 implementation complete for code + docs. Next phase should add `/pricing`, wire analytics provider, and run formal local Playwright evidence capture.

## Execution Update — 2026-03-02
- Local QA executed with Playwright on `/` and `/pricing` at `http://127.0.0.1:3001`.
- No console errors observed after fixes.
- Iteration fix applied: reveal-on-scroll CSS no longer hides below-fold sections before intersection; content remains visible while preserving motion.
- Generated evidence assets: `landing-after-fix.png`, `pricing-after-redesign.png`.
