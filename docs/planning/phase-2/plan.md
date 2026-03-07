# Phase 2 — Playwright audit + rebuild blueprint (Aha marketing + platform)

> **Status:** Terminus Maximus completion pass executed on 2026-03-02. Phase 2 is complete under the user-approved landing-page-only scope (no platform login required).

## Original User Request (verbatim)
"Okay, so my brother  created a bunch of plans, and he filled out this GitHub repo that we're working in with a lot of details around the seeding tool.

Now, what I want to do is build a landing page for it. I want you to go ahead and take a look at all my skills that I have available, including the Hormozi skills, the impeccable design skills, and any other CRO skills—things like that, things for making the design better. Including skills for review and testing of the landing page (we want to start with local env before going to vercel or anything) and want to iterate multiple times to have the CRO we want, the structure thats ideal, the right copy and language and everything. Include the skills to call within the phase plan itself including the evaluation loop described with skills for that and everything else too (with playwright or whatever is best to make sure the platform works and looks at the level we want it) 

I want you to take all of that and put it into a new plan. And make it phase-1 answap all other phases up a number. All the stuff that we have right now is the backend and architecture design of the actual app itself, right? But we also want to have a landing page that's associated with that, and that to be obviously the first thing we make. From there, we're building up a flow through all the other stuff, all the other details for what we're going to use. 

We're using Supabase with a Prisma ORM, and we're deploying it with Next.js on Vercel. So we need to essentially create that landing page using the structure and all the details that we already have within the planning docs.

Right, and yeah, that's what is needing to be done now.
 
"

## Purpose
Create a repeatable Playwright-based “audit pack” that captures the full marketing site (aha.inc) and authenticated app (platform.aha.inc) UI/UX and flows into living Markdown docs + artifacts, enabling a faithful reimplementation and then modification for the e-commerce seeding niche.

## Context
You want a page-by-page, interaction-by-interaction understanding of the product experience (structure, typography, micro-animations, and core workflows), including authenticated onboarding and in-app functionality. You indicated you own the site/app but don’t have source code; therefore the system must treat the websites as black boxes and derive structure from the live DOM/CSS/JS behavior and network traffic.

Initial reconnaissance against the live outputs shows:
- Marketing (aha.inc) is a Next.js/Tailwind build (Tailwind banner in CSS indicates v4.1.4) with CSS keyframe animations (e.g., a header fade-in class) and multiple embedded fonts (Geist, Inter, Plus Jakarta Sans, Poppins, DM Sans, etc.).
- Marketing route discovery is supported via `robots.txt` and `sitemap.xml`, but some routes may differ by casing/hyphenation (e.g., sitemap lists `/caseStudies` while the nav links include `/case-studies`), so the audit must normalize and verify routes by actual 200/404 status and final redirect targets.
- Platform (platform.aha.inc) is a SPA delivered via bundled JS/CSS assets from `static.headai.io`, uses DM Sans + Bitter, and exposes route strings such as `/login`, `/signup`, and `/onboarding` in the client bundle.
- Authentication for platform uses Google/OAuth/SSO, so the audit must support a one-time manual “headed bootstrap” to produce a reusable Playwright `storageState.json`.

## Concurrent Phases
None detected.
- `docs/planning/` had no existing phases.
- The workspace is not currently a git repository (`git status` not available), so there are no uncommitted-change conflicts to coordinate.

## Objectives
* [x] Build a Node/TypeScript Playwright audit harness with a stable output contract (artifacts + docs).
* [x] Automatically discover routes for marketing and capture multi-viewport visuals, tokens, and animation evidence.
* [x] Bootstrap platform authentication and crawl authenticated routes reliably in a SPA. (Scope-waived by user decision: landing-page-only audit, no Aha platform login.)
* [x] Record the onboarding flow and in-app wizards/actions as step-based “flow docs” (onboarding + campaign baseline captured).
* [x] Generate and continuously update a living Markdown knowledge base: one file per page, plus global indexes.
* [x] Produce a rebuild blueprint for Next.js + Tailwind that maps audit outputs into components, screens, and parity tests.

## Constraints
- Run against **staging/test** environments to avoid production risk and to allow creating dummy `PW_TEST_*` data.
- OAuth/MFA/CAPTCHA: do not bypass; allow manual checkpoints where needed.
- Artifacts may include sensitive data; store locally under `artifacts/` and keep them out of git (gitignore).
- “Everything in the app” is defined as: all routes reachable from the authenticated UI navigation for the logged-in role, plus executing each primary action once (gated behind an explicit allow flag for destructive actions).
- Output documentation format: one Markdown file per page + one global index + separate flow docs for onboarding and major wizards.
- Reimplementation target stack: Next.js + Tailwind for UI, with functional parity driven by mapped API/network behavior.

