# Phase 13e — Production Deploy and Live SleepKalm Verification

## Focus
Deploy the stabilized platform to production and verify the live `SleepKalm/ClubKalm` tenant with authenticated Playwright plus manual operator checks.

## Inputs
- Root phase contract: `docs/planning/phase-13/plan.md`
- Completed outputs from 13a-13d
- Production verification target:
  - tenant: `SleepKalm/ClubKalm`
  - Gmail path: `ar@soramedia.co`
  - Shopify path: current manual token connection

## Skills Available for This Subphase
- `find-local-skills` output: unavailable in this session; fallback is manual local-skill selection.
- `find-skills` output: unavailable in this session; fallback is installed-skill-only planning.
- Planned invocations:
  - `playwright-testing`
  - `qa-test-planner`
  - `javascript-typescript`
  - `code-review`

## Work
1. **Pre-deploy checklist:**
   - All Phase 13a-d changes committed and merged to `main`
   - `npm run build` succeeds locally
   - Existing tests pass: `npm run test` (if configured) and marketing Playwright tests
   - Environment variables for production are set (check `.env.example` for any new vars added in 13a-d)
2. **Deploy to production:**
   - Use the project's standard deploy process (Fly.io / Vercel — check `fly.toml` or `vercel.json`)
   - Verify deployment health check passes
   - Verify the deployed build hash matches the expected commit
3. **Set up authenticated Playwright for production:**
   - Add `E2E_EMAIL` and `E2E_PASSWORD` env vars (use the `ar@soramedia.co` test account)
   - In Playwright `beforeAll`: call Supabase `signInWithPassword` via the deployed app's API or use the login page directly
   - Store auth state (cookies) and reuse across test specs
   - **Test file:** Create `tests/production-cutover.spec.ts` (separate from dev tests)
4. **Required production verification flows** (each is a Playwright test case):
   - **Login:** Navigate to `/login`, authenticate, verify redirect to `/dashboard`
   - **Logout:** Click sidebar logout button, verify redirect to `/login`, verify session cleared
   - **Onboarding/discovery setup:** Navigate to `/onboarding`, complete brand step, verify discovery step shows grouped category autocomplete
   - **Category autocomplete:** In discovery step, verify both Apify and Collabstr sections render, select one from each group
   - **Free-form daily target:** Enter `200`, verify warning appears but save succeeds; enter `50`, verify no warning
   - **Automation creation:** Complete onboarding, verify automation appears in Settings → Automations
   - **Gmail sender visibility:** Navigate to Settings → Connections, verify `ar@soramedia.co` shows as connected
   - **Shopify connect state:** Verify Shopify card shows connected store domain and last sync time
   - **Shopify product sync:** Trigger sync, verify products appear in product picker
   - **Campaign product selection:** Navigate to a campaign, select products from picker
   - **Creator/campaign Instagram links:** Verify `InstagramHandleLink` renders clickable links on creator and campaign pages
   - **Marketing logo cleanup:** Navigate to `/`, verify no `.proof-rail` section exists
   - **No placeholder follower counts:** On creators page, verify follower counts are real numbers or `—`
5. **Manual-only checks** (document results in summary):
   - Gmail send test: compose and send a test outreach email from the platform
   - Shopify webhook: verify product update webhook fires on store product change
   - Inngest automation run: verify a scheduled automation fires within its cron window
6. **Capture evidence:**
   - Playwright HTML report saved to `tests/production-cutover-report/`
   - Screenshots for each verification flow
   - Explicit pass/fail checklist in `docs/planning/phase-13/e/cutover-results.md`
7. **Classify remaining issues:**
   - **Blocker:** Prevents demo or breaks core flow → must fix before demo
   - **Non-blocking:** Cosmetic, edge-case, or deferrable → document for next phase

## Validation (RED TEAM)
- `tests/production-cutover.spec.ts` exists and covers all 14 flows listed above
- Playwright report shows pass/fail for each test case
- `cutover-results.md` has explicit pass/fail with blocker classification
- No test uses hardcoded credentials in source (env vars only)

## Output
- Production deployment completed and health-checked
- `tests/production-cutover.spec.ts` — authenticated production Playwright suite
- `tests/production-cutover-report/` — HTML report with screenshots
- `docs/planning/phase-13/e/cutover-results.md` — pass/fail checklist with blocker classification
- Authenticated live verification evidence for `SleepKalm/ClubKalm`

## Handoff
If the live cutover passes, Phase 13 closes. If it does not, the next phase must be scoped only around the concrete remaining blockers surfaced in `cutover-results.md`.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Added a guarded production-cutover Playwright scaffold at `apps/web/e2e/production-cutover.spec.ts`.
  - Added `docs/planning/phase-13/e/cutover-results.md` as the live pass/fail checklist template.
  - Ran deployment/live-QA preflight checks for repo deployment config and required env presence without exposing secret values.
- Commands run:
  - `ls -1 fly.toml vercel.json` — pass; no explicit deploy config files present at repo root
  - non-secret env presence check for `NEXT_PUBLIC_APP_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, `DATABASE_URL` — fail; none detected in `apps/web/.env.local`
  - `npx eslint ... e2e/production-cutover.spec.ts` — pass with 1 pre-existing warning in `components/product-picker.tsx`
- Additional implementation completed after this preflight:
  - Added `E2E_EMAIL` and `E2E_PASSWORD` placeholders to `apps/web/.env.example`
  - Confirmed local Vercel linkage exists at `.vercel/project.json`
  - Confirmed `npm run build` passes when sourcing the actual root `.env.local`
  - Ran the live marketing cutover check against `NEXT_PUBLIC_APP_URL`; it failed because the deployed app still serves the old build with `.proof-rail` present
  - Pushed `main` to origin at commit `f973875 feat: stabilize demo platform for phase 13`
- Blockers:
  - No production QA credentials in local env (`E2E_EMAIL` / `E2E_PASSWORD` still missing).
  - The deployed production app has not picked up the Phase 13 changes yet; live marketing verification still sees `.proof-rail`.
  - Vercel CLI deployment inspection is blocked on this machine with `Error: Not authorized`.
- Next concrete steps:
  - Wait for or investigate the deployment attached to `https://seed-scale.vercel.app`.
  - Re-run the marketing live check after deploy completes and confirm `.proof-rail` is gone.
  - Provide or wire the live QA env needed for authenticated Playwright (`E2E_EMAIL`, `E2E_PASSWORD`) to finish the authenticated production cutover suite.
