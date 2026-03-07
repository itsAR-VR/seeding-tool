# Phase 8a — Lock target system architecture, repo topology, dependency bootstrapping, and build sequence

## Focus
Turn the conversation and repo reality into one explicit system architecture: what runs where, what remains historical, how `apps/web` evolves into the shipping product, what dependencies must be installed, and in what order implementation happens.

## Inputs
- `docs/planning/phase-8/plan.md` (root plan with RED TEAM findings)
- `docs/seed-scale-handoff/README.md` (system overview, workflow inventory, deployment requirements)
- `docs/seed-scale-handoff/appendix/open-choices.md` (6 developer-discretion choice sets)
- `docs/seed-scale-handoff/appendix/decision-log.md` (10 accepted decisions + 5 open)
- `PRD.MD` (v1.0 workflow + v2.0 roadmap — note: assumes n8n continues; Phase 8 replaces it)
- `package.json` (root — audit tooling + Playwright devDeps)
- `apps/web/package.json` (Next.js 15, React 19, TypeScript only — zero backend deps)
- `apps/web/app/` directory structure (7 files: `page.tsx`, `pricing/page.tsx`, `layout.tsx`, + 4 components in `components/`)

## Work

### 1. Lock the runtime boundary
- `apps/web` is the single shipping app for both marketing and platform.
- Root `src/audit` remains historical tooling — read-only reference.
- No separate backend app is required before v1.
- The root `package.json` remains the workspace root for audit scripts and devDeps.

### 2. Lock the route group strategy (Phase 7 coordination)
- `apps/web/app/(marketing)/` — public marketing pages (homepage, pricing). Phase 7 owns this track.
- `apps/web/app/(platform)/` — authenticated platform dashboard. Phase 8 owns this track.
- `apps/web/app/api/` — shared API routes (webhooks, cron endpoints).
- `apps/web/app/lib/` — shared utilities (db client, auth helpers, provider clients).
- `apps/web/app/actions/` — shared server actions.
- Each route group gets its own `layout.tsx` so marketing and platform have independent shells.
- `apps/web/middleware.ts` — Supabase Auth middleware protecting `(platform)` routes.

### 3. Lock the target stack
- Framework: Next.js 16 App Router (upgrade from 15 to align with ZRG Dashboard reference)
- Auth: Supabase Auth (email + OAuth providers). Reference: `ZRG-Dashboard/middleware.ts`, `ZRG-Dashboard/lib/supabase/`
- Database: Supabase Postgres via Prisma 7.1 ORM. Reference: `ZRG-Dashboard/prisma/schema.prisma`
- Billing: Stripe (checkout, subscriptions, webhooks)
- AI: OpenAI API (chat completions for reply handling, address extraction, classification). Reference: `ZRG-Dashboard/lib/ai-drafts/`, `ZRG-Dashboard/lib/draft-pipeline/`
- Email: Gmail OAuth per-brand. Each brand connects their own Gmail account. Architecture supports multiple aliases per brand, per-account volume tracking, deliverability monitoring, warm-up schedules. Transactional service (Resend/SendGrid) as future scaling path for high-volume brands.
- Background jobs: Inngest (LOCKED). Reference: `ZRG-Dashboard/lib/inngest/`, `ZRG-Dashboard/lib/background-jobs/`
- Deployment: Vercel for the Next.js app + separate Docker worker (Railway/Fly/VPS) for browser automation (LOCKED)
- Browser automation: Playwright for Meta Creator Marketplace search worker (runs in Docker worker, NOT on Vercel)
- UI: Tailwind 4 + shadcn/ui + Radix primitives (align with ZRG Dashboard). Reference: `ZRG-Dashboard/components/ui/`, `ZRG-Dashboard/components/dashboard/`

### 4. Define the dependency bootstrapping checklist
All of these must be installed/configured before 8b can design against the schema:

