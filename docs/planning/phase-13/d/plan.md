# Phase 13d — Connection Hardening and Approval-Prep Package

## Focus
Keep the current live Gmail/Shopify paths working for `ar@soramedia.co` and manual Shopify tokens, surface operator-visible failures, and generate reusable approval-prep docs without forcing a final public submission identity.

## Inputs
- Root phase contract: `docs/planning/phase-13/plan.md`
- Output from 13c: onboarding with ConnectStep that needs real handoff
- Current connection surfaces:
  - `apps/web/app/(platform)/settings/connections/page.tsx` (Gmail OAuth, Shopify manual token, Instagram OAuth, Unipile API key)
  - `apps/web/app/api/connections/shopify/route.ts` (POST connect, DELETE disconnect)
  - `apps/web/lib/shopify/products.ts` (`syncProducts()` — throws on failure, no timeout, no UI error surfacing)
  - `apps/web/lib/shopify/client.ts` (HTTP client for Shopify Admin API)
  - `apps/web/lib/shopify/webhooks.ts` (webhook handler)
  - `apps/web/app/api/webhooks/shopify/route.ts` (webhook route)
  - `apps/web/app/api/auth/gmail/route.ts` (initiate Gmail OAuth)
  - `apps/web/app/api/auth/gmail/callback/route.ts` (handle Gmail OAuth callback, persists EmailAlias)
  - `apps/web/components/product-picker.tsx` (no error state UI currently)
  - `apps/web/app/(platform)/campaigns/[campaignId]/products/page.tsx` (campaign product selection)
- Existing docs/env:
  - `apps/web/.env.example`
  - March 1 n8n audit/workflow docs
- Prisma: `EmailAlias` model (line 351) with `address`, `isPrimary`, `dailyLimit`

## Skills Available for This Subphase
- `find-local-skills` output: unavailable in this session; fallback is manual local-skill selection.
- `find-skills` output: unavailable in this session; fallback is installed-skill-only planning.
- Planned invocations:
  - `backend-development`
  - `javascript-typescript`
  - `react-dev`
  - `context7-docs`
  - `code-review`

## Work
1. **Replace the fake onboarding ConnectStep** in `apps/web/app/(platform)/onboarding/page.tsx`:
   - Remove the "Shopify integration coming soon!" toast behavior (lines 141-152)
   - ConnectStep should redirect to `/settings/connections` with a `?returnTo=/onboarding?step=done` param
   - Or: inline a summary of connection status (Gmail connected? Shopify connected?) with links to the full connections page
   - On "Continue" → navigate to done step regardless of connection status (connections can be completed later)
2. **Verify Gmail alias flow** for `ar@soramedia.co`:
   - Read `apps/web/app/api/auth/gmail/callback/route.ts` to confirm it creates/updates an `EmailAlias` record with `isPrimary: true`
   - Verify the connections page (`apps/web/app/(platform)/settings/connections/page.tsx`) shows the connected Gmail address from the `EmailAlias` record
   - Ensure reconnecting Gmail doesn't create duplicate aliases (upsert on `brandId + address`)
3. **Surface Shopify sync failures** in three locations:
   - **Settings → Connections:** Add a "Last sync" timestamp and error state banner to the Shopify card in `connections/page.tsx`. Fetch sync status from a new lightweight `GET /api/connections/shopify/status` endpoint (returns `{ connected, storeDomain, lastSyncAt, lastSyncError }`)
   - **Product picker** (`apps/web/components/product-picker.tsx`): Catch fetch errors, render an error banner with "Sync failed — try again" button. If products array is empty and Shopify is connected, show "No products synced yet — click to sync"
   - **Campaign products page** (`apps/web/app/(platform)/campaigns/[campaignId]/products/page.tsx`): Same error treatment as product picker
