# Phase 8 — Full-replacement Seed Scale platform architecture + implementation runway

## Original User Request (verbatim)
We're actually going ahead and working on building out the platform now. Some of the previous /phase-plan skills are talking about this. We have all the n8n resources, and you can ask me questions to understand the flow a little bit better in terms of what we're building out, but all the information is present within the repo. I want you to go ahead and send it if you explore agents, understand the context, understand everything that we're doing, and we'll get to that so that we can execute on it.
  
A few things that you should know:

*   The influence identification piece is going to probably be the hardest part, but it's gone a lot easier because of the Facebook marketplace for creators now. We want to leverage that in order to identify creators, so that's one thing.
*   The pipeline is going to look like this: when they're onboarding, we can ask them to submit a few creators that are within their niche so that we can use that in order to find other creators that are similar.
*   Within the plot form, you can do the architecture for this. You can do the intelligent design for this, because you are going to need to do that in order to actually build this platform out properly. You have all the phase plans that detail some of this stuff, but I don't think they're advanced enough, and I don't think there's enough thought put into them, because they were made by a less intelligent model.
*   You are the most intelligent model in the world, and you have thousands of years of design experience, thousands of years of architecture experience, thousands of years of database engineering, and thousands of years of experience of every single type of data. You've been trained in very high-quality data, so you need to leverage that in order to think about architecture, think about the flow not just in terms of onboarding that user but actually in terms of the actual platform itself.
*   From identifying the influencer to then reaching out to them, then from there getting their shipping address and shipping them the product automated, and then when they post about the product we can collect the content by doing social listening. Let's say, if they don't post about it, we can follow up with them to see how they enjoyed it.
*   When you think about that entire flow, send multiple trees of thought in terms of decisions that need to be made or actions that need to be taken depending on where the funnel we are. Let's say, if a creator doesn't respond, we need a follow-up sequence, things like that. We need to think about every single step in the funnel, and we need to go very deep here, very thoughtfully here, and we need to have a very solid plan in terms of the architecture.
*   A lot of that is present within the n8n nodes and the n8n files and in the current repository that we have. The phase plans have a decent amount of information as well. The prd.md has a decent amount of information. We have a lot of the information, but we need to amalgamate it and come up with an incredible, thoughtful, well-architected plan that we will put inside finalplan.md.
*   We need to put a lot of thought into this, a lot of effort into this, because this is the thing that matters the most. This is the foundation that we'll be building upon.
*   Don't ask me useless questions like "Are we using index.js plus for Cell and SupaBase Prisma?" or those details are present. Ask me difficult questions, ask me questions that steer you, ask me questions that help you understand the direction we want to go with this, because I want you to act as an autonomous, agentic AI that will actually build out this platform using its thousands of years of experience.
*   I can help in terms of the direction that we want to take it and sort of the feedback, but I need you to be the creator here. I need you to be very thoughtful here. We only have a few days to build this out, and we need to make it extremely good, and this plan is what matters the most here. Otherwise, I could lose my job, I could lose my place to live, and I could go homeless, so focus on what matters here, focus on the details, and send sub-agents for the things that you can't focus on and the things that you can delegate. Make sure you call all relevant skills when you are thinking of creating this plan, along with mentioning those skills within the plan itself as well.

## Purpose
Materialize a decision-complete implementation phase for the actual Seed Scale product: replace the legacy n8n/Airtable runtime with a self-serve multi-brand SaaS, preserve the working seeding lifecycle where it matters, and define the exact build order needed to ship in days rather than weeks.

## Context
- Repo reality: the only actual app is `apps/web`, currently a marketing site; the root `src/audit` tree is historical audit tooling, not product runtime.
- Current system of truth: `docs/seed-scale-handoff/**`, `PRD.MD`, `docs/seed-source-2026-03-01/**`, and `docs/n8n-audit-2026-03-01/**` describe the real seeding workflow, current drift, and parity risks.
- Planning drift: most prior phases (`phase-2` through `phase-5`) are audit/rebuild work for `aha.inc` and competitor teardowns, not the forward platform roadmap.
- Locked product decisions from the conversation:
  - full replacement now, not an Airtable/n8n wrapper
  - gifting-first v1
  - self-serve SaaS with Stripe checkout in v1
  - hierarchy `agency -> client -> brand`
  - live in-app creator search using Meta Creator Marketplace
  - email-thread AI for address capture
  - full instant self-serve integrations are in scope
