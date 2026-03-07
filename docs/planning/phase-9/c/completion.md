# Phase 9c Completion Report

**Status: COMPLETE**
**Build: PASS** (`npm run web:build` — 13 routes, 0 errors)
**Commit:** `feat(9c): auth, tenancy bootstrap, protected platform shell`

---

## What was built

### 1. Supabase Auth (SSR)
- `apps/web/lib/supabase/client.ts` — Browser client (existing, verified)
- `apps/web/lib/supabase/server.ts` — Server client with cookie handling (existing, verified)
- `apps/web/lib/supabase/middleware.ts` — **NEW** Session refresh + auth gate logic for proxy

### 2. Proxy (Middleware)
- `apps/web/proxy.ts` — Next.js 16 proxy convention (renamed from `middleware.ts`)
  - Refreshes Supabase session on every request
  - Protects `/dashboard`, `/campaigns`, `/inbox`, `/settings`, `/creators`, `/orders`
  - Redirects unauthenticated users to `/login?next=<path>`
  - Redirects authenticated users away from `/login` and `/signup` to `/dashboard`

### 3. Auth Route Group `(auth)/`
- `apps/web/app/(auth)/layout.tsx` — Minimal auth layout
- `apps/web/app/(auth)/login/page.tsx` — Email/password login form (shadcn components)
- `apps/web/app/(auth)/signup/page.tsx` — Signup with workspace name, calls bootstrap API
- `apps/web/app/(auth)/callback/route.ts` — Supabase auth callback (email confirmation, OAuth)

### 4. Tenancy Bootstrap
- `apps/web/lib/tenancy.ts`:
  - `bootstrapNewUser(supabaseId, email, orgName)` — Creates User + Organization + OrganizationMembership in a Prisma transaction
  - `getOrgForUser(userId)` — Fetches active org
  - `requireOrg(userId)` — Throws if no org
  - `getUserBySupabaseId(supabaseId)` — Lookup by Supabase auth id
- `apps/web/app/api/auth/bootstrap/route.ts` — POST endpoint called during signup (idempotent)

### 5. Protected Platform Shell
- `apps/web/app/(platform)/layout.tsx` — Server component with auth guard (redirect to /login), sidebar with nav
- Updated stub pages (Dashboard, Campaigns, Inbox, Settings) — shadcn Card styling

### 6. Prisma Client Fix
- `apps/web/lib/prisma.ts` — Updated to use `PrismaPg` adapter with `pg.Pool` (required by Prisma 7)

---

## Supabase Dashboard Config Needed

1. **Authentication → URL Configuration**:
   - Site URL: `https://seed-scale.vercel.app`
   - Redirect URLs:
     - `https://seed-scale.vercel.app/callback`
     - `http://localhost:3000/callback`

2. **Authentication → Email Templates** (optional):
   - Confirmation email should link to `{{ .SiteURL }}/callback?code={{ .Code }}&next=/dashboard`

3. **Authentication → Providers**:
   - Email provider: enabled (default)
   - Google OAuth: configure when ready (Client ID + Secret already in env)

---

## Route Map

| Route | Type | Auth | Description |
|---|---|---|---|
| `/` | Static | Public | Marketing home |
| `/pricing` | Static | Public | Pricing page |
| `/login` | Static | Public | Login form |
| `/signup` | Static | Public | Signup form |
| `/callback` | Dynamic | Public | Auth callback |
| `/api/auth/bootstrap` | Dynamic | Public | Tenancy bootstrap API |
| `/dashboard` | Dynamic | Protected | Dashboard |
| `/campaigns` | Dynamic | Protected | Campaigns |
| `/inbox` | Dynamic | Protected | Inbox |
| `/settings` | Dynamic | Protected | Settings |

---

## Ready for 9d: YES

All auth, tenancy, and shell infrastructure is in place. 9d can build on:
- Authenticated user context in server components via `createClient()` + `getUser()`
- Organization context via `tenancy.ts` helpers
- Platform layout with sidebar navigation
- API route pattern established with `/api/auth/bootstrap`
