# Phase 9g — Implement the creator-search worker, search UX, and review-to-campaign import flow

## Focus
Implement the hardest new capability in the platform: live creator search through a separate Playwright worker, plus the search UI and review-to-campaign import path in the web app.

## Inputs
- `docs/planning/phase-9/plan.md`
- `docs/planning/phase-9/e/plan.md`
- `docs/planning/phase-8/finalplan.md`
- `docs/planning/phase-8/c/integrations.md`
- `docs/planning/phase-8/d/product-surfaces.md`
- `docs/planning/phase-8/review.md`
- `apps/web/prisma/schema.prisma`

## Skills Available for This Subphase
- `find-local-skills` output: unavailable on this machine (missing local index); fallback to manual skill selection.
- `find-skills` output: unavailable on this machine; fallback to confirmed local skills only.
- Planned invocations:
  - `browser-automation`
  - `backend-development`
  - `context7-docs`
  - `frontend-design`
  - `react-dev`
  - `javascript-typescript`

## Work

### 1. Create the separate worker runtime
- Add a dedicated repo location for the worker at `workers/creator-search/`.
- Give it its own `package.json`, `tsconfig.json`, and runtime entrypoint.
- Keep it operationally separate from `apps/web` while preserving the shared contract from Phase 8.
- Communication is HTTP/JSON only — no shared TypeScript imports between worker and app. Define the request/callback contract as a JSON schema or Zod type that lives in the worker's own package.
- Note: root `package.json` has no `workspaces` field. The worker is standalone. If shared types become necessary, add a minimal root workspace config at that point, not preemptively.

### 2. Implement job claim / execute / callback behavior
- claim `CreatorSearchJob`
- run browser session with bounded lifetime
- extract results and evidence
- callback to the app via the internal search endpoint
- persist batch/result status safely on failures and retries

### 3. Implement search UI in the web app
- search form
- async job state
- result cards
- shortlist/reject/import actions
- duplicate badges for existing creators/campaign entries

### 4. Implement review-to-campaign import
- normalize results into `Creator`, `CreatorProfile`, `CreatorSearchResult`
- allow operator to approve/import into a specific campaign
- ensure imported creators enter the normal approval queue rather than bypassing it

### 5. Implement fallback paths
- manual creator add
- CSV import
- worker unavailable / CAPTCHA blocked states

### 6. Enforce quotas and failure policies
- organization/brand quota checks
- pause on repeated CAPTCHA/session failures
- intervention creation and evidence preservation

### 7. Validation
- `npm run web:build` (from repo root)
- `cd workers/creator-search && npm test` (worker unit/smoke tests)
- targeted UI verification for:
  - submit search
  - receive results
  - import to campaign
  - fallback path when worker errors

## Validation (RED TEAM)
- Worker must have its own Dockerfile or start script for independent deployment
- Internal callback endpoint must validate HMAC/token — unauthenticated callbacks must be rejected
- Worker must respect 5-minute session timeout — no runaway browser sessions
- CAPTCHA detection must preserve screenshot evidence before closing the session
- CSV import must validate data format and reject malformed rows with clear error messages

## Output
- The creator-search worker exists as a separate runtime in the repo and is integrated into the platform UX.
- Search results can safely feed the normal campaign approval path.

## Handoff
Phase 9h should harden everything built so far with replay tests, Playwright E2E, observability, migration tooling, and rollout gates so the pilot brand can be cut over with controlled risk.

## Assumptions / Open Questions (RED TEAM)
- Worker deploys to a separate service (Railway/Fly/VPS), not Vercel.
  - Why it matters: Vercel serverless functions have a 60s timeout and no persistent browser sessions.
  - Current default: separate Docker service, referenced by `CREATOR_SEARCH_WORKER_BASE_URL`.
- Meta Creator Marketplace may change its UI, breaking Playwright selectors.
  - Why it matters: browser automation is inherently fragile against UI changes.
  - Current default: manual entry + CSV import as fallback when worker fails.

## Parity Gap Additions (from n8n-parity-gaps.md)

### Included in 9g scope

**Unipile Instagram DM Integration** (Gap 1 — HIGH risk)
- Rationale: Instagram DMs are a primary outreach channel alongside email. Many creators are DM-first or lack public email. Omitting DMs from pilot means losing a significant portion of outreach effectiveness.
- Scope: Unipile API integration for send-only DMs (lookup user, find/create chat, send message). Rate-limited to 20 DMs/day per account. Reuses existing `ConversationThread` + `Message` models with `channel: "instagram_dm"`.
- Spec: See `docs/planning/phase-9/g/unipile-spec.md`
- Condition: **Requires Mo's confirmation** that DMs are pilot-critical before building. If Mo defers DMs, this drops from 9g scope.

### Deferred (post-pilot)

1. **17track Delivery Tracking** (Gap 2) — Shopify fulfillment webhooks provide sufficient delivery status for pilot. 17track adds granular tracking but is not operationally blocking. Effort: ~1-2 days when needed.

2. **PhantomBuster/Apify Creator Discovery** (Gap 3) — The n8n pipeline uses a fundamentally different discovery strategy (social graph traversal via seed accounts) than 9g's Meta Creator Marketplace worker (structured keyword search). Both are valid; they're complementary, not competing. The n8n pipeline can continue running in parallel during pilot. Post-pilot, this could become a second worker type feeding the same `CreatorSearchResult` pipeline.

3. **Cost Tracking / COGS** (Gap 5) — The `CostRecord` model exists in the schema. Shopify GraphQL query + aggregation can be built after the operational loop is validated. For pilot, the n8n cost workflow can continue independently. Effort: ~1-2 days.

4. **Refunnel/Slack Mention Tracking** (Gap 6) — Instagram webhook mentions cover the primary mention detection path. Refunnel provides supplementary cross-platform coverage. A generic external mention webhook can be added post-pilot. Effort: ~1 day.

5. **Instagram Graph API Tag Polling** (Gap 7) — Safety net for catching feed post tags that webhooks may miss. Add as a cron reconciliation job if webhook-based mention counts seem low during pilot.

### Requires Mo decision before build

1. **Unipile DMs (Gap 1)**: Are Instagram DMs required for pilot launch? If yes → included in 9g. If no → deferred post-pilot, email-only outreach for pilot.

2. **n8n Discovery Pipeline Coexistence (Gap 3)**: Can the PhantomBuster/Apify n8n workflow continue running alongside the platform during pilot? If yes → 9g's Marketplace worker is sufficient. If the n8n pipeline must be shut down → need a migration plan or alternate discovery worker.

3. **17track (Gap 2)**: Is granular 17track delivery tracking critical, or are Shopify fulfillment webhooks sufficient for pilot delivery status?
