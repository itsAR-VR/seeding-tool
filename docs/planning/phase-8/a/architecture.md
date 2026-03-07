# Phase 8a Architecture Lock

Last updated: 2026-03-06
Owner: Phase 8 execution
Validated against:
- `docs/seed-scale-handoff/README.md`
- `docs/seed-scale-handoff/appendix/open-choices.md`
- `docs/seed-scale-handoff/appendix/decision-log.md`
- `PRD.MD`
- `apps/web/package.json`
- `apps/web/app/layout.tsx`
- `ZRG-Dashboard` reference files:
  - `middleware.ts`
  - `lib/supabase/*`
  - `lib/inngest/*`
  - `prisma/schema.prisma`
- Context7 docs:
  - Next.js 16 App Router route groups, middleware, and route handlers
  - Supabase SSR middleware + server/browser client patterns

## 1. Why This Architecture

### Why
Seed Scale needs a shipping platform foundation that can replace the current Airtable + n8n control plane without spending days on architecture churn. The new runtime has to cover the real business loop:

1. onboard a brand,
2. find creators,
3. approve and outreach,
4. capture replies and addresses,
5. create orders,
6. track delivery,
7. monitor content,
8. surface exceptions fast.

### Simpler
The simplest architecture that still holds under real operator load is:

- one shipping Next.js app for product + marketing,
- one Postgres database,
- one auth system,
- one async orchestration layer,
- one separate browser worker for the Meta marketplace problem,
- no separate API service before v1.

Anything more distributed than that is unnecessary for the next few days. Anything less separated than that makes creator search and async reliability too fragile.

### Explicitly Out of Scope for v1
- DM automation
- paid deals workflow
- usage rights negotiation
- creator portal
- ad asset ingestion/editing pipeline
- generic multi-channel messaging infrastructure

These are modeled later, not built now.

## 2. Locked Runtime Boundary

### Canonical Runtime
- Shipping app: `apps/web`
- Canonical database: Supabase Postgres
- Canonical auth: Supabase Auth
- Canonical async orchestration: Inngest
- Canonical browser automation runtime: separate Node/Playwright worker service

### Historical Reference Only
- Root `src/audit/**`
- `docs/n8n-audit-2026-03-01/**`
- `docs/seed-source-2026-03-01/**`

These stay available for parity and migration work, but they are not runtime dependencies for the new platform.

## 3. Repo Topology Lock

### Current Repo Reality
- `apps/web` is the only app users can actually interact with.
- Phase 7 already owns the marketing experience in:
  - `apps/web/app/page.tsx`
  - `apps/web/app/pricing/page.tsx`
  - `apps/web/app/components/*`
  - `apps/web/app/layout.tsx`

### Target Topology

```text
apps/web/
  app/
    layout.tsx                    # thin root layout: fonts, globals, providers
    (marketing)/
      layout.tsx                  # marketing shell only
      page.tsx                    # homepage
      pricing/page.tsx            # pricing
    (auth)/
      layout.tsx                  # auth shell
      login/page.tsx
      signup/page.tsx
      brand/new/page.tsx          # self-serve activation funnel
    (platform)/
      layout.tsx                  # authenticated app shell
      dashboard/page.tsx
      onboarding/page.tsx
      creators/page.tsx
      campaigns/page.tsx
      inbox/page.tsx
      orders/page.tsx
      mentions/page.tsx
      interventions/page.tsx
      settings/page.tsx
    api/
      inngest/route.ts
      webhooks/
        stripe/route.ts
        shopify/route.ts
        gmail/route.ts
        instagram/route.ts
      auth/
        shopify/callback/route.ts
        gmail/callback/route.ts
      internal/
        creator-search/route.ts
      cron/
        [job]/route.ts
    components/                   # keep existing Phase 7 marketing components
  actions/
    *.ts                          # server actions
  components/
    ui/*
    platform/*
  lib/
    supabase/*
    prisma/*
    stripe/*
    shopify/*
    gmail/*
    meta/*
    ai/*
    inngest/*
    security/*
    observability/*
  prisma/
    schema.prisma
  middleware.ts
  .env.example
```

