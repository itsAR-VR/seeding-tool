# Phase 4 — Implement Aha Playwright audit pack (marketing + platform) + living docs

> **Status:** Superseded by the merged plan in `docs/planning/phase-5/plan.md`. Phase 4 was never implemented; Phase 5 is the canonical starting point.

## Purpose
Implement the Playwright-based “audit pack” that captures `aha.inc` (marketing) and `platform.aha.inc` (authenticated app) into deterministic artifacts + living Markdown docs, so we can rebuild the UI/UX 1:1 in custom code (Next.js + Tailwind) without losing animations/micro-interactions.

## Context
You own `aha.inc` and need to migrate/recreate the experience (including micro-animations) into a custom-code implementation. We will treat the live sites as black boxes and derive structure from DOM/CSS/runtime behavior + network traffic.

Current known shape (from reconnaissance):
- Marketing (`https://aha.inc`) is served by Next.js and Tailwind (Tailwind CSS banner indicates v4.1.4). It loads multiple fonts (Geist, Inter, Plus Jakarta Sans, Poppins, DM Sans, etc.) via `@font-face` in Next static CSS.
- Marketing route discovery is supported by `robots.txt` → `sitemap.xml` (currently includes `/pricing`, `/privacy-policy`, `/terms-of-service`, `/caseStudies`).
- Platform (`https://platform.aha.inc`) is a SPA served from S3/CloudFront with bundles under `https://static.headai.io/advertiser-platform/...`, and uses DM Sans + Bitter (Google Fonts + bundled `@font-face`).
- Auth is Google OAuth/SSO; after login we must go through onboarding (choosing sample data) and then land in the dashboard. We are not signed in yet, so the audit harness must support a manual “headed bootstrap” pause.

We will run against production but only within a test org, and avoid destructive actions by default.

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 2 | Active | Domain: Aha audit blueprint + output contract | Phase 4 implements Phase 2. Keep the same output conventions (`artifacts/<run-id>/...`, `.auth/`, `docs/audit/...`). |
| Phase 3 | Active | Domain: Playwright teardown/capture tooling | Reuse shared capture primitives; avoid creating a second, incompatible artifact/doc structure. |

## Objectives
* [ ] Create a runnable Node/TypeScript + Playwright audit harness with a stable CLI contract.
* [ ] Capture marketing pages page-by-page: multi-viewport screenshots, DOM snapshots, tokens, and observed animation/micro-interaction evidence.
* [ ] Support platform manual Google login bootstrap, then automatically record onboarding (sample data) into a flow doc with step artifacts.
* [ ] Crawl authenticated platform IA (“everything reachable”) and capture per-route pages + network behavior (HAR + request index).
* [ ] Generate and continuously update a living Markdown knowledge base (one file per page + flow docs + global index).

## Constraints
- **No auth/MFA/CAPTCHA bypass.** Use headed mode with explicit pause points.
- **Production safety:** default `ALLOW_DESTRUCTIVE=0`; allow only safe, reversible actions needed to proceed and only within a test org; prefix created entities with `PW_TEST_`.
- **Data sensitivity:** artifacts (screenshots/HAR) may contain sensitive data. Store under `artifacts/` and keep `artifacts/` + `.auth/` out of git (gitignore).
- **Determinism:** baseline capture must run with reduced motion enabled; motion capture runs separately to record micro-interactions.
- **Output contract compatibility:** reuse Phase 2 output paths and doc structure; do not introduce parallel conventions.

## Success Criteria
- `npm run audit:marketing` produces:
  - `artifacts/<run-id>/marketing/routes.json` with verified status + final URLs
  - per-route artifacts: screenshots (desktop/tablet/mobile), DOM snapshot, and animation event logs
  - `artifacts/<run-id>/marketing/tokens.json` and `artifacts/<run-id>/marketing/animations.json`
  - updated Markdown under `docs/audit/pages/marketing/` plus a global index `docs/audit/index.md`
- `npm run audit:platform:bootstrap` (headed) produces:
  - `.auth/platform.afterOnboarding.storageState.json`
  - `docs/audit/flows/platform/onboarding.md` with step-by-step screenshots + extracted form fields
- `npm run audit:platform` produces:
  - `artifacts/<run-id>/platform/routes.json` discovered via UI crawl
  - `artifacts/<run-id>/platform/network/platform.har` + request index
  - per-route captures and updated docs under `docs/audit/pages/platform/`

## Subphase Index
* a — Scaffold project + config + output contract
* b — Implement marketing route discovery + capture pipeline
* c — Implement platform bootstrap login + onboarding flow recorder
* d — Implement authenticated platform crawl + route capture + network logs
* e — Implement Markdown reporter + doc indexes + runbook


## Terminus Maximus Completion Pass — 2026-03-02
- Phase 4 remains historical/superseded for the current landing-page-first stream.
- No additional implementation was required in this pass.
- Status: Closed as archived.

## Execution Status Update — 2026-03-02
- Done:
  - Core audit output contract is active and produced run artifacts: `artifacts/20260302-legacy/run-summary.json`, `artifacts/20260302-legacy/marketing/routes.json`, `artifacts/20260302-legacy/competitors/tks/routes.json`.
  - Reporter outputs were regenerated: `docs/audit/index.md`, `docs/audit/pages/marketing/home.md`, `docs/audit/pages/competitors/tks/home.md`.
- Partial:
  - Platform route capture completed only in unauthenticated baseline mode: `artifacts/20260302-legacy/platform/routes.json`, `docs/audit/pages/platform/login.md`.
  - Campaign flow output remains baseline-only: `docs/audit/flows/platform/campaign-create.md`.
- Blocked:
  - Authenticated platform capture remains blocked pending manual OAuth bootstrap in headed mode.
  - Recovery sequence is tracked in `docs/planning/phase-5/plan.md` and `docs/planning/phase-5/g/plan.md`.