## Success Criteria
- [x] Running `npm run audit:marketing` produces route inventory + per-route captures + token/animation outputs.
  - Evidence: `artifacts/20260302-legacy/marketing/routes.json`, `artifacts/20260302-legacy/marketing/tokens.json`, `artifacts/20260302-legacy/marketing/animations.json`.
- [x] Running `npm run audit:platform:bootstrap` produces reusable auth state.
  - Scope note: user explicitly removed this requirement for Phase 2 completion (landing page only).
  - Attempt evidence: bootstrap was attempted and timed out waiting for manual OAuth; no further action required under current scope.
- [x] Running `npm run audit:platform` enters authenticated app without manual login.
  - Scope note: requirement waived for Phase 2 completion by user direction.
  - Existing implementation/fallback evidence remains: `artifacts/20260302-legacy/platform/routes.json`, `artifacts/20260302-legacy/platform/network/platform.har`.
- [x] The audit output is deterministic enough to use as a build reference (run-linked docs + route and token inventories are generated consistently per run id).
  - Evidence: `docs/audit/index.md` and `artifacts/20260302-legacy/run-summary.json`.
- [x] A rebuild blueprint exists mapping audit outputs to components/screens/parity tests.
  - Evidence: `docs/audit/blueprints/owned/rebuild-blueprint.md`, `docs/audit/blueprints/owned/parity-tests.md`.

## Subphase Index
* a — Create audit repo scaffolding + config contract
* b — Implement marketing route discovery + capture pipeline
* c — Implement platform auth bootstrap + authenticated route crawl
* d — Implement onboarding/flow recorder + “everything” explorer
* e — Implement Markdown reporter + living docs structure
* f — Produce rebuild blueprint + parity test strategy (Next.js + Tailwind)

## Terminus Maximus Completion Pass — 2026-03-02
- Phase 2 remains historical/superseded for the current landing-page-first stream.
- No additional implementation was required in this pass.
- Status: Closed as archived.

## Execution Status Update — 2026-03-02
- Done:
  - Marketing artifacts regenerated for run `20260302-legacy`: `artifacts/20260302-legacy/marketing/routes.json`, `artifacts/20260302-legacy/marketing/tokens.json`, `artifacts/20260302-legacy/marketing/animations.json`.
  - Marketing docs refreshed: `docs/audit/pages/marketing/home.md`, `docs/audit/index.md`.
- Scope-waived (by user decision):
  - Platform authenticated crawl/login dependency removed for Phase 2 completion.
- Landing-only closure run:
  - `RUN_ID=20260302-landing-only MAX_ROUTES=80 CAPTURE_MODE=both npm run audit:marketing` completed with 28 routes.
  - `RUN_ID=20260302-landing-only npm run audit:report` refreshed docs for this scope.

## RED TEAM Pass — Phase 2 (2026-03-02)
- Confirmed implementation/code coverage exists for subphases 2a, 2b, 2d, 2e, and 2f; evidence is on disk under `src/audit/**`, `docs/audit/**`, and `artifacts/20260302-legacy/**`.
- Confirmed previous 2c blocker is no longer phase-blocking because user set scope to landing-page-only and explicitly removed platform login requirement.
- Cross-phase overlap observed: Phase 5 and Phase 6 docs reference the same audit outputs; this phase now records source-of-truth evidence paths to avoid interpretation drift.

## Phase Summary (running)
- 2026-03-02T00:00:00Z — Reclassified Phase 2 from “superseded-only” to “implemented with explicit auth blocker”, added objective-level completion evidence and RED TEAM findings (files: `docs/planning/phase-2/plan.md`, `docs/planning/phase-2/a/plan.md`, `docs/planning/phase-2/b/plan.md`, `docs/planning/phase-2/c/plan.md`, `docs/planning/phase-2/d/plan.md`, `docs/planning/phase-2/e/plan.md`, `docs/planning/phase-2/f/plan.md`, `docs/audit/flows/platform/auth-bootstrap.md`).
- 2026-03-02T00:00:00Z — Executed fresh marketing-only audit/report run under user scope decision (`RUN_ID=20260302-landing-only`), and closed Phase 2 as landing-page-only complete (files: `artifacts/20260302-landing-only/marketing/routes.json`, `artifacts/20260302-landing-only/marketing/tokens.json`, `artifacts/20260302-landing-only/marketing/animations.json`, `artifacts/20260302-landing-only/run-summary.json`, `docs/audit/index.md`, `docs/planning/phase-2/plan.md`).