### Path Decision
Use `apps/web/lib`, `apps/web/actions`, `apps/web/components`, and `apps/web/prisma` for all new platform runtime code.

Reason:
- keeps all shipping app code deployable from the app root,
- avoids coupling platform runtime to the audit-tool root package,
- avoids the Vercel root-directory ambiguity a repo-root `prisma/` folder would create.

The earlier Phase 8 draft assumed repo-root `prisma/schema.prisma`. That is rejected here in favor of `apps/web/prisma/schema.prisma`.

## 4. Phase 7 Coordination Strategy

The route-group strategy is locked, but the migration must not collide with active marketing work.

### Coordination Rule
Do not move Phase 7 marketing files during platform bootstrap unless the marketing track is stable in the same turn.

### Safe Migration Path
1. Keep the existing root marketing pages working as-is during initial platform bootstrap.
2. Add `(auth)` and `(platform)` first, plus `middleware.ts`, `lib/*`, `actions/*`, `prisma/*`, and `app/api/*`.
3. Once the marketing track is quiet, move the existing homepage and pricing pages into `(marketing)` as a no-URL-change refactor.
4. Keep `app/layout.tsx` thin and route-group-specific shells inside each group layout.

This avoids touching the most conflict-prone files until needed.

## 5. Stack Lock

### Core Product Stack
- Framework: Next.js `16.x`
- UI runtime: React `19.x`
- TypeScript: `5.x`
- Styling: Tailwind `4.x` + shadcn/ui + Radix
- Auth: `@supabase/ssr` + `@supabase/supabase-js`
- Database ORM: Prisma `7.1.x`
- Database: Supabase Postgres
- Background jobs: Inngest `3.52.x`
- AI: OpenAI `6.x` client, structured outputs only
- Billing: Stripe
- Browser automation: Playwright in separate worker service

### Version Policy
- Lock to major/minor families that already work in the ZRG reference.
- Pin exact versions during implementation in `apps/web/package.json` once bootstrapping starts.
- Avoid speculative upgrades beyond the validated family while Phase 8 is in flight.

## 6. Runtime Boundaries: What Runs Where

| Runtime | Responsibilities | Must Not Do |
|---|---|---|
| `apps/web` marketing routes | homepage, pricing, auth entrypoints | browser automation, long-running provider jobs |
| `apps/web` platform routes | dashboard UI, onboarding UI, inbox UI, server actions | long-running browser sessions |
| `apps/web` route handlers | webhook ingress, OAuth callbacks, cron triggers, internal control endpoints | inline AI loops, inline creator search, inline long retries |
| Inngest functions | orchestrate async lifecycle work, retry, debounce, idempotent dispatch | UI rendering, browser-bound marketplace scraping |
| Browser worker service | Meta Creator Marketplace sessions, live search execution, result normalization | public app pages, billing logic, auth middleware |
| Supabase Postgres | canonical state, event log, config, credentials, audit trail | business logic execution |
| Historical audit tooling | parity reference, fixture generation, discovery | production lifecycle execution |

## 7. Provider Boundary and Auth Pattern

| Provider | Primary Use | Auth Pattern | Token Storage | Notes |
|---|---|---|---|---|
| Supabase Auth | app auth + session cookies | SSR middleware + browser/server clients | cookies + Supabase-managed tokens | use `getUser()` for authorization decisions |
| Postgres | canonical data | Prisma over pooled Postgres URL | DB connection string only | migrations run from `apps/web/prisma` |
| Stripe | checkout, subscriptions, portal, lifecycle webhooks | secret key + webhook signature | env vars only; Stripe customer/subscription IDs in DB | org-level billing only |
| Shopify | store install, product lookup, order create, fulfillment status | custom app OAuth + webhook HMAC | encrypted `ProviderCredential` row per brand | never use deprecated private-app language in implementation |
| Gmail | send outreach, sync replies | OAuth2 per alias | encrypted `ProviderCredential` row per alias | warm-up + deliverability caps are brand config, not code constants |
| Google Pub/Sub / Gmail push | inbox notification fan-in | Google project credentials + webhook verification | env vars + brand linkage in DB | poll fallback remains available |
| Meta/Instagram Graph | mentions / webhook ingest | app secret + verify token | env vars + brand-linked external account rows | webhook first, poll fallback second |
| Meta Creator Marketplace | live creator discovery | worker-managed authenticated browser session | worker secret + encrypted session material | separate process by design |
| OpenAI | reply classification, address extraction, drafting | API key | env vars only | structured output only; low confidence opens intervention |

