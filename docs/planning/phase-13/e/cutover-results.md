# Phase 13e Cutover Results

## Status
- Deployment status: `[BLOCKED: pushed to main, production URL still serving previous build]`
- Verification date: `2026-03-09`
- Target environment: `https://seed-scale.vercel.app`
- Tenant: `SleepKalm/ClubKalm`

## Automated checks
- [x] Local production build succeeds when sourcing the root `.env.local`
- [ ] Marketing homepage shows no proof rail
- [ ] Login succeeds
- [ ] Logout succeeds
- [ ] Onboarding discovery step renders grouped categories
- [ ] Free-form daily target warning appears above 100
- [ ] Automation creation succeeds
- [ ] Gmail primary sender shows `ar@soramedia.co`
- [ ] Shopify connection shows last sync status
- [ ] Product picker shows sync / retry status
- [ ] Campaign product selection succeeds

## Manual checks
- [ ] Gmail send test
- [ ] Shopify webhook event observed
- [ ] Scheduled automation fired within expected window

## Blockers
- `main` was pushed at commit `f973875`, but `https://seed-scale.vercel.app` still shows `.proof-rail`, so the production URL has not picked up the new build yet.
- Vercel CLI inspection from this machine is blocked with `Error: Not authorized`, so deployment status cannot be queried directly here.
- `E2E_EMAIL` and `E2E_PASSWORD` are still missing locally, so authenticated production Playwright checks remain blocked.

## Non-blocking issues
- Playwright generates local `apps/web/test-results/` artifacts during live checks; these are now ignored via `.gitignore`.
