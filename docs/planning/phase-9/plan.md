# Phase 9 — Seed Scale implementation against finalplan + review

## Original User Request (verbatim)
Implementing the feedback from the review. Go ahead and take the finalplan.md, plus the review.md, and create a new /phase-plan which is super in depth and actions the finalplan.md. $phase-plan

## Purpose
Turn the completed Phase 8 planning package into an execution-ready implementation phase that actually builds the Seed Scale platform in the repo, using `finalplan.md` as the architectural contract and `review.md` as the feedback/action list.

## Context
- Phase 8 is complete and produced the canonical planning artifacts, especially:
  - `docs/planning/phase-8/finalplan.md`
  - `docs/planning/phase-8/review.md`
- The review confirms the plan is execution-ready, but also makes the real next-step explicit:
  - no platform code exists yet,
  - `apps/web` still only has the marketing site,
  - the first implementation step must be bootstrap/foundation work.
- The review also highlights implementation-critical feedback that must be actioned immediately in this phase:
  - normalize `apps/web` env docs so current marketing vars and new platform vars can coexist cleanly,
  - preserve `npm run web:build` as the shipping-app quality gate,
  - keep the marketing site stable while platform routes and backend infrastructure are added beside it,
  - treat Phase 8’s contracts as locked unless a real blocker is discovered during coding.
- This phase deliberately moves from planning artifacts to code, migrations, handlers, UI, tests, and pilot rollout tooling.
- The subphase count exceeds the usual 2-6 range because the work now spans foundation, schema, auth, billing, inbox, ordering, worker runtime, and rollout hardening. Collapsing those into fewer buckets would create handoff ambiguity during execution.

## Skills Available for Implementation
- `find-local-skills`: attempted, but the required local index path `/home/podhi/.openclaw/workspace/orchestration/skill-index.json` is missing on this machine. Fallback: manual selection from installed skill list.
- `find-skills`: unavailable on this machine (no installed skill package/tool path). Fallback: plan only with confirmed local skills already present in the environment.
- Selected implementable skills:
  - `backend-development`
  - `database-schema-designer`
  - `context7-docs`
  - `requirements-clarity`
  - `llm-application-dev`
  - `browser-automation`
  - `frontend-design`
  - `react-dev`
  - `javascript-typescript`
  - `playwright-testing`
  - `qa-test-planner`
  - `phase-gaps`
  - `code-review`

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 8 | Complete planning | `docs/planning/phase-8/**` is the dependency contract for this phase | Treat Phase 8 as read-only source of truth; implement against it rather than re-planning. |
| Phase 7 | Active / untracked marketing work | `apps/web/app/layout.tsx`, public routes, `app/components/*`, `globals.css`, env docs | 9a moves marketing into `(marketing)/` route group and converts CSS to Tailwind. If Phase 7 makes concurrent changes, resolve against the migrated files. |
| Phase 6 | Active QA baseline | `playwright.config.ts`, `tests/**`, `npm run web:build` discipline | Reuse QA rigor and keep the anonymous-route checks passing. |
| Phase 5 | Historical audit tooling | `src/audit/**`, `docs/audit/**` | Read-only reference only; do not fold new platform runtime into audit code. |

## Objectives
* [ ] Bootstrap `apps/web` into a real full-stack product runtime without breaking the existing marketing site.
* [ ] Land the canonical database schema, data-access layer, encryption primitives, and migration scaffolding.
* [ ] Implement auth, tenancy, billing, onboarding, and brand configuration in a way that matches Phase 8 contracts.
* [ ] Implement the core seeding lifecycle: campaigns, creators, inbox, Gmail/AI reply handling, Shopify orders, reminders, mentions, interventions, and consent suppression.
* [ ] Implement the separate creator-search worker runtime and integrate it into the platform UX.
* [ ] Ship replay-safe provider handlers, observability, QA harnesses, migration tools, and rollout gates for a pilot-brand cutover.

