# Phase 13 — SleepKalm Demo Stabilization and Production Cutover

## Original User Request (verbatim)
build a $phase-plan

## Purpose
Stabilize the existing Seed Scale platform for the live `SleepKalm/ClubKalm` demo tenant, close the highest-friction UI/integration gaps, and ship a production cutover that works with the current `ar@soramedia.co` Gmail path and the existing manual Shopify connection flow.

## Context
- The repo already contains the core platform runtime in `apps/web`: protected platform routes, creator search, campaign flows, Gmail connect/send, Shopify connect/sync, onboarding scaffolding, product selection, and email alias models.
- The requested work is not a platform bootstrap. It is a targeted stabilization pass over current behavior:
  - add a real logout path,
  - replace capped automation/search volume controls with free-form numeric inputs,
  - remove placeholder/example marketing proof,
  - harden Shopify sync and onboarding handoff,
  - improve creator data quality and link consistency,
  - wire category autofill from the real upstream category sources.
- `ar@soramedia.co` remains the active working sender/account for this phase. Swapping to a shared team email is explicitly out of the critical path.
- The live production verification target is the current demo brand: `SleepKalm/ClubKalm`.
- Category autofill must be source-aware:
  - **Primary:** Apify category inputs reconstructed from the March 1 n8n audit/workflow material in `docs/n8n-audit-2026-03-01/**`.
  - **Secondary:** Collabstr-derived categories used for the creator database layer.
  - Operators must be able to select from both sources at the same time, with grouped autocomplete.
- Approval work for Gmail and Shopify is part of this phase only as preparation/docs. Final public submission identity stays unresolved and should remain placeholderized in the generated approval package.
- Repo reality before implementation:
  - current branch is `main`,
  - worktree is clean,
  - `main` is behind `origin/main` by one docs-only commit: `681138c docs(fly): add deploy status and blocker notes for creator-search worker`.
  - Phase execution should fast-forward to `origin/main` before code changes so release work starts from the latest documented state.

## Skills Available for Implementation
- `find-local-skills`: not exposed as an invokable tool in this session. Fallback: manual selection from the installed skill catalog already present in the environment.
- `find-skills`: not exposed as an invokable tool in this session. Fallback: plan only with confirmed local skills already available in-session.
- Selected implementable skills:
  - `javascript-typescript`
  - `react-dev`
  - `backend-development`
  - `playwright-testing`
  - `context7-docs`
  - `qa-test-planner`
  - `code-review`
  - `frontend-design`

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 9 | Historical platform build plan with stale repo assumptions | Onboarding, settings, creators, connections, campaigns | Treat current code/schema as source of truth; do not reuse Phase 9 repo-state assumptions verbatim. |
| Phase 11 | Historical hero/media work | Marketing shell/tests/screenshots | Only touch marketing where needed for example-logo removal and release verification; preserve current hero behavior. |
| Phase 12 | Historical hero follow-up with conflicting status notes | Marketing homepage structure and hero Playwright coverage | Do not plan against Phase 12 checkboxes; use current branch code and tests as truth. |
| Phase landing-redesign | Separate stale redesign track | Marketing homepage visuals | Read-only reference only; do not let it reopen marketing redesign scope during this stabilization phase. |

## Objectives
* [x] Fast-forward the branch baseline, add logout, and remove leftover placeholder/example marketing proof.
* [x] Build a source-aware category catalog with separate Apify and Collabstr groups, then use it for grouped autocomplete and multi-source category selection.
* [x] Rework onboarding and automations so brands can set a free-form daily creator target, select grouped categories, and auto-create an enabled discovery automation.
* [x] Harden Gmail/Shopify connection flows around the current `ar@soramedia.co` path and surface Shopify sync failures where operators actually work.
* [ ] Ship a production deploy and verify the live `SleepKalm/ClubKalm` path with authenticated Playwright plus manual operator checks.