- Design pattern to borrow, not copy: the ZRG Dashboard at `/Users/AR180/Desktop/Codespace/ZRG-Dashboard` is the reference architecture. It is a production Next.js 16 SaaS using the identical stack (Supabase Auth, Prisma 7.1, Inngest 3.52, OpenAI, Vercel, Tailwind 4/shadcn/ui). It provides the right operational shape for a conversation-first inbox, async webhook/job processing, AI-copilot controls, lock-based webhook queuing, fair background job scheduling, and multi-tenant auth middleware. Execution agents should read ZRG files as reference implementations rather than designing from scratch.

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 7 | Active / untracked | `apps/web` marketing routes, shared shell decisions, planning docs | Treat as a separate marketing track. Phase 8 must not overwrite homepage/pricing redesign work while defining platform routes, auth, and shared backend infrastructure. |
| Phase 6 | Active baseline | Funnel QA discipline and local Playwright gates | Reuse QA rigor only. Do not reopen Phase 6 as the platform roadmap. |
| Phase 2 | Historical / dirty in worktree | Owned-app audit outputs and Aha platform references | Use as research only. No new audit regeneration or route-crawl work should be folded into this phase. |
| Phase 5 | Historical / dirty in worktree | Shared audit output contract and blueprint files | Keep Phase 5 read-only; Phase 8 is the new canonical platform build track. |

## Objectives
* [x] Lock the target system architecture, repo topology, and implementation order for the full-replacement platform.
* [x] Define the canonical data model, billing model, hierarchy, and multi-brand configuration strategy.
* [x] Define provider integrations, background jobs, webhooks, idempotency, and failure handling.
* [x] Define the operator-facing product surfaces, inbox behavior, and end-to-end funnel state machines.
* [x] Define migration, QA, observability, and rollout gates that preserve parity without keeping the legacy runtime alive.

## Constraints
- Use `apps/web` as the single shipping app. Do not block on a repo-wide workspace refactor before product work starts.
- Keep the legacy n8n/Airtable exports as behavioral reference only; do not make them a required production dependency in the new architecture.
- Preserve the existing seeding lifecycle behaviors that are business-critical: approval gate, outreach cadence, AI-assisted reply handling, Shopify order creation, delivery follow-up, mentions tracking, and intervention visibility.
- Email is the canonical creator communication channel in v1. DM automation, paid-deal workflows, whitelisting, and automated usage-rights collection are future-modeled but not first-launch scope.
- Creator search must be live in-app and use a dedicated browser-worker pattern for Meta Creator Marketplace rather than hand-wavy “AI search”.
- Self-serve onboarding and Stripe checkout are part of v1, so auth, billing, brand setup, and integration activation cannot be deferred to a “later platform” phase.
- Respect the dirty worktree and concurrent marketing phase. Do not revert or rewrite unrelated docs, screenshots, audit artifacts, or Phase 7 planning outputs.

## Skill Invocation Map

| Subphase | Skills to invoke |
|----------|------------------|
| 8a | `requirements-clarity`, `gepetto`, `phase-gaps`, `multi-agent-patterns`, `backend-development`, `context7-docs` |
| 8b | `database-schema-designer`, `backend-development`, `context7-docs` |
| 8c | `backend-development`, `llm-application-dev`, `browser-automation`, `context7-docs`, `phase-gaps` |
| 8d | `llm-application-dev`, `browser-automation`, `playwright-testing`, `frontend-design` |
| 8e | `phase-gaps`, `playwright-testing`, `gepetto`, `qa-test-planner` |

## Success Criteria
- [x] A new canonical platform plan exists under `docs/planning/phase-8/` with subphases covering architecture, data model, integrations/jobs, product surfaces/state machines, and rollout/ops.
- [x] The phase defines the exact target stack, runtime boundaries, provider interfaces, and status models needed to implement without further architectural guesswork. Test: an execution agent can read `docs/planning/phase-8/finalplan.md` and begin implementing the first build step without asking clarifying questions about stack, schema, routing, or deployment target.
- [x] The phase explicitly names the release contract that will replace n8n/Airtable behavior and the migration steps to cut over brand by brand.
- [x] `docs/planning/phase-8/finalplan.md` is the explicit output artifact of this phase, synthesized from subphase outputs in 8e.
- [x] The plan documents coordination with the active marketing redesign track so product work can proceed without clobbering `apps/web` marketing changes.