## Constraints
- `docs/planning/phase-8/finalplan.md` is the canonical architecture contract for this phase. Do not reopen locked choices casually.
- The shipping app remains `apps/web`. Do not block implementation on a repo-wide workspace refactor.
- Marketing pages move into `(marketing)/` route group in 9a. URLs (`/`, `/pricing`) must remain unchanged after the move.
- All marketing CSS is converted to Tailwind 4 in 9a. Visual parity with the pre-migration state is mandatory (screenshot comparison).
- All new protected product work must live under `(platform)/` and `(auth)/` route groups; do not reuse the marketing `Shell` for the app runtime.
- Foundation work must come before feature work. No provider-heavy implementation should begin before dependency/bootstrap, routing, middleware, Prisma, and auth scaffolding exist.
- All risky state mutations must preserve the Phase 8 idempotency contract.
- Each code-changing subphase must end with the strongest relevant validation available at that point:
  - `npm run web:build`
  - `cd apps/web && npx prisma validate` once the schema exists
  - targeted Playwright or route-handler verification once UI/API paths exist
- Respect the dirty worktree. Never revert unrelated files.

## Success Criteria
- `apps/web` contains the real platform runtime scaffolding, dependencies, route groups, middleware, lib structure, and env docs needed to continue feature work safely.
- `apps/web/prisma/schema.prisma` exists, validates, and implements the canonical Phase 8 model closely enough that feature work does not need schema redesign.
- Auth, tenancy, billing, onboarding, brand config, campaigns, creators, inbox, Gmail/AI, Shopify, reminders, mentions, interventions, and creator-search all have implemented code paths in the repo.
- Provider callbacks/webhooks, background-job execution paths, and internal worker callbacks are replay-safe and instrumented.
- Playwright, replay, and rollout tooling exist for the pilot brand, with the parity checklist A-J mapped to concrete verification paths.
- The platform can progress from signup to first campaign, then through approval -> outreach -> reply -> address confirm -> order create -> delivery -> reminder -> mention in the new codebase with no architecture ambiguity remaining.

## Locked Decisions (from RED TEAM review)

1. **Next.js 16 — attempt with revert gate**: Install `next@16` in 9a. If build fails, revert to 15.5.12 immediately.
2. **CSS — full Tailwind migration in 9a**: Convert ALL 2,960 lines of hand-written `globals.css` to Tailwind 4 utility classes. Marketing components get inline Tailwind classes. No hand-written CSS survives. Tailwind preflight runs globally.
3. **Route groups — move marketing into `(marketing)/` in 9a**: Create all three route groups in 9a: `(marketing)/`, `(auth)/`, `(platform)/`. Move existing `page.tsx`, `pricing/page.tsx`, components, and actions into `(marketing)/`.
4. **Gmail — test accounts + submit verification at start**: Submit Google OAuth verification at Phase 9 start. Use unverified app with test accounts during development.

## Subphase Output Targets

| Subphase | Primary output |
|----------|----------------|
| 9a | bootstrapped app runtime, dependencies, full Tailwind migration, all 3 route groups `(marketing)/(auth)/(platform)`, normalized env docs |
| 9b | validated Prisma schema, DB layer, encryption helpers, migration/seed scaffolding |
| 9c | auth flow, tenancy bootstrap, protected platform shell |
| 9d | billing, onboarding wizard, brand config, provider-connect flows |
| 9e | campaigns, creators, approval queue, inbox, Gmail send/ingest, AI reply pipeline |
| 9f | Shopify ordering, reminders, mentions, interventions, unsubscribe suppression |
| 9g | separate creator-search worker, search UI, review/import flow |
| 9h | replay tests, Playwright E2E, observability, migration tooling, rollout gates |

## Subphase Index
* a — Bootstrap app runtime, full Tailwind migration, all 3 route groups, env normalization, and shared infrastructure scaffolding
* b — Land Prisma schema, database access layer, encryption primitives, and migration scaffolding
* c — Implement auth, tenancy, and the protected platform shell
* d — Implement billing, onboarding, brand configuration, and provider connection flows
* e — Implement campaigns, creators, approval queue, inbox, and Gmail/AI reply handling
* f — Implement Shopify ordering, reminders, mentions, interventions, and consent suppression
* g — Implement the creator-search worker, search UX, and review-to-campaign import flow
* h — Implement QA/replay harnesses, observability, migration tooling, and rollout gates

## Repo Reality Check (RED TEAM)

