# Platform Auth Bootstrap

## Status
- Blocked pending manual OAuth completion in headed browser.

## Goal
- Create reusable Playwright storage states for authenticated platform crawling:
  - `.auth/platform.afterLogin.storageState.json`
  - `.auth/platform.afterOnboarding.storageState.json`

## Command
`RUN_ID=20260302-legacy LOGIN_TIMEOUT_MS=60000 ONBOARDING_MANUAL=1 FLOW_STEP_TIMEOUT_MS=60000 FLOW_MAX_STEPS=40 ALLOW_WRITES=1 npm run audit:platform:bootstrap`

## Manual Steps
1. Complete Google/OAuth login when browser opens.
2. If redirected to onboarding, proceed through onboarding screens.
3. Stop when app shell/dashboard is visible and onboarding is complete.
4. Close the browser window after script indicates state has been saved.

## Completion Checks
- `.auth/platform.afterLogin.storageState.json` exists.
- `.auth/platform.afterOnboarding.storageState.json` exists.
- `.auth/platform.afterOnboarding.meta.json` exists.
- `docs/audit/flows/platform/onboarding.md` is updated for the current run id.

## Follow-up
1. Run authenticated crawl:
   - `RUN_ID=20260302-legacy npm run audit:platform`
2. Run campaign flow capture:
   - `RUN_ID=20260302-legacy npm run audit:platform:campaign`
3. Refresh docs index/report:
   - `RUN_ID=20260302-legacy npm run audit:report`
