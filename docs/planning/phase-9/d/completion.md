# Phase 9d — Completion Report

## Summary
Implemented billing, onboarding wizard, brand configuration, and Gmail OAuth provider connection flows.

## What was built

### 1. Stripe Billing
- **`lib/stripe.ts`** — Stripe client singleton (API version 2026-02-25.clover)
- **`/api/billing/checkout`** — POST handler that creates Stripe Checkout sessions for org subscriptions. Creates/reuses Stripe customer, redirects to hosted checkout. Success → onboarding, cancel → pricing.
- **`/api/billing/webhook`** — Stripe webhook handler with signature verification (graceful fallback when `STRIPE_WEBHOOK_SECRET` is empty). Handles: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. All events logged to `WebhookEvent` table.
- Uses Stripe v20+ types (period dates from `items.data[0]`, parent-based invoice subscription reference).

### 2. Onboarding Wizard
- **`/onboarding`** — 3-step client-side wizard with URL param navigation (`?step=brand|connect|done`)
  - Step 1: Brand name + website URL → creates Brand, BrandOnboarding, BrandSettings, BrandMembership
  - Step 2: Connect Shopify (placeholder with "coming soon" toast)
  - Step 3: Done → redirect to dashboard
- **`/api/onboarding/brand`** — POST handler that creates brand + associated records in a transaction

### 3. Brand Configuration
- **`/settings/brand`** — Client component form for editing brand name, website URL, logo URL
- **`/api/brands/[brandId]`** — GET (brand + settings + connections) and PATCH (update brand/settings) with auth + membership checks
- **`/api/brands/current`** — GET helper returning the user's first brand

### 4. Gmail Provider Connect
- **`/api/auth/gmail`** — Initiates Google OAuth flow with gmail.send, gmail.readonly, gmail.modify, userinfo.email scopes. Passes brandId in state param.
- **`/api/auth/gmail/callback`** — Exchanges code for tokens, fetches user email via Google userinfo API, encrypts refresh token with AES-256-GCM (`lib/encryption.ts`), stores as `ProviderCredential` (encrypted), creates `BrandConnection` and `EmailAlias` rows. All in a single transaction.
- **`/settings/connections`** — Shows connected providers per brand with status badges, "Connect Gmail" button, Shopify placeholder. Handles success/error feedback via URL params.

### 5. Settings Hub
- **`/settings`** — Updated to link to Brand and Connections sub-pages with card navigation

## Environment Variables Used
- `STRIPE_SECRET_KEY` — Stripe server key
- `STRIPE_STARTER_PRICE_ID` — Price ID for starter plan
- `STRIPE_WEBHOOK_SECRET` — Optional webhook signing secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Client-side Stripe key
- `NEXT_PUBLIC_APP_URL` — App base URL for redirects
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Gmail OAuth
- `APP_ENCRYPTION_KEY` — AES-256-GCM key for credential encryption

## Files Created/Modified
- `apps/web/lib/stripe.ts` (new)
- `apps/web/app/api/billing/checkout/route.ts` (new)
- `apps/web/app/api/billing/webhook/route.ts` (new)
- `apps/web/app/api/onboarding/brand/route.ts` (new)
- `apps/web/app/api/brands/[brandId]/route.ts` (new)
- `apps/web/app/api/brands/current/route.ts` (new)
- `apps/web/app/api/auth/gmail/route.ts` (new)
- `apps/web/app/api/auth/gmail/callback/route.ts` (new)
- `apps/web/app/(platform)/onboarding/page.tsx` (new)
- `apps/web/app/(platform)/settings/brand/page.tsx` (new)
- `apps/web/app/(platform)/settings/connections/page.tsx` (new)
- `apps/web/app/(platform)/settings/page.tsx` (modified)
- `docs/planning/phase-9/d/completion.md` (new)

## Validation
- `npm run web:build` ✅ passes
- All TypeScript strict checks pass
- No marketing site breakage
