# Phase 1d — Implement onboarding/flow recorder + “everything” explorer

## Focus
Capture onboarding and in-app workflows as explicit step sequences with screenshots, extracted form schemas, and associated API calls, then expand coverage to “everything reachable” via systematic exploration.

## Inputs
- Authenticated platform automation (Phase 1c) and capture primitives (Phase 1b).
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
Subphase 1e should consume routes/tokens/animations/flows and generate the living Markdown knowledge base (one file per page + index) that links to the latest artifacts.