## Constraints
- Fast-forward `main` to `origin/main` before implementation; the remote delta is docs-only and should not be deferred.
- `ar@soramedia.co` stays as the active Gmail alias and approval/test-user path for this phase.
- Shared-team-email migration is out of scope.
- Inbox manager / multi-sender rotation is out of scope. The existing `EmailAlias` model remains single-active-sender in practice for this phase.
- Apify categories are the primary operator-facing category source. Collabstr categories remain secondary and visibly separated.
- Category source-of-truth material comes from `docs/n8n-audit-2026-03-01/**` and March 1 legacy workflow docs, not from a fake hardcoded shortlist.
- Daily creator targets and similar limits must become free-form positive integers. No hard cap. Values over 100 should warn but still save.
- Manual Shopify token connect remains the live production path in this phase. Public/self-serve Shopify OAuth is deferred.
- Gmail and Shopify approval work ends at a reusable documentation package. Final reviewer-facing product/company identity remains unresolved and must stay as explicit placeholders.
- Production verification must include authenticated Playwright against the live app for the `SleepKalm/ClubKalm` tenant.
- Respect the current clean worktree and do not reopen broad marketing redesign scope.

## Success Criteria
- [x] `main` is fast-forwarded to `origin/main` before feature work starts.
- [x] Platform shell exposes a working logout control and session-termination path.
- [x] Marketing homepage no longer renders example logos.
- [x] Category autocomplete supports grouped `Apify` and `Collabstr` sections, and operators can select categories from both groups in one flow.
- [x] Onboarding creates a live discovery automation using the selected category set and free-form daily target.
- [x] Automation/search volume controls no longer use capped sliders or capped dropdowns.
- [x] Creator import/search flows persist richer result data, and verified platform surfaces show real follower counts or `—`, never placeholder counts.
- [x] Shopify connect/sync failures are visible in settings and product-selection workflows.
- Production deploy is completed and the live `SleepKalm/ClubKalm` flow is verified with authenticated Playwright and operator evidence.
- [x] Approval-prep docs exist for Gmail and Shopify with placeholders clearly marked for unresolved public identity fields.

## Repo Reality Check (RED TEAM)

- What exists today:
  - `apps/web/app/(platform)/layout.tsx` — server component, sidebar nav with 7 items, auth guard via `createClient()`, **no logout control**
  - `apps/web/app/(platform)/onboarding/page.tsx` — 3-step wizard (brand → connect → done); ConnectStep is fake ("Shopify integration coming soon!")
  - `apps/web/app/(platform)/settings/automations/page.tsx` — CRUD with range slider `min=10 max=100 step=10` for limit, schedule dropdown (4 presets)
  - `apps/web/app/api/automations/route.ts` — POST validates schedule against `["every_6h","every_12h","daily","weekly"]`; config is untyped JSON blob
  - `apps/web/lib/inngest/functions/run-automation.ts` — cron every 5 min, dispatches `creator-search/requested` Inngest events; `computeNextRunAt` is **duplicated** here and in the API route
  - `apps/web/app/(marketing)/components/HomeContent.tsx` — `logoRail` array with 9 brand logos, rendered in `.proof-rail` section with `.brand-band-track` marquee
  - `apps/web/app/(platform)/settings/connections/page.tsx` — Gmail (OAuth), Shopify (manual token), Instagram (OAuth), Unipile (API key); no sync status display
  - `apps/web/lib/shopify/products.ts` — `syncProducts()` throws on failure; no UI error surfacing; `getProducts()` returns flat products
  - `apps/web/components/product-picker.tsx` — no sync failure indicator
  - `apps/web/lib/brands/icp.ts` — `deriveBrandICP()` + `icpToSearchHints()` exist; extracts niche/targetAudience from `brandProfile` JSON
  - `apps/web/components/instagram-handle-link.tsx` — single profile-link renderer, used in 4 platform pages
  - Prisma schema: `Creator` model has `bioCategory` (line 473), `followerCount`, `avgViews`; `CreatorSearchResult` has `followerCount`, `engagementRate`, `profileUrl`, `imageUrl`, `bio` but **no `bioCategory`**; `Automation` model has `config Json`; `EmailAlias` model has `dailyLimit` default 50
  - `docs/n8n-audit-2026-03-01/workflow-node-audit.md` — documents 68-node workflow with nodes #20-22 ("Category Bio", "Parse Category", "Category Bio ?") showing Apify category pipeline
  - No `/api/auth/logout` route exists; no `/api/categories` endpoint exists; no `/api/onboarding/automation` route exists