- What exists today:
  - `apps/web` is a pure marketing app: Next.js 15.5.12, React 19, TypeScript 5.9 — zero backend deps
  - `apps/web/package.json` scripts: only `dev`, `build`, `start` — no `db:push`, `db:generate`, `inngest:dev`, or `lint`
  - `apps/web/.env.example` contains exactly 1 line: `NEXT_PUBLIC_BOOKING_URL=https://example.com/book-demo`
  - `apps/web/.env.local` exists (has real values, not committed)
  - `apps/web/app/actions/submit-form.ts` — a real server action for the marketing lead form
  - `apps/web/app/components/` — 8 files: Shell.tsx, HomeContent.tsx, PricingContent.tsx, HeroScene.tsx, LeadForm.tsx, CtaLink.tsx, MobileCta.tsx, analytics.ts
  - `apps/web/app/globals.css` — 2,960 lines of hand-written CSS (no Tailwind, no PostCSS config)
  - `apps/web/next.config.ts` — minimal: only `reactStrictMode: true`
  - `apps/web/tsconfig.json` — no `paths` aliases (no `@/` or `~/` imports possible)
  - NO `apps/web/middleware.ts`
  - NO `apps/web/lib/` directory
  - NO `apps/web/components/` at the web root (only inside `app/`)
  - NO `apps/web/prisma/` directory
  - NO `apps/web/app/(auth)/`, `(platform)/`, `(marketing)/` route groups
  - NO `apps/web/app/api/` directory
  - NO `workers/` directory in the repo
  - NO Tailwind config, no PostCSS config, no shadcn config
  - NO ESLint config in `apps/web`
  - NO path aliases in `tsconfig.json`
  - Root `package.json` has no workspace config (no `workspaces` field)
- What the plan assumes:
  - Platform dependencies can be added to `apps/web` without breaking the marketing build — TRUE (additive)
  - Route groups can be added beside existing flat routes — TRUE (Next.js supports gradual adoption)
  - Tailwind 4 + shadcn can coexist with 2,960 lines of hand-written CSS — RESOLVED: full Tailwind migration in 9a eliminates coexistence entirely
  - `apps/web/components/` and `apps/web/actions/` can be created at the web root alongside `apps/web/app/components/` and `apps/web/app/actions/` — RESOLVED: marketing moves into `(marketing)/` group, platform uses root `components/` and `actions/`
  - `@/` import aliases will work — FALSE until `tsconfig.json` paths are added
  - `workers/creator-search/` can exist as a separate package — TRUE but needs explicit README, separate `package.json`, no root workspace config needed for now
- Skills discovered via `find-local-skills`: UNAVAILABLE (wrong machine path)
- Skills discovered via `find-skills`: UNAVAILABLE
- Verified touch points:
  - `docs/planning/phase-8/finalplan.md` — exists (563 lines)
  - `docs/planning/phase-8/review.md` — exists (88 lines)
  - `docs/seed-scale-handoff/appendix/behavior-parity-checklist.md` — exists (74 lines, 10 categories A-J)
  - `apps/web/package.json` — exists (minimal: next, react, react-dom only)
  - `apps/web/app/layout.tsx` — exists (24 lines, Manrope + Space Grotesk fonts, clean root layout)
  - `apps/web/app/page.tsx` — exists (server/client split, per-route metadata)
  - `apps/web/app/pricing/page.tsx` — exists
  - `apps/web/app/components/Shell.tsx` — exists (116 lines, `"use client"`)
  - `apps/web/app/actions/submit-form.ts` — exists (lead form server action)

## Skill Feasibility (RED TEAM)

- Critical skill check:
  - `backend-development` -> available
  - `database-schema-designer` -> available
  - `context7-docs` -> available
  - `llm-application-dev` -> available
  - `browser-automation` -> available
  - `frontend-design` -> available
  - `react-dev` -> available
  - `javascript-typescript` -> available
  - `playwright-testing` -> available
  - `qa-test-planner` -> available
  - `phase-gaps` -> available
  - `code-review` -> available
- Missing but required:
  - `find-local-skills` -> UNAVAILABLE -> fallback: use conversation skill list
  - `find-skills` -> UNAVAILABLE -> fallback: manual skill check

## RED TEAM Findings (Gaps / Weak Spots)

### Highest-risk failure modes

1. **LOCKED: Full Tailwind migration of 2,960 lines of CSS** — User chose full Tailwind migration over scoped isolation. All hand-written CSS in `globals.css` will be converted to Tailwind 4 utility classes in 9a. This eliminates the coexistence risk entirely but creates a large scope for 9a. -> Mitigation: screenshot every marketing page before migration. Compare visually after. Convert component-by-component with build checks. The CSS contains 17 `@keyframes` animations and ~6 `@media` queries that need Tailwind equivalents. Custom properties (CSS variables) become Tailwind theme extensions. -> NEW RISK: 9a is now the heaviest subphase. If visual parity fails on complex animations, the migration may need multiple passes.