```
# In apps/web — upgrade Next.js and add all platform dependencies:
npm install next@16 react@19 react-dom@19
npm install @supabase/supabase-js @supabase/ssr
npm install @prisma/client @prisma/adapter-pg
npm install -D prisma
npm install stripe @stripe/stripe-js
npm install inngest
npm install zod
npm install openai
npm install server-only

# UI framework (align with ZRG Dashboard):
npx shadcn@latest init
npm install tailwindcss@4 @tailwindcss/postcss
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react               # icon library

# Additional utilities:
npm install date-fns                   # date handling
npm install @tanstack/react-query      # server state management
npm install sonner                     # toast notifications
npm install react-hook-form @hookform/resolvers  # form handling

# In repo root:
npx prisma init --datasource-provider postgresql

# Config files to create:
apps/web/.env.local                    # all provider secrets
apps/web/.env.example                  # documented template (no secrets)
apps/web/middleware.ts                 # Supabase auth guard (reference ZRG-Dashboard/middleware.ts)
apps/web/lib/supabase/client.ts        # browser client (reference ZRG-Dashboard/lib/supabase/client.ts)
apps/web/lib/supabase/server.ts        # server client (reference ZRG-Dashboard/lib/supabase/server.ts)
apps/web/lib/supabase/middleware.ts     # middleware helper (reference ZRG-Dashboard/lib/supabase/middleware.ts)
apps/web/lib/inngest/client.ts         # Inngest client init (reference ZRG-Dashboard/lib/inngest/client.ts)
apps/web/lib/inngest/events.ts         # event type definitions (reference ZRG-Dashboard/lib/inngest/events.ts)
apps/web/app/api/inngest/route.ts      # Inngest route handler (reference ZRG-Dashboard/app/api/inngest/route.ts)
prisma/schema.prisma                   # database schema
```

### 5. Define the backend execution pattern
- Request handlers (server actions, route handlers) normalize fast, enqueue background jobs for any work >5s.
- No long-running AI, browser, or provider work inline in request handlers.
- Background jobs use the chosen runner (Inngest default) with idempotency keys, retry policies, and dead-letter handling.
- Webhook handlers normalize events into a `WebhookEvent` table before processing.

### 6. Define the provider strategy at the system level
- **Shopify**: Custom app (not deprecated private app) via OAuth + webhooks. Token stored encrypted in DB. Scopes per PRD section 3.0.
- **Gmail**: OAuth2 per-brand. Each brand connects their own Gmail account(s). Architecture supports multiple email aliases per brand (e.g., `collabs@brand.com`, `partnerships@brand.com`). Each alias has its own OAuth token stored encrypted via `ProviderCredential`. Rate limit: 2000 messages/day per account. Per-alias volume tracking and soft rate limiting (platform caps at 80% of Gmail hard limit). Warm-up schedule for new aliases: start at 50/day, increase 25% weekly. Deliverability monitoring: bounce rate, spam complaint rate per alias. Requires Google OAuth verification for production (plan for 2-6 week timeline in parallel with development). Future: transactional service (Resend/SendGrid) as upgrade path for high-volume brands.
- **Meta Creator Marketplace**: Dedicated Playwright worker service (NOT inline in Next.js). Runs as a separate process/container. Communicates with the app via internal API or job queue. Session management, CAPTCHA handling, and rate limiting are this worker's responsibility.
- **Meta/Instagram mentions**: Webhook (Instagram Graph API) + poll fallback via cron for accounts without webhook access.
- **OpenAI**: API client with retry, timeout (30s default), and structured output (JSON mode or function calling for address extraction).
- **Stripe**: Checkout Session for initial subscription, Customer Portal for management, webhooks for lifecycle events.

### 7. Define the build order for the product track
1. Auth + database bootstrapping (Supabase Auth + Prisma schema init)
2. Tenancy hierarchy (Organization, Client, Brand, User, Membership)
3. Billing integration (Stripe checkout + subscription gating)
4. Campaign CRUD + creator management
5. Outreach engine (email send, follow-up cadence, AI reply handling)
6. Inbox UI (conversation threads, AI draft suggestions)
7. Shopify integration (OAuth, order creation, fulfillment tracking)
8. Creator search (Meta browser worker + review queue)
9. Mentions tracking (webhook + poll + content capture)
10. Observability, migration, and rollout gates

### 8. Record skill invocations for this subphase
- `requirements-clarity` — lock scope before architecture
- `gepetto` — detailed implementation plan generation
- `multi-agent-patterns` — define how parallel execution agents work on the platform
- `backend-development` — server architecture patterns
- `phase-gaps` — already invoked (this RED TEAM pass)