- What the plan assumes:
  - Logout needs a server-side route — **CORRECT** for SSR/RSC apps with Supabase (cookies must be cleared server-side)
  - Logo rail is "example/placeholder" proof — **CORRECT** (9 logos are aspirational, not real customers)
  - Category sources live in n8n audit docs — **CORRECT** (workflow-node-audit.md nodes #20-22 confirm Apify category pipeline)
  - `CreatorSearchResult` stores rich data — **PARTIALLY CORRECT** (has most fields but missing `bioCategory`)
  - Onboarding ConnectStep connects to Shopify — **INCORRECT** (it's currently a fake toast, not a real handoff)
- Verified touch points:
  - `apps/web/app/(platform)/layout.tsx:22` — `supabase.auth.getUser()` auth guard
  - `apps/web/app/(platform)/settings/automations/page.tsx:388-396` — range slider `min=10 max=100`
  - `apps/web/app/api/automations/route.ts:121` — `validSchedules` array hardcoded
  - `apps/web/lib/inngest/functions/run-automation.ts:37` — `{ cron: "*/5 * * * *" }`
  - `apps/web/app/(marketing)/components/HomeContent.tsx:10-20` — `logoRail` constant
  - `apps/web/app/(marketing)/components/HomeContent.tsx:162` — `.proof-rail` section
  - `apps/web/prisma/schema.prisma:455-485` — `Creator` model with `bioCategory`
  - `apps/web/prisma/schema.prisma:576-600` — `CreatorSearchResult` model (no `bioCategory`)
  - `apps/web/prisma/schema.prisma:951-970` — `Automation` model with `config Json`
  - `apps/web/prisma/schema.prisma:351-371` — `EmailAlias` model
  - `apps/web/app/api/onboarding/brand/route.ts` — creates Brand + BrandOnboarding + BrandSettings + BrandMembership in transaction

## Skill Feasibility (RED TEAM)

- Critical skill check:
  - `find-local-skills` → **missing** (path `/home/podhi/...` does not exist in this env); fallback: manual skill selection from in-session catalog
  - `find-skills` → **missing** (Vercel-hosted service); fallback: plan with installed skills only
  - `javascript-typescript` → **available**
  - `react-dev` → **available**
  - `backend-development` → **available**
  - `playwright-testing` → **available**
  - `context7-docs` → **available** (MCP server registered)
  - `qa-test-planner` → **available**
  - `code-review` → **available**
  - `frontend-design` → **available**
- Missing but required:
  - None — all implementation skills are locally available

## RED TEAM Findings (Gaps / Weak Spots)

### Highest-risk failure modes

1. **`computeNextRunAt` is duplicated** in `apps/web/app/api/automations/route.ts:10-24` and `apps/web/lib/inngest/functions/run-automation.ts:7-21`. If 13c changes schedule behavior in one place, the other will drift.
   → **Mitigation:** Extract to `apps/web/lib/automations/schedule.ts` during 13c; import in both files.

2. **Server-side schedule validation blocks free-form limits** — `POST /api/automations` validates `body.schedule` against a hardcoded 4-item list (line 121-127). If daily creator target replaces or supplements schedule, the API validation will reject unknown values.
   → **Mitigation:** 13c must update `validSchedules` or decouple `dailyTarget` from `schedule` (recommended: keep schedule presets, add separate `dailyTarget` field to config JSON).

3. **Existing automations have no categories in config** — when 13c adds grouped categories to the automation config shape, existing automation rows will have `config.categories = undefined`. Runner must handle this gracefully.
   → **Mitigation:** Add fallback in `run-automation.ts`: if `config.categories` is absent, fall back to keyword/hashtag search behavior (current behavior). Add this as an explicit step in 13c.

4. **Onboarding ConnectStep is fake** — the plan says "replace fake onboarding Shopify step with real handoff to existing connections flow" (13d) but the ConnectStep currently shows "Shopify integration coming soon!" with a toast. This is in onboarding, not in connections page.
   → **Mitigation:** 13c or 13d must decide: does ConnectStep redirect to `/settings/connections`, or does it inline real connection UI? Scope this explicitly.

5. **No API endpoint for categories** — Plan 13b mentions "Add a category endpoint that returns grouped results" but doesn't specify the path.
   → **Mitigation:** Define concrete path: `GET /api/categories` returning `{ apify: string[], collabstr: string[] }`. Add to 13b work items.

### Missing or ambiguous requirements

6. **`CreatorSearchResult` lacks `bioCategory`** — Prisma model `CreatorSearchResult` doesn't have it. The `Creator` model does (line 473).
   → **Fix (DECIDED):** Add `bioCategory String?` to `CreatorSearchResult` in schema (after line 586) + migration. Also populate on `Creator` during import. Stores category earlier in pipeline.

7. **Plan 13a says "add `POST /api/auth/logout`"** but doesn't specify cookie/session cleanup mechanics. Supabase SSR auth uses cookies managed by `@supabase/ssr`.
   → **Fix:** The route must call `supabase.auth.signOut()` server-side (clears cookies via the server client), then redirect to `/login`. Add this specificity to 13a.

8. **Plan 13c step 5 says "POST /api/onboarding/automation"** — this is a new route. It should reuse the existing `POST /api/automations` logic (especially `computeNextRunAt`), not duplicate it.
   → **Fix:** Either (a) `POST /api/onboarding/automation` calls the existing automation creation internally, or (b) the onboarding UI directly calls `POST /api/automations` with the right payload. Option (b) is simpler and avoids duplication.

9. **Plan 13d mentions "surface Shopify sync failures in product picker"** but `product-picker.tsx` currently has no error state UI. Needs concrete component change specification.
   → **Fix:** Add explicit step: catch sync errors in `product-picker.tsx` fetch, render error banner with retry button.

### Repo mismatches (fix the plan)

10. **Plan 13b references "creator search job routes"** generically — actual paths are:
    - `apps/web/app/api/creators/search/route.ts`
    - `apps/web/app/api/creators/search/[jobId]/route.ts`
    - `apps/web/app/api/campaigns/[campaignId]/search/route.ts`
    - Worker: `apps/web/lib/workers/creator-search.ts`
    → **Fix:** Add these concrete paths to 13b inputs.

11. **Plan 13b references "creator import route"** generically — actual path: `apps/web/app/api/creators/import/route.ts`
    → **Fix:** Add to 13b inputs.

12. **Plan 13d references "Shopify connect/sync APIs"** generically — actual paths:
    - `apps/web/app/api/connections/shopify/route.ts` (connect/disconnect)
    - `apps/web/lib/shopify/products.ts` (sync logic)
    - `apps/web/lib/shopify/client.ts` (HTTP client)
    - `apps/web/lib/shopify/webhooks.ts` (webhook handler)
    - `apps/web/app/api/webhooks/shopify/route.ts` (webhook route)
    → **Fix:** Add to 13d inputs.

13. **Plan 13d references "Gmail connect/callback flow"** generically — actual paths:
    - `apps/web/app/api/auth/gmail/route.ts` (initiate OAuth)
    - `apps/web/app/api/auth/gmail/callback/route.ts` (handle callback)
    → **Fix:** Add to 13d inputs.

### Performance / timeouts

14. **Category extraction from n8n JSON files** — the workflow JSON files are large (Draft-Order-Maker.json is 3.7MB). Category extraction should be a build-time/seed-time operation, not a runtime API call.
    → **Mitigation:** Extract categories once and persist them as a static catalog file or seed them into the DB. Don't parse workflow JSONs on every API request.

15. **Shopify product sync has no timeout** — `syncProducts()` paginates Shopify's full catalog without a timeout. For large stores, this could hang.
    → **Mitigation:** Add a timeout (30s) and max-pages guard (20 pages = 5000 products) to `syncProducts()`. Surface partial-sync status if truncated.

### Security / permissions

16. **`POST /api/onboarding/automation` (if created) must enforce brand ownership** — it should use the same `getUserBySupabaseId` + `brandMembership` pattern as the existing automation routes.
    → **Mitigation:** Add auth pattern to 13c work item explicitly, or use `POST /api/automations` directly (which already has auth).

### Testing / validation

17. **Plan 13e says "authenticated Playwright against the live app"** but doesn't specify how to handle auth tokens/cookies for production.
    → **Mitigation:** Specify: use Supabase `signInWithPassword` in Playwright `beforeAll`, store auth state, reuse across tests. Add env vars `E2E_EMAIL` and `E2E_PASSWORD` to `.env.example`.

18. **No test coverage specified for category autocomplete** — this is new UI behavior. Needs at least a smoke test.
    → **Mitigation:** Add Playwright test: verify grouped category dropdown renders with both sections and selection persists.

19. **No rollback strategy** — if category catalog changes break existing automation behavior, there's no documented path to revert.
    → **Mitigation:** Since automation config is a JSON blob, old automations without categories continue working (runner falls back to keyword search). Document this explicitly as the rollback guarantee.

## Assumptions (Agent)

- **Assumption:** `dailyTarget` should be stored as a field in the automation `config` JSON blob (alongside existing `limit`), not as a separate Prisma column. (confidence ~92%)
  - Mitigation: If a dedicated column is needed later, a migration adds it; config JSON is the lowest-friction path for this stabilization phase.

- **Assumption:** The category catalog should be a static TypeScript file (`lib/categories/catalog.ts`) seeded from the n8n audit docs, not a database table. (confidence ~88%)
  - Mitigation: If dynamic category management is needed later, migrate to a DB-backed catalog. For this phase, static extraction from the March 1 audit is sufficient.

- **Assumption:** Logout should redirect to `/login`, not `/` (marketing homepage). (confidence ~95%)
  - Mitigation: Easy to change the redirect target if the user prefers `/`.

- **Assumption:** The onboarding discovery-setup step replaces the existing ConnectStep position (step 2), pushing connections to step 3. The new flow would be: brand → discovery setup → connections → done (4 steps). (confidence ~85%)
  - Mitigation: If the user wants a different step ordering, adjust the progress indicator and routing in `onboarding/page.tsx`.

## Open Questions (Need Human Input)

- [x] **Should onboarding call `POST /api/automations` directly or use a dedicated route?** → **DECIDED: Reuse existing endpoint.** Direct call, no duplication.

- [x] **Where should extracted Apify categories live?** → **DECIDED: Static TypeScript file** at `apps/web/lib/categories/catalog.ts`.

- [x] **Should `CreatorSearchResult` gain a `bioCategory` column?** → **DECIDED: Yes, add to both models.** Migration required. Stores category earlier in pipeline at search time.

## Subphase Index
* a — Sync release posture, add logout, and remove placeholder marketing proof
* b — Build the source-aware category catalog and harden creator data surfaces
* c — Rework onboarding and automations around grouped categories and free-form daily targets
* d — Harden Gmail/Shopify connection flows and produce approval-prep docs
* e — Deploy to production and verify the live SleepKalm cutover with authenticated QA

## Phase Summary (running)
- 2026-03-09 13:20:09 EDT — Completed 13a: fast-forwarded `main`, added `POST /api/auth/logout`, added sidebar logout form, and removed the example-logo proof rail from the marketing homepage (files: `apps/web/app/api/auth/logout/route.ts`, `apps/web/app/(platform)/layout.tsx`, `apps/web/app/(marketing)/components/HomeContent.tsx`, `apps/web/app/globals.css`).
- 2026-03-09 13:20:09 EDT — Validation found unrelated repo blockers outside 13a scope: repo-wide lint still fails on `apps/web/lib/brands/icp.ts`, and `next build` still fails on `apps/web/app/api/billing/balance/route.ts`.
- 2026-03-09 13:20:09 EDT — Completed 13b implementation: added grouped category catalog + `/api/categories`, added `CreatorSearchResult.bioCategory`, carried richer creator import/search fields, and updated profile-link surfaces to prefer persisted URLs (files: `apps/web/lib/categories/catalog.ts`, `apps/web/app/api/categories/route.ts`, `apps/web/prisma/schema.prisma`, `apps/web/app/api/creators/import/route.ts`, `apps/web/app/api/creators/search/[jobId]/route.ts`, `apps/web/lib/apify/client.ts`, `apps/web/lib/inngest/functions/apify-creator-search.ts`, `apps/web/lib/workers/creator-search.ts`, `apps/web/app/(platform)/creators/page.tsx`, `apps/web/app/(platform)/campaigns/[campaignId]/import/page.tsx`, `apps/web/app/(platform)/campaigns/[campaignId]/review/page.tsx`).
- 2026-03-09 13:20:09 EDT — 13b validation passed on targeted lint + Prisma generate; full `next build` is now blocked by environment/runtime collection for `/api/auth/gmail/callback` (`DATABASE_URL is required`), and the committed Collabstr JSONL dataset is still absent so the secondary category group uses a documented fallback list.
- 2026-03-09 13:20:09 EDT — Completed 13c implementation: shared schedule helper, 4-step onboarding with grouped category selection, automation creation from onboarding, free-form integer limits in onboarding/settings/search, and grouped category display on automations (files: `apps/web/lib/automations/schedule.ts`, `apps/web/components/grouped-category-picker.tsx`, `apps/web/app/(platform)/onboarding/page.tsx`, `apps/web/app/(platform)/settings/automations/page.tsx`, `apps/web/app/(platform)/creators/page.tsx`, `apps/web/app/api/automations/route.ts`, `apps/web/app/api/automations/[id]/route.ts`, `apps/web/lib/inngest/functions/run-automation.ts`).
- 2026-03-09 13:20:09 EDT — 13c targeted lint passed aside from a pre-existing `<img>` warning in creators search UI; full `next build` still stops at runtime env collection with `DATABASE_URL is required`, now surfacing through `/api/ai-personas/[personaId]`.
- 2026-03-09 13:20:09 EDT — Completed 13d implementation: Gmail alias primacy fix, Shopify sync-status persistence + status route, retry/error UI in connections and product selection, timeout/page-cap guard in product sync, and approval-prep docs (files: `apps/web/app/api/auth/gmail/callback/route.ts`, `apps/web/app/(platform)/settings/connections/page.tsx`, `apps/web/app/api/connections/shopify/route.ts`, `apps/web/app/api/connections/shopify/status/route.ts`, `apps/web/app/api/products/sync/route.ts`, `apps/web/lib/shopify/products.ts`, `apps/web/lib/shopify/status.ts`, `apps/web/components/product-picker.tsx`, `apps/web/app/(platform)/inbox/[threadId]/page.tsx`, `docs/approval-prep/*`).
- 2026-03-09 13:20:09 EDT — 13e preflight/scaffolding added `apps/web/e2e/production-cutover.spec.ts` and `docs/planning/phase-13/e/cutover-results.md`, but live deploy/QA is blocked by missing deploy context, missing production QA env (`NEXT_PUBLIC_APP_URL`, `E2E_EMAIL`, `E2E_PASSWORD`), and the current `DATABASE_URL` runtime gap during build/page-data collection.
- 2026-03-09 13:20:09 EDT — Reconciled execution with the final rollout decisions: Gmail now follows newest-connected-primary behavior, sender reads are ordered consistently, onboarding connections has return-path glue, and `.env.example` now includes production QA placeholders for the cutover suite.
- 2026-03-09 13:20:09 EDT — Release readiness check cleared locally: `.vercel/project.json` is present, `npm run build` passes when sourcing the root `.env.local`, and the live marketing cutover check confirms production is still on the old build because `.proof-rail` remains visible.
