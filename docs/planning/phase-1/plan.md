# Phase 1 — Playwright audit + rebuild blueprint (Aha marketing + platform)

> **Status:** Superseded by the merged plan in `docs/planning/phase-4/plan.md`. Phase 1 remains for history; implement Phase 4 going forward.

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
* [ ] Build a Node/TypeScript Playwright audit harness with a stable output contract (artifacts + docs).
* [ ] Automatically discover routes for marketing and capture multi-viewport visuals, tokens, and animation evidence.
* [ ] Bootstrap platform authentication and crawl authenticated routes reliably in a SPA.
* [ ] Record the onboarding flow and in-app wizards/actions as step-based “flow docs”.
* [ ] Generate and continuously update a living Markdown knowledge base: one file per page, plus global indexes.
* [ ] Produce a rebuild blueprint for Next.js + Tailwind that maps audit outputs into components, screens, and parity tests.

## Constraints
- Run against **staging/test** environments to avoid production risk and to allow creating dummy `PW_TEST_*` data.
- OAuth/MFA/CAPTCHA: do not bypass; allow manual checkpoints where needed.
- Artifacts may include sensitive data; store locally under `artifacts/` and keep them out of git (gitignore).
- “Everything in the app” is defined as: all routes reachable from the authenticated UI navigation for the logged-in role, plus executing each primary action once (gated behind an explicit allow flag for destructive actions).
- Output documentation format: one Markdown file per page + one global index + separate flow docs for onboarding and major wizards.
- Reimplementation target stack: Next.js + Tailwind for UI, with functional parity driven by mapped API/network behavior.

## Success Criteria
- Running `npm run audit:marketing` produces:
  - `artifacts/<run-id>/marketing/routes.json` with verified status + final URLs.
  - Per-route screenshots (desktop/tablet/mobile) + DOM snapshots.
  - `artifacts/<run-id>/marketing/tokens.json` and `animations.json`.
  - Updated Markdown under `docs/audit/pages/marketing/` and `docs/audit/index.md`.
- Running `npm run audit:platform:bootstrap` produces `.auth/platform.storageState.json` and a repeatable “human steps” flow doc.
- Running `npm run audit:platform`:
  - Enters the authenticated app without manual login.
  - Produces `artifacts/<run-id>/platform/routes.json`, per-route captures, and network logs (HAR + request index).
  - Produces onboarding flow documentation with step screenshots and extracted form schemas.
- The audit output is deterministic enough to use as a build reference (baseline screenshots are stable by running a reduced-motion pass).
- A rebuild blueprint exists that:
  - Translates tokens + animations into a component system.
  - Defines parity Playwright tests for rebuilt screens/flows.

## Subphase Index
* a — Create audit repo scaffolding + config contract
* b — Implement marketing route discovery + capture pipeline
* c — Implement platform auth bootstrap + authenticated route crawl
* d — Implement onboarding/flow recorder + “everything” explorer
* e — Implement Markdown reporter + living docs structure
* f — Produce rebuild blueprint + parity test strategy (Next.js + Tailwind)