## Subphase Output Artifacts (concrete paths)

Each subphase produces a specific artifact file in addition to its `plan.md`:

| Subphase | Output artifact path | Format |
|----------|---------------------|--------|
| 8a | `docs/planning/phase-8/a/architecture.md` | System architecture lock: repo topology, stack, provider boundaries, build order |
| 8b | `docs/planning/phase-8/b/schema.md` | Canonical domain model: entities, enums, relationships, Prisma-ready schema draft |
| 8c | `docs/planning/phase-8/c/integrations.md` | Integration contracts: provider surfaces, job model, webhook normalization, idempotency keys |
| 8d | `docs/planning/phase-8/d/product-surfaces.md` | Product spec: routes, state machines, decision trees, role permissions |
| 8e | `docs/planning/phase-8/e/rollout.md` + `docs/planning/phase-8/finalplan.md` | Migration/rollout plan + final synthesis |

## Repo Reality Check (RED TEAM)

- What exists today:
  - `apps/web` is a pure marketing site: `page.tsx` (homepage), `pricing/page.tsx`, `layout.tsx`, shared components (`Shell.tsx`, `CtaLink.tsx`, `MobileCta.tsx`, `analytics.ts`)
  - Dependencies in `apps/web/package.json`: Next.js 15, React 19, TypeScript ONLY — zero backend deps
  - NO Prisma, NO Supabase, NO Stripe, NO auth middleware, NO API routes, NO server actions, NO `.env` files, NO database connection
  - NO `prisma/schema.prisma` anywhere in the repo
  - NO `apps/web/lib/` directory
  - NO `apps/web/app/api/` routes
  - NO `apps/web/app/actions/` server actions
  - Root `package.json` has audit tooling scripts and `@playwright/test` as devDep
  - `apps/web/app/components/` EXISTS (created by Phase 7) with `Shell.tsx`, `CtaLink.tsx`, `MobileCta.tsx`, `analytics.ts`
  - Phase 7 is actively redesigning the marketing pages in `apps/web` (homepage hero, pricing, shared shell extraction)
  - Phase 6 already modified `page.tsx`, `pricing/page.tsx`, `globals.css` with CRO iterations
  - Phase 5 is a read-only audit system — no platform code overlap
- What the plan assumes:
  - Prisma ORM can be used immediately — FALSE, must be installed and initialized
  - Supabase Auth is available — FALSE, must be installed and configured
  - Stripe billing infrastructure exists — FALSE, must be installed and configured
  - Server actions and API routes can be written — TRUE (Next.js supports them) but no directory structure exists
  - Background jobs can be enqueued — FALSE, no job runner installed or chosen
  - `apps/web` can host both marketing and platform — TRUE but requires route group separation strategy vs Phase 7
- Skills discovered via conversation context (available):
  - `backend-development`, `database-schema-designer`, `database-design`, `browser-automation`, `context7-docs`, `phase-gaps`, `requirements-clarity`, `gepetto`, `multi-agent-patterns`, `llm-application-dev`, `playwright-testing`, `playwright`, `frontend-design`, `javascript-typescript`, `react-dev`
- Skills discovered via `find-local-skills`: UNAVAILABLE (skill index path `/home/podhi/.openclaw/` does not exist on this machine)
- Skills discovered via `find-skills`: NOT AVAILABLE in this environment
- Verified touch points:
  - `docs/seed-scale-handoff/README.md` — exists, comprehensive handoff doc
  - `docs/seed-scale-handoff/appendix/open-choices.md` — exists, 6 choice sets for developer discretion
  - `docs/seed-scale-handoff/appendix/decision-log.md` — exists, 10 accepted decisions + 5 open
  - `docs/seed-scale-handoff/appendix/source-truth-map.md` — exists, workflow metadata + hardcoded values map
  - `docs/seed-scale-handoff/appendix/behavior-parity-checklist.md` — exists, 10-section verification checklist
  - `docs/seed-source-2026-03-01/Airtable-Database-Guide.txt` — exists
  - `docs/n8n-audit-2026-03-01/workflow-node-audit.md` — exists
  - `PRD.MD` — exists, describes v1.0 workflow + v2.0 roadmap (assumes n8n/Airtable continues; Phase 8 replaces it)
  - `apps/web/app/page.tsx` — exists, marketing homepage (actively being redesigned by Phase 7)

