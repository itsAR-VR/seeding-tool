# Phase 3c — Implement platform bootstrap login + onboarding flow recorder

## Focus
Create a headed Playwright bootstrap that lets a human complete Google OAuth/SSO, then automatically records onboarding (including “sample data”) step-by-step and saves a reusable authenticated `storageState`.

## Inputs
- Phase 3a scaffold + Phase 3b capture primitives.
- Platform target: `https://platform.aha.inc`
- Login method: Google OAuth/SSO (manual completion).
- Onboarding requirement: choose sample data; finish at dashboard.

## Work
1. Build `audit:platform:bootstrap` runner:
   - launch headed browser to `/login` (or canonical entry route)
   - pause with clear console instructions for human login completion
2. Detect login success (heuristics):
   - URL no longer matches login routes AND/OR app shell appears AND/OR authenticated API calls succeed.
3. Record onboarding as a named flow:
   - start at `/onboarding` if redirected there, otherwise navigate to it
   - detect “sample data” option and select it when present
   - step loop: capture screenshots/DOM/a11y, extract form fields, record action taken, record observed API calls
   - end condition: reach dashboard (post-onboarding stable shell route)
4. Save auth state:
   - `.auth/platform.afterOnboarding.storageState.json`
   - (optional) `.auth/platform.storageState.json` for “pre-onboarding” if applicable
5. Write flow doc:
   - `docs/audit/flows/platform/onboarding.md` with step table and artifact links.

## Output
- `.auth/platform.afterOnboarding.storageState.json` (gitignored)
- `artifacts/<run-id>/platform/flows/onboarding/...` (step artifacts)
- `docs/audit/flows/platform/onboarding.md`

## Handoff
Phase 3d uses the saved `storageState` to crawl the authenticated IA and capture all reachable pages and core flows safely.

