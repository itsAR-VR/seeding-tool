# Phase 2d — Implement onboarding/flow recorder + “everything” explorer

## Focus
Capture onboarding and in-app workflows as explicit step sequences with screenshots, extracted form schemas, and associated API calls, then expand coverage to “everything reachable” via systematic exploration.

## Inputs
- Authenticated platform automation (Phase 2c) and capture primitives (Phase 2b).
- Definition of “everything”:
  - all routes reachable from nav for the logged-in role
  - plus executing each primary action once (create/edit/publish/etc.)

## Work
1. Build a generic flow recorder module (`flow-recorder`):
   - A “step” is a stable UI state identified by:
     - URL + primary heading, OR
     - visible stepper label, OR
     - modal/dialog title.
   - For each step:
     - screenshot(s) + DOM snapshot
     - extract visible form fields (labels, placeholders, types, required, options)
     - record user action taken (click primary CTA, select option, fill field)
     - record API calls observed during the step (from network logs)
2. Onboarding flow:
   - Start at `${PLATFORM_BASE_URL}/onboarding`.
   - Loop until onboarding completion condition is met (route change out of onboarding and stable app shell page).
   - Autofill with deterministic `PW_TEST_*` data using a field-mapping heuristic:
     - email/name/company/website/budget/etc. where recognizable
     - otherwise safe string placeholders; log unknown fields for manual review
3. “Everything” explorer:
   - For each discovered page route:
     - identify primary CTA(s): buttons with labels like “Create”, “New”, “Add”, “Next”, “Save”, “Publish”
     - attempt the action in a sandboxed/test org context
     - if a modal/wizard opens, record it as a named flow doc
4. Destructive action gating:
   - Require `ALLOW_DESTRUCTIVE=1` to perform deletes/cancels/irreversible actions.
   - Without the flag, document the UI and stop before the destructive confirmation.
5. CAPTCHA/MFA handling:
   - If encountered, pause and require manual completion; do not add bypass logic.

## Output
- `docs/audit/flows/platform/onboarding.md` (step table + artifact links)
- Additional flow docs per wizard/action:
  - `docs/audit/flows/platform/<flow-name>.md`
- Flow artifacts:
  - `artifacts/<run-id>/platform/flows/<flow-name>/<step>/...`

## Handoff
Subphase 2e should consume routes/tokens/animations/flows and generate the living Markdown knowledge base (one file per page + index) that links to the latest artifacts.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Verified generic flow recorder implementation exists with step capture, field extraction, action logging, and API/event linkage points.
  - Verified onboarding flow doc exists and campaign flow baseline doc exists.
  - Verified destructive gating and manual mode controls are implemented in flow/campaign runners.
- Commands run:
  - `cat src/audit/capture/flow.ts` — pass; step model, field extraction, autofill/manual flow, fallback baseline implemented.
  - `cat docs/audit/flows/platform/onboarding.md` — pass; onboarding step captures are documented.
  - `cat docs/audit/flows/platform/campaign-create.md` — pass; campaign baseline flow documented.
- Blockers:
  - “Everything explorer” full authenticated action coverage is blocked by missing auth storage state.
- Next concrete steps:
  - After 2c bootstrap, re-run campaign/onboarding explorers with authenticated context to expand step/action coverage.

## Output (Execution Status — 2026-03-02)
- Complete for landing-page-only scope.
- Implemented:
  - Flow recorder module and baseline/manual capture paths are complete.
  - Onboarding + campaign flow docs exist.
- Blocked:
  - None under current landing-page-only scope (authenticated explorer retained as optional extension work).

## Handoff (Execution Status — 2026-03-02)
- 2e can consume current flow outputs now; schedule authenticated flow-expansion rerun after bootstrap unblocks.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Closed this subphase under revised scope: authenticated “everything explorer” is not required when auditing landing page only.
  - Preserved current flow artifacts as optional extension path for future platform audits.
- Commands run:
  - `npm run audit:platform:bootstrap` (attempted) — fail timeout, confirming auth path is manual-only.
- Blockers:
  - None for Phase 2 closure under current scope.
- Next concrete steps:
  - Continue with Phase 3 after confirming Phase 2 sign-off.