2. **LOCKED: Marketing moves into `(marketing)/` — eliminates dual directory confusion** — User chose to move marketing into `(marketing)/` route group in 9a. This means `app/components/` and `app/actions/` move into `app/(marketing)/components/` and `app/(marketing)/actions/`. Platform components go in `components/platform/`, shared UI in `components/ui/`. The dual-directory confusion is resolved by making marketing a proper route group. -> Mitigation: move files atomically, verify build after each batch, ensure URLs don't change (route groups are URL-transparent in Next.js).

3. **No `tsconfig.json` path aliases** — Imports like `@/lib/supabase/server` won't work until `paths` is configured. Every subphase from 9a onward implicitly depends on this. -> Mitigation: 9a must add `paths: { "@/*": ["./*"] }` and `baseUrl: "."` to `apps/web/tsconfig.json` in step 1.

4. **Validation command errors across all subphases** — Multiple subphases say `npm run web:build` but that's a ROOT script. Inside `apps/web`, the command is `npm run build`. When running from repo root, the correct command is `npm run web:build`. Plan needs consistent validation commands. -> Mitigation: standardize all validation blocks to use `npm run web:build` (from repo root) for consistency.

5. **LOCKED: Next.js 16 attempt with revert gate** — User chose to attempt Next.js 16 upgrade. Install `next@16`, run build. If it fails, revert to 15.5.12. This is settled; no further decision needed. -> Mitigation: revert gate is automatic. Document which version stuck in the commit message.

6. **No ESLint config** — `eslint-config-next` is listed as a dev dependency to install but there's no `.eslintrc` or `eslint.config.*`. Without it, `npm run lint` won't exist. -> Mitigation: 9a must create an ESLint config and add a `lint` script to `apps/web/package.json`.

7. **Root package.json has no `workspaces` field** — 9g creates `workers/creator-search/` as a separate package, but without workspace config, cross-package imports and shared types require manual management. -> Mitigation: 9g must either add a root `workspaces` field or document the explicit contract boundary (HTTP/JSON only, no shared TS imports).

8. **External service dependencies undocumented** — Multiple subphases assume external services exist:
   - 9c: Supabase project must be created with auth configured
   - 9d: Stripe products/prices must be created in dashboard
   - 9d: Shopify custom app must be created in Partner Dashboard
   - 9e: Gmail OAuth app must exist in Google Cloud Console (2-6 week verification)
   - 9f: Instagram/Meta app must exist
   -> Mitigation: add an "External Prerequisites" section to the root plan listing every external service that must be set up before the corresponding subphase can execute.

### Missing or ambiguous requirements

- **No `next.config.ts` update plan** — Adding Supabase image domains, Stripe redirect URLs, Inngest middleware, and other provider-specific config will require `next.config.ts` changes. Currently it only has `reactStrictMode: true`. 9a should document what config additions are needed.
- **No shadcn init step** — Phase 8 architecture says `npx shadcn@latest init` but 9a doesn't include this explicit step. shadcn init creates `components.json`, modifies `tailwind.config`, and scaffolds `components/ui/`. This must happen in 9a.
- **No Inngest dev server instructions** — 9a installs Inngest but doesn't explain how to run the Inngest dev server locally. Developers need `npx inngest-cli@latest dev` running alongside `next dev`.

### Repo mismatches (fix the plan)

- **9a lists `apps/web/.env.example` as input** — file exists but only has 1 line (`NEXT_PUBLIC_BOOKING_URL`). Plan says "Update env documentation so it includes existing marketing vars" — there aren't multiple marketing vars to normalize. The `.env.local` file has the real values. 9a should create a comprehensive `.env.example` from scratch rather than "updating" a near-empty file.
- **9a lists `apps/web/README.md` as input** — exists but is just a local-run guide. Not critical to the bootstrap work.
- **9b validation says `cd apps/web && npm run web:build`** — `web:build` is a root script. From inside `apps/web`, use `npm run build`.
- **Next.js 16 path changes were under-specified** — current docs expect global CSS to stay rooted at `app/layout.tsx`, `next lint` is removed in favor of the ESLint CLI, and auth interception now uses `proxy.ts` rather than the older middleware naming. 9a execution must follow those current APIs.