## Skill Feasibility (RED TEAM)

- Critical skill check:
  - `backend-development` -> available
  - `database-schema-designer` -> available
  - `browser-automation` -> available
  - `context7-docs` -> available
  - `llm-application-dev` -> available
  - `multi-agent-patterns` -> available
  - `playwright-testing` -> available
  - `gepetto` -> available
  - `requirements-clarity` -> available
  - `phase-gaps` -> available
  - `frontend-design` -> available
- Missing but required:
  - `find-local-skills` -> UNAVAILABLE (wrong machine path) -> fallback: use conversation skill list directly
  - `find-skills` -> UNAVAILABLE (Vercel-based) -> fallback: manually check skill list in system context

## RED TEAM Findings (Gaps / Weak Spots)

### Highest-risk failure modes

- **ZERO backend infrastructure exists in `apps/web`** — Plan references Prisma, Supabase, Stripe, server actions, background jobs, but `apps/web/package.json` has only Next.js + React + TypeScript. Every subphase implicitly depends on a bootstrapping step that doesn't exist in any subphase. -> Mitigation: 8a must include an explicit "dependency bootstrapping" section that lists every `npm install` and config file creation needed before 8b can design a schema.
- **Phase 7 collision with `apps/web`** — Phase 7 is actively redesigning marketing pages and extracting shared components in `apps/web`. Phase 8 will add platform routes, auth, API endpoints to the same app. Without route group separation (`(marketing)` vs `(platform)`), these phases will create merge conflicts on shared files (`layout.tsx`, `globals.css`, component imports). -> Mitigation: 8a must lock the route group strategy: `apps/web/app/(marketing)/` for marketing pages, `apps/web/app/(platform)/` for platform dashboard, with separate layouts.
- **Phantom inputs will stall execution agents** — 8a references "repo reality memo from the planning turn" and 8c references "ZRG dashboard architectural reference from the planning turn" — neither exists on disk. Execution agents will search for these files, fail, and either hallucinate content or stall. -> Mitigation: remove phantom references; replace with actual on-disk docs or inline the relevant context in the subphase plan.
- **Subphase output format was undefined** — Each subphase listed "output of subphase X" as an input without specifying file path or format. Execution agents can't locate or produce these artifacts. -> Mitigation: added "Subphase Output Artifacts" table above with concrete paths.
- **Background job runtime is unspecified** — Plan says "enqueue background jobs" but never names the runner. Options (Vercel cron, Inngest, Trigger.dev, pg-boss, BullMQ) have fundamentally different architecture implications. -> Mitigation: 8a must lock this decision.
- **Deployment target is unspecified** — Where `apps/web` deploys (Vercel, Docker, self-hosted) determines what background processing, cron, and edge functions are available. -> Mitigation: 8a must lock this.

### Missing or ambiguous requirements

- **No auth bootstrapping plan** — Plan mentions "self-serve onboarding" and "agency/client/brand hierarchy" but never specifies how Supabase Auth is installed, configured, or how middleware/session handling works. This is a prerequisite for every platform route.
- **No environment variable strategy** — What `.env` vars are needed, where are they documented, what's the `.env.example` template? This affects every integration.
- **No route group separation strategy** — `apps/web` currently has flat routes. Platform needs `(platform)` group with auth middleware; marketing needs `(marketing)` group without auth. Neither is defined.
- **PRD scope mismatch unresolved** — PRD.MD assumes n8n/Airtable continues; Phase 8 replaces it. The PRD's v2.0 items (usage rights, content ingestion, creative editing, asset delivery) need explicit "future phase" mapping so they don't creep into v1.
- **Shopify app type unclear** — PRD says "private app" but Shopify deprecated custom/private apps. Phase 8 should specify whether this is a Shopify custom app (new auth flow) or embedded app.
- **`finalplan.md` was missing a concrete path** — now fixed: `docs/planning/phase-8/finalplan.md`.

