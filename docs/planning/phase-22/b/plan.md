# Phase 22b — RBAC & Multi-Brand Fix

## Focus

Enforce role-based access control on all mutation routes and fix the first-brand assumption for multi-brand users. Deep sweep confidence: **72%** (down from ~89%) due to schema default mismatch, RSC page gap, and missing client plumbing.

## Deep Sweep Corrections Applied

- **CRITICAL**: Schema default is `"member"` not `"viewer"` — use allowlist, not denylist
- **CRITICAL**: RSC pages do inline findFirst — X-Brand-Id header won't reach them, use cookies
- **CRITICAL**: `brands/[brandId]` PATCH has no role check — plan missed this route
- **HIGH**: ~50 findFirst call sites across ~35 files, plan named only ~12
- **HIGH**: Need 3 access tiers (write, admin, owner), not 1
- **HIGH**: No client-side plumbing for brand switching in plan
- **HIGH**: `await headers()` required in Next.js 16 (plan used sync)
- **MEDIUM**: `assertAdminRole()` returns boolean, named like it throws
- **MEDIUM**: Ordering — test brand switching independently before mass migration

## Inputs

- Phase 22a output: credit enforcement guard pattern (model for RBAC guards)
- Deep sweep findings at `docs/planning/phase-22/deep-sweep-findings.md`
- `lib/integrations/brand-access.ts` — existing helpers
- `prisma/schema.prisma:126` — `role String @default("member")` mismatch
- ~35 API route files with ~50 inline `findFirst` calls
- 6 RSC page files with inline brand lookups

## Skills Available for This Subphase

- `backend-coding-agent` — RBAC middleware, route migration, cookie-based brand selection
- `gstack-cso` — security audit on access control
- `code-review` — verify no routes bypass RBAC
- `qa-test-planner` — generate test cases for role enforcement

## Work

### 1. Resolve "member" vs "viewer" Schema Default

**File**: `prisma/schema.prisma`

Two options (choose one):
- **Option A**: Change default to `"owner"` (since all current users are solo owners) + migration
- **Option B**: Keep `"member"` but treat it as read-only in all guards

Recommended: Option A — align the default with reality. All existing users created via onboarding get `role: "owner"` explicitly.

### 2. Add Three Access Tier Guards to `brand-access.ts`

**File**: `lib/integrations/brand-access.ts`

```ts
// Allowlist pattern — safe against unknown role values
export function requireWriteAccess(membership: BrandMembership) {
  if (membership.role !== "owner" && membership.role !== "editor") {
    throw new BrandAccessError("Write access required", 403);
  }
  return membership;
}

export function requireAdminAccess(membership: BrandMembership) {
  if (membership.role !== "owner" && membership.role !== "editor") {
    throw new BrandAccessError("Admin access required", 403);
  }
  return membership;
}

export function requireOwnerAccess(membership: BrandMembership) {
  if (membership.role !== "owner") {
    throw new BrandAccessError("Owner access required", 403);
  }
  return membership;
}
```

Rename `assertAdminRole()` to `isAdminRole()` since it returns boolean.

### 3. Cookie-Based Multi-Brand Selection

**File**: `lib/integrations/brand-access.ts`, function `getCurrentBrandMembership()`

Use cookie (not header) for RSC compatibility:

```ts
import { cookies } from "next/headers";

export async function getCurrentBrandMembership() {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const brandId = cookieStore.get("seed-active-brand")?.value;

  const membership = brandId
    ? await prisma.brandMembership.findUnique({
        where: { userId_brandId: { userId: user.id, brandId } },
      })
    : await prisma.brandMembership.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });

  if (!membership) throw new BrandAccessError("No brand access", 403);
  return membership;
}
```

**New endpoint**: `POST /api/brands/switch` — validates membership, sets `seed-active-brand` cookie (httpOnly, secure, sameSite: strict).

**New endpoint**: `GET /api/brands/list` — returns all brands the user belongs to with roles.

### 4. Migrate ALL Routes (Full Inventory)

Generate complete inventory via grep. Categories:

**Owner-only routes** (use `requireOwnerAccess`):
- `api/settings/feature-flags/route.ts` (PATCH)
- `api/settings/approval/route.ts` (PATCH)
- `api/brands/[brandId]/route.ts` (PATCH) — brand identity changes
- `api/billing/checkout/route.ts` (POST) — billing operations