### Performance / timeouts

- **Gmail OAuth verification** — LOCKED: submit verification at Phase 9 start; use test accounts during dev.
- **Shopify app review** — Custom apps may need Shopify review for public distribution. If this is a single-brand tool initially, private/custom app is fine. Clarify.

### Security / permissions

- **`.env.local` contains real secrets** — `.gitignore` must explicitly exclude it. Verify it's in `.gitignore` before any platform vars are added.
- **`APP_ENCRYPTION_KEY` generation** — 9b references encryption primitives but doesn't specify how to generate and manage the encryption key. This is critical for credential storage.

### Testing / validation

- **No lint gate exists** — The plan assumes `npm run web:build` is the quality gate, but there's no lint check at all. 9a should add `lint` script and run both `lint` and `build` as quality gates.
- **Playwright config exists at repo root** — `playwright.config.ts` is already configured (from Phase 6). 9h should extend it rather than creating a new one.

## External Prerequisites (must be done before corresponding subphase)

| Prerequisite | Needed by | Lead time | Action |
|---|---|---|---|
| Supabase project created + auth configured | 9c | Minutes | Create project at supabase.com, enable email auth, configure redirect URLs |
| Stripe account + products/prices created | 9d | Minutes-hours | Create products, price IDs, configure webhook endpoint |
| Shopify custom app created in Partner Dashboard | 9d | Minutes | Create app, configure OAuth scopes, note API key/secret |
| Google Cloud OAuth app created | 9e | 2-6 weeks for verification | Create OAuth consent screen, add Gmail scopes, submit for verification. Use test accounts during dev. |
| Meta/Instagram app created + business verified | 9f | Days-weeks | Create app, configure Instagram Graph API permissions |
| Domain/deployment URL for callbacks | 9c+ | Before provider connect | Vercel deployment or ngrok for local dev callback URLs |

## Assumptions (Agent)

- Phase 7 is complete (all 5 subphases executed, Playwright verified). The marketing surface is stable and should not change during Phase 9. (confidence ~92%)
  - Mitigation: if Phase 7 resumes with new changes, 9a's route-group migration timing may need adjustment.

- Phase 8 contracts are correct and complete enough to implement against. No architecture re-planning is needed. (confidence ~95%)
  - Mitigation: if a hard blocker appears during implementation, document the specific contradiction and propose a minimal fix rather than reopening the whole architecture.

- Next.js 16 upgrade from 15.5.12 will not cause breaking changes for the existing marketing pages. (LOCKED: attempt with revert gate)
  - Mitigation: automatic revert to 15.5.12 if build fails.

- Full Tailwind migration of 2,960 lines of CSS can achieve visual parity with the hand-written original. (confidence ~85%)
  - Mitigation: screenshot-based visual regression before and after. Complex animations (17 @keyframes) may need Tailwind arbitrary values or custom theme extensions. Convert component-by-component with build checks between each.

- The `workers/creator-search/` package can be self-contained without root workspace config. (confidence ~88%)
  - Mitigation: if shared types are needed, add a minimal root `workspaces` field or use a `shared/` package.

## Open Questions — ALL LOCKED

- [x] **Next.js 16 or stay on 15?** → LOCKED: Attempt Next.js 16 with revert gate. If build fails, revert to 15.5.12.
- [x] **Tailwind preflight strategy for CSS coexistence?** → LOCKED: Full Tailwind migration. Convert all 2,960 lines of hand-written CSS to Tailwind 4 utilities. No coexistence needed.
- [x] **Should marketing routes move into `(marketing)/` in 9a or later?** → LOCKED: Move into `(marketing)/` in 9a. All 3 route groups created together.
- [x] **Gmail development strategy before OAuth verification?** → LOCKED: Test accounts + submit verification at Phase 9 start.

## Phase Summary (running)
- 2026-03-06 18:00 America/Toronto — Began Phase 9a execution. Landed the dependency baseline in `apps/web`, moved the marketing surface into `app/(marketing)/`, created `(auth)` + `(platform)` shells, added `proxy.ts`/Supabase/Inngest scaffolds, and captured four pre-migration marketing baselines. 9a remains active pending Tailwind migration and shadcn init. (files: `apps/web/**`, `docs/planning/phase-9/a/plan.md`)
