# Phase 1c — Implement platform auth bootstrap + authenticated route crawl

## Focus
Enable reliable authenticated automation of the platform SPA by producing a reusable Playwright storage state via a one-time manual OAuth bootstrap, then crawling the authenticated information architecture (IA) to capture pages and network behavior.

## Inputs
- Phase 1a scaffold + Phase 1b capture primitives (screenshots/DOM/tokens/animations).
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
Subphase 1d should layer a step-based flow recorder on top of authenticated crawl to capture onboarding and other wizards/actions as structured “flow docs”.