### Repo mismatches (fix the plan)

- **"repo reality memo from the planning turn"** referenced in original 8a -> RESOLVED: removed phantom reference, replaced with actual repo files in refined 8a.
- **"ZRG dashboard architectural reference from the planning turn"** referenced in original 8c -> RESOLVED: ZRG Dashboard found at `/Users/AR180/Desktop/Codespace/ZRG-Dashboard`. Now explicitly referenced with concrete file paths in all subphases.
- **`apps/web/app/components/` already exists** with Phase 7 components (`Shell.tsx`, `CtaLink.tsx`, `MobileCta.tsx`, `analytics.ts`). Plan must acknowledge these exist and not overwrite them.

### Performance / timeouts

- **Gmail API rate limits** — 250 quota units/second, 2000 messages/day for workspace accounts. Production use requires Google OAuth verification (can take weeks). Plan must specify: what email volume is expected at launch? Is Google Workspace the email provider? Is there a fallback (SendGrid, Resend)?
- **OpenAI API cost/latency budget** — AI-assisted reply handling, address extraction, classification all use LLM calls. Plan must specify: which model? What's the per-message cost budget? What's the acceptable latency? What happens when the API is down?
- **Meta Creator Marketplace rate limiting** — Browser-based scraping has no official API rate limits but Meta actively detects and blocks automation. Plan must specify: max searches/hour? Session rotation strategy? CAPTCHA handling?

### Security / permissions

- **Creator PII handling** — Platform stores email addresses, shipping addresses, social profiles. No mention of data privacy, GDPR compliance, retention policies, or deletion capabilities. Must be addressed in 8b (schema-level) and 8d (UI-level).
- **Creator consent / CAN-SPAM** — Automated email outreach requires opt-out mechanisms. Must be designed into the outreach flow in 8d.
- **OAuth token storage** — Gmail, Shopify, Meta tokens stored in database. Must be encrypted at rest. Plan must specify encryption strategy in 8b.

### Testing / validation

- **No test strategy for planning artifacts** — These are planning docs, not code, but the success criteria say "implement without further architectural guesswork." The only way to test this is to have an execution agent attempt to start implementation from `finalplan.md` and see if it stalls.
- **Behavior parity checklist (10 sections) must be explicitly mapped** — `docs/seed-scale-handoff/appendix/behavior-parity-checklist.md` has 10 verification sections (A-J). 8e references it but doesn't map each section to the new platform's implementation.

## Resolved Questions (locked by user)

- [x] **Deployment target** — Vercel for the Next.js app + separate Docker worker service (Railway/Fly/VPS) for browser automation and long-running jobs. Matches ZRG Dashboard's Vercel deployment pattern.
- [x] **Background job runner** — Inngest. Confirmed by user. ZRG Dashboard uses Inngest v3.52 in production with idempotency, concurrency control, and dispatch windowing. Reference: `ZRG-Dashboard/lib/inngest/`.
- [x] **Email provider** — Gmail OAuth per-brand for v1. Each brand connects their own Gmail account. Architecture must support: multiple email aliases per brand, per-account sending volume tracking with soft rate limiting, deliverability monitoring (bounce rate, spam complaints), warm-up schedule for new aliases (start at 50/day, increase 25% weekly). Future: transactional service (Resend/SendGrid) upgrade path for high-volume brands.
- [x] **Route group separation** — Next.js route groups: `(marketing)` for public pages, `(platform)` for authenticated dashboard. Separate root layouts per group. Shared `app/lib/` for cross-cutting utilities.
- [x] **Meta Creator Marketplace browser worker** — v1 scope per user. Live in-app search via Playwright worker with manual entry + CSV import as fallback when browser search is unavailable.

## ZRG Dashboard Reference Architecture

Located at `/Users/AR180/Desktop/Codespace/ZRG-Dashboard`. Production SaaS using the identical stack. Execution agents MUST read the relevant ZRG files before implementing each subsystem.