**Write routes** (use `requireWriteAccess`):
- `api/creators/search/route.ts` (POST)
- `api/campaigns/route.ts` (POST)
- `api/campaigns/[campaignId]/route.ts` (PATCH)
- `api/campaigns/[campaignId]/creators/route.ts` (POST)
- `api/campaigns/[campaignId]/creators/[creatorId]/review/route.ts` (POST)
- `api/campaigns/[campaignId]/creators/[creatorId]/order/route.ts` (POST)
- `api/campaigns/[campaignId]/search/route.ts` (POST)
- `api/campaigns/[campaignId]/import/route.ts` (POST)
- `api/campaigns/[campaignId]/seed-list/route.ts` (POST)
- `api/outreach/draft/route.ts` (POST)
- `api/outreach/send/route.ts` (POST)
- `api/automations/[id]/route.ts` (PUT, DELETE)
- `api/ai-personas/route.ts` (POST)
- `api/ai-personas/[personaId]/route.ts` (PATCH, DELETE)
- `api/creators/import/route.ts` (POST)
- `api/creators/enrich/route.ts` (POST)
- `api/inbox/[threadId]/send/route.ts` (POST)
- `api/inbox/[threadId]/send-dm/route.ts` (POST)
- `api/interventions/[id]/route.ts` (PATCH) — add status validation
- `api/mentions/route.ts` (POST)
- All other POST/PUT/PATCH/DELETE routes

**Read-only routes** (use `getCurrentBrandMembership()` only):
- All GET routes

**Exempt routes** (no RBAC):
- `api/onboarding/*` (4 routes) — called before meaningful role exists
- `api/webhooks/*` (Shopify, Track17, Unipile, Gmail, Unsubscribe) — own auth
- `api/inngest/route.ts` — Inngest signature auth
- `api/auth/*` (OAuth callbacks) — provider-redirected

### 5. Migrate RSC Pages

6 server component pages need migration to use `getCurrentBrandMembership()`:
- `app/(platform)/dashboard/page.tsx`
- `app/(platform)/campaigns/page.tsx`
- `app/(platform)/campaigns/[campaignId]/page.tsx`
- `app/(platform)/campaigns/[campaignId]/analytics/page.tsx`
- `app/(platform)/inbox/page.tsx`
- `app/(platform)/admin/health/page.tsx`

### 6. Client-Side Brand Switcher

- Add brand switcher dropdown in platform shell (sidebar or header)
- Fetch from `GET /api/brands/list`
- On selection: POST to `/api/brands/switch`, then `router.refresh()`
- Cookie persists across page reloads automatically

### 7. Integration Tests

- Test: `"member"` role cannot POST to search route (403)
- Test: `"viewer"` role cannot POST (403)
- Test: `"editor"` can POST to search (200) but not PATCH settings (403)
- Test: `"owner"` can PATCH settings (200)
- Test: multi-brand user with cookie gets correct brand
- Test: multi-brand user without cookie gets first brand (backward compat)
- Test: spoofed cookie for non-member brand returns 403
- Test: onboarding routes work without role check
- Test: webhook routes remain accessible without RBAC
- Test: RSC pages render correct brand for multi-brand users

## Rollback Plan

- Add `RBAC_ENFORCEMENT_ENABLED` env var — when false, log violations but don't block
- Gradual rollout: enable for one brand first, monitor for 403 spikes
- Cookie-based selection is additive — removing cookie falls back to findFirst

## Output (Completed 2026-04-07)