## 8. Async Execution Pattern

### Rule
Any unit of work that can take more than 5 seconds, call multiple providers, or cause duplicate side effects must not run inline in a route handler or server action.

### Flow
1. Route handler or server action validates input.
2. It writes or updates canonical DB state.
3. It writes a normalized event/audit record if external ingress is involved.
4. It enqueues Inngest work with a dedupe key.
5. Inngest function performs idempotent work and records outcome.
6. If the job needs browser automation, the function bridges to the worker control path and waits asynchronously for result callbacks.

### Browser Worker Control Pattern
- App creates `CreatorSearchJob` row and dispatches an internal signed request.
- Worker claims the job, runs Playwright, streams normalized results back through the signed internal endpoint or DB row updates.
- App never stores browser-session logic in route handlers.

This keeps Inngest as the control plane while respecting the separate browser runtime.

## 9. Dependency Bootstrapping Checklist

All commands below are scoped to `apps/web` unless noted otherwise.

```bash
# Core platform runtime
npm install next@16 react@19 react-dom@19
npm install @supabase/supabase-js @supabase/ssr
npm install @prisma/client @prisma/adapter-pg
npm install stripe @stripe/stripe-js
npm install inngest
npm install zod openai server-only

# UI/system utilities
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react date-fns
npm install react-hook-form @hookform/resolvers
npm install @tanstack/react-query sonner

# UI primitives
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label
npm install @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-tabs
npm install @radix-ui/react-tooltip @radix-ui/react-popover @radix-ui/react-slot

# Dev dependencies
npm install -D prisma tailwindcss @tailwindcss/postcss postcss eslint eslint-config-next

# Bootstrap local Prisma folder from apps/web
npx prisma init --datasource-provider postgresql

# Optional local Inngest dev loop
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

### Required Files To Create Before 8b/8c Code Work
- `apps/web/.env.example`
- `apps/web/middleware.ts`
- `apps/web/lib/supabase/client.ts`
- `apps/web/lib/supabase/server.ts`
- `apps/web/lib/supabase/middleware.ts`
- `apps/web/lib/inngest/client.ts`
- `apps/web/lib/inngest/events.ts`
- `apps/web/app/api/inngest/route.ts`
- `apps/web/prisma/schema.prisma`
- `apps/web/components/ui/*`

## 10. Environment Variable Inventory

### Core App
- `NEXT_PUBLIC_APP_URL`
- `APP_ENV`
- `CRON_SECRET`
- `INTERNAL_API_TOKEN`
- `APP_ENCRYPTION_KEY`

### Database / Auth
- `DATABASE_URL`
- `DIRECT_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Stripe
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_GROWTH_PRICE_ID`

### Inngest
- `INNGEST_APP_ID`
- `INNGEST_EVENT_KEY`
- `INNGEST_SIGNING_KEY`
- `INNGEST_ENV`

### OpenAI
- `OPENAI_API_KEY`

### Shopify App
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `SHOPIFY_APP_SCOPES`
- `SHOPIFY_WEBHOOK_SECRET`

### Gmail / Google
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_PROJECT_ID`
- `GOOGLE_PUBSUB_TOPIC`
- `GOOGLE_PUBSUB_VERIFICATION_TOKEN`

### Meta / Instagram
- `META_APP_ID`
- `META_APP_SECRET`
- `META_WEBHOOK_VERIFY_TOKEN`

### Browser Worker
- `CREATOR_SEARCH_WORKER_BASE_URL`
- `CREATOR_SEARCH_WORKER_TOKEN`

### Observability
- `SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`

## 11. Security and Token Rules

- Store OAuth tokens only in an encrypted `ProviderCredential` table.
- Store shipping addresses and creator emails as encryptable fields; do not keep them in logs.
- Use `APP_ENCRYPTION_KEY` for application-level encryption of sensitive columns.
- Never let webhook handlers perform mutable side effects before signature verification.
- Never authorize platform routes with `getSession()` alone; use verified `getUser()` semantics in the SSR auth path.

## 12. Build Order Lock

### Phase 8 Implementation Sequence
1. App bootstrap
   - dependencies
   - app-level lib/actions/prisma structure
   - thin root layout preserved
2. Auth + tenancy foundation
   - Supabase middleware
   - login/signup
   - organization/client/brand/user/membership schema
3. Billing + gated onboarding
   - Stripe checkout
   - organization subscription state
   - brand creation wizard
4. Core campaign and creator state
   - campaigns
   - products
   - creators
   - approval queue
5. Inbox and outreach engine
   - threads, messages, drafts
   - Gmail sync/send
   - follow-up cadence
6. Shopify fulfillment integration
   - store connect
   - order create
   - delivery sync
7. Creator search runtime
   - worker service
   - live result ingest
   - ranking/review queue
8. Mentions + reminder loop
   - webhook ingest
   - poll fallback
   - post/non-post branching
9. Interventions + observability
   - exception queue
   - alerts
   - KPI health views
10. Migration + rollout
   - historical import
   - pilot brand cutover
   - parity verification

### Dependency Gates
- Do not start inbox logic before thread/message schema exists.
- Do not start order logic before brand/store/product config exists.
- Do not start live search UI before the worker claim/result contract is defined.
- Do not cut over a brand until parity checks pass for outreach, order creation, delivery, and mentions.

## 13. Parallel Implementation Lanes

This is the multi-agent execution shape for the actual build, not extra product architecture.

| Lane | Scope | Can Run In Parallel After |
|---|---|---|
| Lane A | auth, tenancy, billing foundation | bootstrap complete |
| Lane B | schema + provider credential model | bootstrap complete |
| Lane C | platform shell + route scaffolding | bootstrap complete |
| Lane D | inbox + Gmail integration | lanes A+B complete |
| Lane E | Shopify integration | lanes A+B complete |
| Lane F | creator search worker | lanes B+C complete |
| Lane G | mentions + reminder system | lanes B+E complete |
| Lane H | QA, observability, migration | lanes D+E+F+G in progress |

No two lanes should edit the same schema or middleware files without rereading current state first.

## 14. Coordination Notes

### Conflict Scan Result
- Phase 7 is the only active phase with concrete overlap in `apps/web`.
- It currently owns the marketing route files and `app/components/*`.
- Phase 8 must treat those files as high-conflict and avoid moving them during initial platform bootstrap.

### File Strategy
- Preserve existing marketing components in `apps/web/app/components`.
- Put new platform components under `apps/web/components/platform` and `apps/web/components/ui`.
- Keep root `app/layout.tsx` minimal so route-group layouts can diverge without a global merge battle.

## 15. Architecture Decisions Locked by 8a

1. The shipping runtime stays inside `apps/web`; there is no second backend app for v1.
2. Prisma moves inside `apps/web/prisma`, not repo root.
3. Route groups are `(marketing)`, `(auth)`, and `(platform)`.
4. Marketing migration into `(marketing)` is staged to avoid colliding with Phase 7.
5. Supabase Auth + SSR middleware protects the platform.
6. Inngest is the async control plane.
7. Meta marketplace search runs in a separate Playwright worker and is bridged from the app.
8. Stripe billing is organization-scoped.
9. Brand/provider credentials are encrypted database records, not env-only substitutions.
10. v1 stays gifting-first and email-first.
