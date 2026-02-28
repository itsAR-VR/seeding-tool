# Phase 4g — Capture campaign creation flow + expand platform catalog

## Focus
Add a manual, step-by-step campaign creation flow recorder and run it to capture full copy/screens for the platform UI.

## Inputs
- Existing platform auth bootstrap + flow recorder:
  - `src/audit/runners/platform-bootstrap.ts`
  - `src/audit/capture/flow.ts`
- Existing platform audit runner:
  - `src/audit/runners/platform.ts`
- Existing flow docs: `docs/audit/flows/platform/onboarding.md`

## Work
1. Implement a dedicated campaign flow runner:
   - `src/audit/runners/platform-campaign.ts`
   - Use existing storage state (`.auth/platform.afterOnboarding.storageState.json` or fallback to `.auth/platform.afterLogin.storageState.json`)
   - Open `/campaign`, then record manual steps via `recordFlow`
   - Write flow doc to `docs/audit/flows/platform/campaign-create.md`
2. Add a CLI entry:
   - `npm run audit:platform:campaign`
3. Execute the campaign flow capture (headed, manual):
   - `LOGIN_TIMEOUT_MS=60000 ONBOARDING_MANUAL=1 FLOW_STEP_TIMEOUT_MS=60000 FLOW_MAX_STEPS=40 ALLOW_WRITES=1 npm run audit:platform:campaign`
   - Manually proceed through the full campaign flow; keep sample data where possible
4. Expand platform catalog after flow capture:
   - Run `npm run audit:platform` with `MAX_ROUTES` increased (e.g., 25–50)
   - Verify new routes and artifacts under `artifacts/<run-id>/platform/`

## Output
- `src/audit/runners/platform-campaign.ts`
- `docs/audit/flows/platform/campaign-create.md`
- Campaign flow artifacts under `artifacts/<run-id>/platform/flows/campaign-create/`
- Updated platform route inventory for the run

## Validation (RED TEAM)
- `npm run audit:platform:campaign` writes `docs/audit/flows/platform/campaign-create.md` with ≥5 steps
- Campaign flow steps include screenshots + DOM snapshots for each step folder
- `npm run audit:platform` writes `artifacts/<run-id>/platform/routes.json` with additional app routes beyond `home|campaign|report`

## Assumptions / Open Questions (RED TEAM)
- What are the must-cover dashboard sections for the “complete catalog”? (confidence <90%)
  - Why it matters: determines whether we add deep-link seeds or nav exploration.
  - Current default: capture campaign flow + core routes and extend only via discovered anchors.

## Handoff
If catalog coverage remains thin, add targeted manual navigation seeds (deep links) for the runner and re-run platform audit.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Added a dedicated campaign flow runner and CLI entry.
  - Attempted manual campaign flow capture (recorded only step 1 twice; user did not advance within timeout).
  - Re-ran platform audit with higher `MAX_ROUTES` (still 6 routes captured).
- Commands run:
  - `RUN_ID=20260204-120710 LOGIN_TIMEOUT_MS=60000 ONBOARDING_MANUAL=1 FLOW_STEP_TIMEOUT_MS=60000 FLOW_MAX_STEPS=60 ALLOW_WRITES=1 npm run audit:platform:campaign` — **PASS** (recorded 1 step)
  - `RUN_ID=20260204-120710 LOGIN_TIMEOUT_MS=60000 ONBOARDING_MANUAL=1 FLOW_STEP_TIMEOUT_MS=60000 FLOW_MAX_STEPS=60 ALLOW_WRITES=1 npm run audit:platform:campaign` — **PASS** (recorded 1 step)
  - `RUN_ID=20260204-120710 MAX_ROUTES=50 CAPTURE_MODE=both HEADLESS=1 npm run audit:platform` — **PASS** (routes: 6)
- Blockers:
  - Campaign flow cannot complete without manual navigation through each step → user must proceed through the create flow while the script waits.
- Next concrete steps:
  - Re-run `audit:platform:campaign` and complete the full flow in the browser (sample data preferred).
  - If route inventory remains thin, seed additional deep links for discovery and re-run `audit:platform`.