4. **Add sync timeout guard** to `apps/web/lib/shopify/products.ts`:
   - Add a max-pages limit (20 pages = 5000 products) to the pagination loop
   - Add a 30-second timeout wrapper around the full sync operation
   - If truncated, return `{ synced: N, truncated: true }` so UI can display "partial sync"
5. **Verify current Shopify sync path** — manually test against the connected SleepKalm store:
   - Trigger sync via connections page
   - Verify products appear in product picker
   - Verify variant data (price, SKU, inventory) is correct
6. **Produce approval-prep package** at `docs/approval-prep/`:
   - `docs/approval-prep/gmail-oauth-verification.md`:
     - Actual scopes (from `apps/web/app/api/auth/gmail/route.ts`)
     - Redirect URLs (from env config)
     - Required screenshots (placeholder paths)
     - Support/privacy/legal URLs → `[PLACEHOLDER: support URL]`, `[PLACEHOLDER: privacy policy URL]`
     - Unresolved identity: `[PLACEHOLDER: app name]`, `[PLACEHOLDER: company name]`, `[PLACEHOLDER: logo URL]`
   - `docs/approval-prep/shopify-app-review.md`:
     - App scopes and access patterns
     - Required screenshots
     - Same placeholder treatment for identity fields
     - Submission checklist with checkboxes

## Validation (RED TEAM)
- Onboarding ConnectStep navigates to connections page or shows real connection status
- Gmail connection shows `ar@soramedia.co` in connections page and outreach surfaces
- Shopify card in connections page shows last sync time and error state when applicable
- Product picker shows error banner when sync fails, retry button works
- `syncProducts()` terminates within 30s even on large catalogs
- Approval-prep docs exist at `docs/approval-prep/` with explicit `[PLACEHOLDER]` markers

## Assumptions / Open Questions (RED TEAM)
- **Assumption:** ConnectStep redirects to `/settings/connections` rather than inlining connection forms. This is simpler and avoids duplicating the connections page UI. (confidence ~90%)
  - Why it matters: Inlining would require copying form logic and state management from the connections page.
  - Current default: Redirect with return-to param.

## Output
- Gmail callback now upserts aliases and makes the newest connected Gmail address primary for the brand
- Connections UI now reads the primary alias for Gmail display and shows Shopify last-sync / error state with retry sync action
- Shopify sync status now persists on `BrandConnection.metadata`, with a dedicated `/api/connections/shopify/status` route
- `syncProducts()` now enforces a 30-second timeout plus a 20-page cap and reports partial sync state without deleting stale products on truncated runs
- Approval-prep docs created at `docs/approval-prep/gmail-oauth-verification.md` and `docs/approval-prep/shopify-app-review.md`

## Handoff
13e should run production QA against the exact flows hardened here: Gmail sender path on `ar@soramedia.co`, manual Shopify connection, product sync with error surfacing, onboarding handoff through connections, and automation creation.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Hardened Gmail reconnect handling so alias writes are deterministic and the newest connected sender becomes primary.
  - Updated the connections surface to use the primary alias for Gmail display.
  - Added Shopify sync-status persistence, a status endpoint, timeout/page-cap guards, and retry/status UI in connections plus product-selection surfaces.
  - Added approval-prep docs with actual Gmail scopes, webhook topics, and explicit public-identity placeholders.
  - Tightened inbox draft sending to prefer the primary alias instead of the first alias row.
- Commands run:
  - `npx eslint ...` on 13d files — pass with 1 pre-existing warning in `components/product-picker.tsx` for `<img>`
  - `npm run build` — fail after compile/typecheck; current env/runtime blocker remains `DATABASE_URL is required` during page-data collection
- Blockers:
  - Manual Shopify verification against the live SleepKalm store was not run in this turn.
  - Production/live QA still needs a deploy target plus live credentials/env.
- Next concrete steps:
  - Use the production-cutover scaffold in 13e once deploy context and live credentials are available.
  - Verify the Gmail sender path and Shopify sync path on the live tenant rather than only through local code inspection.
