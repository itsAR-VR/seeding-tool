# Phase 13e Cutover Results

## Status
- Deployment status: `[COMPLETE: live Phase 13 build verified on https://seed-scale.vercel.app]`
- Verification date: `2026-03-09`
- Target environment: `https://seed-scale.vercel.app`
- Tenant: `SleepKalm/ClubKalm`

## Automated checks
- [x] Local production build succeeds when sourcing the root `.env.local`
- [x] Marketing homepage shows no proof rail
- [x] Login succeeds
- [x] Logout succeeds
- [x] Onboarding discovery step renders grouped categories
- [x] Free-form daily target warning appears above 100
- [x] Automation creation succeeds
- [ ] Gmail primary sender shows `ar@soramedia.co`
- [ ] Shopify connection shows last sync status
- [x] Product picker shows sync / retry status
- [ ] Campaign product selection succeeds
- [x] Existing campaign creators no longer show the repeated `1,500,000` marketplace placeholder count

## Manual checks
- [ ] Gmail send test
- [ ] Shopify webhook event observed
- [ ] Scheduled automation fired within expected window

## External Follow-Ups
- Gmail is not connected on the current demo tenant, so sender visibility is `Not connected` and a live send test cannot be completed without Google OAuth on `ar@soramedia.co`.
- Shopify is not connected on the current demo tenant, so the product picker correctly surfaces the missing-credential state, but catalog sync and campaign product selection remain unavailable until a store domain + token are added.
- The onboarding-created discovery automation is scheduled and visible in Settings → Automations, but it was not observed firing within its next cron window during this session.

## Non-blocking issues
- Playwright generates local `apps/web/test-results/` artifacts during live checks; these are already ignored via `.gitignore`.
- The full repo lint now passes with warnings only; remaining warnings are unrelated to Phase 13 and include existing hook-dependency and `<img>` guidance warnings.