| Phase 8 Need | ZRG Pattern | ZRG Files |
|---|---|---|
| Inngest setup | `createFunction` with dispatchKey, retries, concurrency limits | `lib/inngest/client.ts`, `lib/inngest/events.ts`, `lib/inngest/functions/` |
| Supabase auth middleware | Chunked cookie parsing, refresh token validation, fail-safe | `middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts` |
| Auth flow | Login, signup, callback, verify, forgot/reset password | `app/auth/login/`, `app/auth/signup/`, `app/auth/callback/route.ts` |
| Webhook processing | Lock-based queue, stale release, exponential backoff + jitter, HMAC | `lib/webhook-events/runner.ts`, `lib/webhook-events/crm-outbound.ts` |
| AI draft pipeline | Context packing, multi-stage processing, artifact storage | `lib/ai-drafts/`, `lib/draft-pipeline/context-pack.ts` |
| Background jobs | Fair scheduling, dispatch windowing, autoscaling, workspace quotas | `lib/background-jobs/runner.ts`, `lib/background-jobs/fair-scheduler.ts` |
| Server actions | `"use server"` with `{ success, error }` returns, auth via `createClient()` | `actions/` (52+ files) |
| Prisma schema | Multi-tenant, enums, WebhookEvent/BackgroundJob tables, audit timestamps | `prisma/schema.prisma` (~2600 lines) |
| UI components | Radix + shadcn/ui + Tailwind 4 | `components/ui/`, `components/dashboard/` |

## Assumptions (Agent)

- Supabase is the auth + database provider (Supabase Auth for login/session, Supabase Postgres via Prisma ORM for data). (confidence ~92%)
  - Mitigation: if a different auth provider is preferred (Clerk, Auth.js, etc.), update 8a architecture lock and 8b schema design accordingly.

- Stripe is the billing provider with organization-level subscriptions and plan-gated entitlements. (confidence ~95%)
  - Mitigation: if a different billing approach is needed (usage-based, per-brand, etc.), the billing model in 8b must be redesigned.

- Route groups confirmed: `(marketing)` / `(platform)` in `apps/web`. (confidence ~95%, user-confirmed)

- `docs/planning/phase-8/finalplan.md` is the correct output location for the synthesis artifact. (confidence ~90%)
  - Mitigation: if `finalplan.md` should live at the repo root or in a different location, update 8e's output target.

- Gifting-first v1 means: no paid-deal workflows, no DM automation, no whitelisting, no automated usage-rights collection. These are explicitly out of v1 scope per the user's locked decisions. (confidence ~97%)
  - Mitigation: ensure these are listed as "future-modeled" in 8b schema with dormant tables/enums.

- Stack should align with ZRG Dashboard: Next.js 16, Tailwind 4, shadcn/ui, Prisma 7.1, Inngest 3.52. (confidence ~90%)
  - Mitigation: if Next.js 15 is preferred over 16, minor API differences exist but patterns remain the same.

## Subphase Index
* a — Lock target system architecture, repo topology, dependency bootstrapping, and build sequence
* b — Design canonical data model, billing model, hierarchy, and config surface
* c — Define integrations, background jobs, webhooks, and idempotency contracts
* d — Specify operator product surfaces, inbox behavior, and funnel state machines
* e — Define migration, QA, observability, rollout gates, and `finalplan.md` synthesis

## Phase Summary

- Completed all five subphases and wrote the concrete artifacts:
  - `docs/planning/phase-8/a/architecture.md`
  - `docs/planning/phase-8/b/schema.md`
  - `docs/planning/phase-8/c/integrations.md`
  - `docs/planning/phase-8/d/product-surfaces.md`
  - `docs/planning/phase-8/e/rollout.md`
  - `docs/planning/phase-8/finalplan.md`
- Locked the platform as a single Next.js app in `apps/web` with Supabase Auth, Supabase Postgres, Prisma, Stripe, Inngest, and a separate Playwright worker for creator search.
- Replaced the earlier ambiguous planning assumptions with concrete decisions:
  - Prisma lives in `apps/web/prisma`
  - route groups are `(marketing)`, `(auth)`, and `(platform)`
  - durable queue + Inngest orchestration is the async model
  - creator discovery is worker-mediated and approval-gated
  - AI is copilot-only in v1
- Mapped the legacy Airtable/n8n behaviors into canonical schema entities, job contracts, UI surfaces, migration steps, and parity-based rollout gates.
- The execution handoff is now `docs/planning/phase-8/finalplan.md`. The first implementation step is dependency/bootstrap work inside `apps/web`, followed by auth, tenancy, and billing.
