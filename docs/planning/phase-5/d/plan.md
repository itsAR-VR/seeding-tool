# Phase 5d — Implement authenticated app runners (bootstrap + onboarding + IA crawl)

## Focus
Audit the owned authenticated platform (`platform.aha.inc`) end-to-end:
- manual Google OAuth bootstrap (headed)
- onboarding flow recording (choose sample data)
- authenticated IA crawl (“everything reachable”) + per-route capture + network logs

## Inputs
- Phase 5b capture primitives (including network capture).
- Platform target: `https://platform.aha.inc`
- Login method: Google OAuth/SSO (manual completion), then onboarding → dashboard.

## Work
1. Bootstrap runner (`audit:platform:bootstrap`):
   - launch headed browser at `/login` (or canonical entry)
   - pause for human OAuth completion; do not automate MFA/CAPTCHA
   - detect logged-in state using combined heuristics (URL + app shell + API success)
   - **Save storageState immediately after login** to `.auth/platform.afterLogin.storageState.json` (even before onboarding)
   - immediately start onboarding recorder once onboarding is visible
   - **Onboarding fallbacks:**
     - If "sample data" option is not visible, pause and log: `⚠️ Sample data option not found. Please select manually.`
     - If form validation rejects `PW_TEST_*` values, log the field name and pause for human input
     - If onboarding flow has changed, capture what's visible and note discrepancies
   - **Idempotency:** Before creating entities, check if `PW_TEST_*` entities already exist; skip creation if found
   - save `.auth/platform.afterOnboarding.storageState.json` with metadata `{ "onboardingComplete": true/false }`
   - write `docs/audit/flows/platform/onboarding.md`.
2. Authenticated crawl runner (`audit:platform`):
   - load storage state and navigate to dashboard
   - discover routes via UI crawl:
     - nav/sidebar links, menu items, tab controls
     - BFS click-through with robust wait strategy (URL change or content marker changes)
   - capture each route:
     - baseline captures across viewports
     - motion evidence for key interactions (hover menus, dropdowns, modals)
   - capture network:
     - run-level HAR + request index
3. Flow detection (safe mode):
   - detect top CTAs (“Create/New/Add/Next/Save/Publish”)
   - open and document wizards/modals as flows; do not perform destructive actions unless `ALLOW_DESTRUCTIVE=1`
   - prefix created entities with `PW_TEST_` and keep everything in test org.

## Output
- `.auth/platform.afterLogin.storageState.json` (gitignored) — saved immediately after login
- `.auth/platform.afterOnboarding.storageState.json` (gitignored) — saved after onboarding with `onboardingComplete` flag
- `artifacts/<run-id>/platform/routes.json`
- `artifacts/<run-id>/platform/network/platform.har` + request index
- per-route artifacts under `artifacts/<run-id>/platform/<routeKey>/...`
- `docs/audit/flows/platform/onboarding.md` (+ additional flow docs as discovered)

## Output (Actual)
- Implemented onboarding flow recorder and bootstrap runner:
  - `src/audit/capture/flow.ts`
  - `src/audit/runners/platform-bootstrap.ts`
- Implemented authenticated platform crawler:
  - `src/audit/runners/platform.ts`
  - Uses HAR capture + request JSONL + scrubbed HAR output

## Verification
- [ ] `npm run audit:platform:bootstrap` (headed) produces `.auth/platform.afterLogin.storageState.json`
- [ ] After onboarding completes, `.auth/platform.afterOnboarding.storageState.json` exists
- [ ] `npm run audit:platform` (using storageState) navigates to dashboard without manual login
- [ ] `artifacts/<run-id>/platform/routes.json` contains ≥10 routes discovered from UI
- [ ] HAR file exists and `Authorization`/`Cookie` values are `[REDACTED]`
- [ ] `docs/audit/flows/platform/onboarding.md` contains step table with screenshots

## Handoff
Phase 5e should implement the Markdown reporter + runbook, then wire `audit:report` to regenerate docs from the new artifacts.
