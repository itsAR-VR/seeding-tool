# Phase 2c — Implement platform auth bootstrap + authenticated route crawl

## Focus
Enable reliable authenticated automation of the platform SPA by producing a reusable Playwright storage state via a one-time manual OAuth bootstrap, then crawling the authenticated information architecture (IA) to capture pages and network behavior.

## Inputs
- Phase 2a scaffold + Phase 2b capture primitives (screenshots/DOM/tokens/animations).
- Platform known route seeds: `/login`, `/signup`, `/onboarding`.
- Requirement: manual “headed” OAuth bootstrap (no bypass of MFA/CAPTCHA).

## Work
1. Auth bootstrap runner (`audit:platform:bootstrap`):
   - Launch headed browser to `${PLATFORM_BASE_URL}/signup` (or `/login`).
   - Provide an explicit “pause point” where a human completes Google/OAuth and any MFA.
   - Detect successful authentication by presence of app shell elements (navbar/sidebar) and/or disappearance of login form.
   - Save `.auth/platform.storageState.json`.
   - Write a flow doc `docs/audit/flows/platform/auth-bootstrap.md` describing the human actions performed.
2. Authenticated crawl runner (`audit:platform`):
   - Load Playwright context using `.auth/platform.storageState.json`.
   - Navigate to a stable post-login landing route (e.g., `/head` if that is the default redirect; otherwise detect from initial navigation).
   - Discover routes using UI navigation (SPA-aware):
     - Identify nav link candidates from `nav a`, `[role=menuitem]`, sidebar anchors, and visible tab controls (`[role=tab]`).
     - BFS click-through:
       - After click, wait for URL change OR stable content-change heuristic (DOM marker changes).
       - Record the resulting URL and title/primary heading.
   - Produce `artifacts/<run-id>/platform/routes.json` with `discoveredFrom: 'ui-crawl'`.
3. Capture per route:
   - Baseline reduced-motion captures (screenshots + DOM) across viewports.
   - Interaction captures:
     - hover and click primary CTAs
     - open/close dropdowns/modals
   - Network capture:
     - Save HAR + request index (method/url/status/timing/resourceType).
4. Safety gating:
   - Do not execute destructive actions by default.
   - If a flow requires submitting forms to proceed, use a dedicated “test org” and prefix created entities with `PW_TEST_`.

## Output
- `.auth/platform.storageState.json` (gitignored)
- `artifacts/<run-id>/platform/routes.json`
- `artifacts/<run-id>/platform/network/{har.har,requests.jsonl}`
- Per-route captures under `artifacts/<run-id>/platform/<routeKey>/...`
- Auth bootstrap flow doc under `docs/audit/flows/platform/auth-bootstrap.md`

## Handoff
Subphase 2d should layer a step-based flow recorder on top of authenticated crawl to capture onboarding and other wizards/actions as structured “flow docs”.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Verified auth bootstrap runner exists and writes `.auth` storage states when manual OAuth is completed.
  - Verified authenticated crawl runner includes explicit missing-auth guidance and unauthenticated baseline fallback (`AUDIT_ALLOW_UNAUTH_BASELINE=1`).
  - Verified canonical run produced platform route and network outputs in fallback mode.
  - Added missing flow documentation file for bootstrap procedure and unblock steps.
- Commands run:
  - `cat src/audit/runners/platform-bootstrap.ts` — pass; headed OAuth bootstrap + onboarding state save flow implemented.
  - `cat src/audit/runners/platform.ts` — pass; auth preflight + crawl + network capture implemented.
  - `cat src/audit/runners/platform-campaign.ts` — pass; auth-aware campaign flow + fallback mode implemented.
  - `node - <<'NODE' ... NODE` (route counts) — pass; platform routes count = 1 in canonical run (unauth baseline mode).
- Blockers:
  - Manual OAuth bootstrap has not been completed in this workspace, so authenticated route crawl parity is blocked.
- Next concrete steps:
  - Run `RUN_ID=20260302-legacy LOGIN_TIMEOUT_MS=60000 ONBOARDING_MANUAL=1 FLOW_STEP_TIMEOUT_MS=60000 FLOW_MAX_STEPS=40 ALLOW_WRITES=1 npm run audit:platform:bootstrap`.
  - Re-run `RUN_ID=20260302-legacy npm run audit:platform`.

## Output (Execution Status — 2026-03-02)
- Complete (implemented; auth-execution requirement scope-waived for Phase 2 by user decision).
- Evidence:
  - `src/audit/runners/platform-bootstrap.ts`
  - `src/audit/runners/platform.ts`
  - `artifacts/20260302-legacy/platform/routes.json`
  - `artifacts/20260302-legacy/platform/network/platform.har`
  - `docs/audit/flows/platform/auth-bootstrap.md`

## Handoff (Execution Status — 2026-03-02)
- 2d can proceed with flow recorder implementation (already present), but full authenticated explorer coverage depends on completing 2c bootstrap once.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Attempted bootstrap run with extended login timeout; process timed out waiting for manual OAuth interaction.
  - Applied user scope decision: no Aha platform login needed for this phase.
- Commands run:
  - `RUN_ID=20260302-legacy LOGIN_TIMEOUT_MS=600000 ONBOARDING_MANUAL=1 FLOW_STEP_TIMEOUT_MS=60000 FLOW_MAX_STEPS=40 ALLOW_WRITES=1 npm run audit:platform:bootstrap` — fail; timeout waiting for manual OAuth (`page.waitForFunction`).
- Blockers:
  - None for Phase 2 after scope decision.
- Next concrete steps:
  - Keep bootstrap command documented for optional future authenticated audits; not required for Phase 2 closure.