## Output
- Completed artifact: `docs/planning/phase-8/a/architecture.md`
- Architecture decisions locked:
  - `apps/web` remains the single shipping runtime.
  - New platform runtime code lives under `apps/web/{lib,actions,components,prisma}`.
  - Prisma schema is colocated at `apps/web/prisma/schema.prisma`, not repo root.
  - Route groups are `(marketing)`, `(auth)`, and `(platform)`, with staged migration so Phase 7 marketing work is not disrupted.
  - Supabase Auth + SSR middleware protects platform routes.
  - Inngest is the async control plane; the Meta marketplace worker is a separate Playwright service bridged from the app.
  - Stripe billing is organization-scoped; Gmail/Shopify credentials are encrypted per brand/alias in DB.
- The artifact includes:
  - target repo topology and route separation strategy
  - runtime boundary table
  - provider auth/token-storage model
  - dependency/bootstrap checklist
  - environment variable inventory
  - ordered build sequence and parallel implementation lanes

## Coordination Notes

- Pre-flight conflict check run:
  - `git status --porcelain`
  - `ls -dt docs/planning/phase-* | head -10`
  - reread `docs/planning/phase-7/plan.md`, `docs/planning/phase-6/plan.md`, `docs/planning/phase-5/plan.md`
- Conflict detected:
  - Phase 7 actively owns `apps/web/app/page.tsx`, `apps/web/app/pricing/page.tsx`, `apps/web/app/components/*`, and the current `app/layout.tsx`.
- Resolution:
  - 8a explicitly avoids immediate movement of those files and adopts a staged route-group migration.
  - New platform runtime paths are isolated away from the existing marketing component directory.

## Validation Notes

- Context7 validation used for:
  - Next.js 16 App Router middleware, route handlers, and protected-route patterns
  - Supabase SSR server/browser client and middleware session-refresh patterns
- ZRG Dashboard reference checked for:
  - version family alignment
  - `middleware.ts`
  - `lib/inngest/client.ts`
  - `lib/inngest/events.ts`
  - `prisma/schema.prisma`

## Handoff
Subphase 8b should treat `docs/planning/phase-8/a/architecture.md` as the canonical systems contract. The schema work must now align to these specific decisions:

- tenancy and provider models live under `apps/web/prisma/schema.prisma`
- auth assumptions are Supabase SSR, not Auth.js or Clerk
- billing is organization-level Stripe
- Gmail is alias-aware and brand-scoped
- creator search requires a browser-worker bridge, so schema needs explicit job/result/provider-credential support
- route groups include `(auth)`, which means onboarding/auth state must be part of the domain model rather than bolted onto marketing routes later

8b should focus on entity design, enums, indexes, encryption boundaries, and config centralization. It should not reopen route, deployment, or runtime-boundary choices unless a hard contradiction appears in the source-of-truth docs.

## Validation (RED TEAM)
- Verify that every provider in the architecture has an explicit auth pattern, token storage strategy, and rate limit acknowledgment.
- Verify that the route group strategy doesn't conflict with Phase 7's existing work in `apps/web/app/components/`.
- Verify that the build order is achievable without circular dependencies.
- Verify that the `.env.example` template covers every provider secret referenced in the architecture.

## Skills Available for This Subphase
- `requirements-clarity`: available — use for scope locking
- `gepetto`: available — use for implementation plan generation
- `multi-agent-patterns`: available — use for parallel agent architecture
- `backend-development`: available — use for server patterns
- `context7-docs`: available — use for up-to-date Next.js/Supabase/Prisma docs
- `find-local-skills`: UNAVAILABLE (wrong machine) -> fallback: use conversation skill list
- `find-skills`: UNAVAILABLE -> fallback: manual skill list check

## Assumptions / Open Questions (RED TEAM)
- Prisma schema lives at `prisma/schema.prisma` (repo root) rather than inside `apps/web/`.
  - Why it matters: affects import paths and build configuration.
  - Current default: repo root `prisma/` directory.
- Stack aligns with ZRG Dashboard (Next.js 16, Tailwind 4, shadcn/ui, Prisma 7.1, Inngest 3.52). If Next.js 15 must be kept, patterns still apply but some APIs may differ.
  - Why it matters: matching the reference architecture reduces implementation guesswork.
  - Current default: upgrade to Next.js 16.