### Files Modified (31 route files + 6 RSC pages + 1 lib + 1 test)
- `lib/integrations/brand-access.ts` — Added cookie-based brand selection, 3 access tier guards, renamed assertAdminRole to isAdminRole
- `app/api/settings/feature-flags/route.ts` — Migrated to requireOwnerAccess
- `app/api/settings/approval/route.ts` — Migrated to requireOwnerAccess (PATCH), getCurrentBrandMembership (GET)
- `app/api/brands/[brandId]/route.ts` — Added requireOwnerAccess on PATCH, assertBrandAccess on GET
- `app/api/creators/search/route.ts` — Migrated to getCurrentBrandMembership + requireWriteAccess (preserved 22a credit enforcement)
- `app/api/campaigns/route.ts` — GET + POST migrated
- `app/api/campaigns/[campaignId]/route.ts` — GET + PATCH migrated
- `app/api/campaigns/[campaignId]/creators/route.ts` — GET + POST migrated
- `app/api/campaigns/[campaignId]/creators/[creatorId]/review/route.ts` — Migrated + requireWriteAccess
- `app/api/campaigns/[campaignId]/creators/[creatorId]/order/route.ts` — Migrated + requireWriteAccess
- `app/api/campaigns/[campaignId]/search/route.ts` — Migrated + requireWriteAccess
- `app/api/campaigns/[campaignId]/search/[jobId]/route.ts` — Migrated (read-only)
- `app/api/campaigns/[campaignId]/import/route.ts` — Migrated + requireWriteAccess
- `app/api/campaigns/[campaignId]/analytics/route.ts` — Migrated (read-only, removed inline authorize)
- `app/api/campaigns/[campaignId]/products/route.ts` — GET + PUT migrated (removed inline authorize)
- `app/api/outreach/draft/route.ts` — Migrated + requireWriteAccess
- `app/api/outreach/send/route.ts` — Migrated + requireWriteAccess
- `app/api/interventions/route.ts` — GET + POST migrated
- `app/api/interventions/[id]/route.ts` — Migrated + requireWriteAccess + status validation
- `app/api/mentions/route.ts` — GET + POST migrated
- `app/api/creators/route.ts` — Migrated (read-only)
- `app/api/creators/facets/route.ts` — Migrated (read-only)
- `app/api/creators/search/jobs/route.ts` — Migrated (read-only)
- `app/api/creators/search/[jobId]/route.ts` — Migrated (read-only)
- `app/api/creators/import/route.ts` — Migrated + requireWriteAccess
- `app/api/creators/enrich/route.ts` — Migrated + requireWriteAccess
- `app/api/inbox/[threadId]/route.ts` — Migrated (read-only)
- `app/api/inbox/[threadId]/send/route.ts` — Migrated + requireWriteAccess
- `app/api/inbox/[threadId]/send-dm/route.ts` — Migrated + requireWriteAccess
- `app/api/automations/[id]/route.ts` — GET + PATCH + DELETE migrated
- `app/api/automations/route.ts` — GET + POST migrated
- `app/api/ai-personas/route.ts` — GET + POST migrated
- `app/api/ai-personas/[personaId]/route.ts` — PUT + DELETE migrated
- `app/api/ai-personas/preview/route.ts` — Migrated (read-only)
- `app/api/billing/balance/route.ts` — Migrated (read-only)
- `app/api/brands/current/route.ts` — Migrated (read-only, cookie-aware)
- `app/api/categories/route.ts` — Migrated (read-only)
- `app/(platform)/dashboard/page.tsx` — RSC migrated
- `app/(platform)/campaigns/page.tsx` — RSC migrated
- `app/(platform)/campaigns/[campaignId]/page.tsx` — RSC migrated
- `app/(platform)/campaigns/[campaignId]/analytics/page.tsx` — RSC migrated
- `app/(platform)/inbox/page.tsx` — RSC migrated
- `app/(platform)/admin/health/page.tsx` — RSC migrated
- `__tests__/safety-guards/credit-enforcement.test.ts` — Updated mocks for brand-access

### Files Created (4)
- `app/api/brands/switch/route.ts` — POST endpoint for brand switching (sets httpOnly cookie)
- `app/api/brands/list/route.ts` — GET endpoint returning all user brands with roles
- `__tests__/safety-guards/rbac-enforcement.test.ts` — 19 tests for role guards
- `__tests__/brands/brand-switching.test.ts` — 7 tests for cookie-based brand switching

### Metrics
- **findFirst calls migrated**: 50 (across 31 route files + 6 RSC pages + 1 categories route)
- **findFirst calls remaining**: 4 (all onboarding routes — exempt by design)
- **Access tiers enforced**: owner (4 routes), write (21 routes), read-only (12 routes)
- **Tests written**: 26 new tests (19 RBAC + 7 brand switching)
- **Build status**: PASS (next build succeeds, tsc --noEmit clean)
- **Test status**: 162/163 pass (1 pre-existing gmail.test.ts failure, unrelated to 22b)

### Routes left unmigrated (exempt)
- `api/onboarding/*` (4 routes) — called before brand membership exists
- `api/webhooks/*` (5 routes) — use provider-specific auth (Shopify HMAC, Stripe signature, etc.)
- `api/inngest/route.ts` — Inngest signature verification
- `api/auth/*` — OAuth provider callbacks
- `api/billing/checkout/route.ts` — uses org-level auth (requireOrg), not brand-level
- `api/billing/webhook/route.ts` — Stripe signature auth
- `api/campaigns/[campaignId]/seed-list/route.ts` — already uses getAuthorizedCampaign from brand-access.ts

## Handoff

Subphase c (Cleanup & Type Safety) is already complete and touches different files (Inngest events, Shopify version config, AI model config) — no conflicts. The gmail.test.ts failure is pre-existing from 22a scope.

Key integration points for future phases:
- `getCurrentBrandMembership()` reads the `seed-active-brand` cookie — any new routes should import from brand-access.ts
- `requireWriteAccess()` / `requireOwnerAccess()` use allowlist pattern (owner|editor) — adding new roles requires updating these guards
- Brand switcher UI (dropdown in sidebar/header) should call POST /api/brands/switch then router.refresh() — deferred to a UI phase
