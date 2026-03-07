# Seeding Web App (`apps/web`)

## Local run
1. `cd apps/web`
2. `cp .env.example .env.local`
3. Fill the required vars for the slice you are working on
4. `npm install`
5. `npm run dev`

## Current scope
- Marketing routes live under `app/(marketing)` and still resolve at `/` and `/pricing`
- Platform/auth scaffolds live under `app/(platform)` and `app/(auth)`
- Shared runtime scaffolds exist for Supabase SSR, Inngest, and Prisma placeholders

## Helpful scripts
- `npm run dev` — local app server
- `npm run build` — production build
- `npm run lint` — ESLint CLI
- `npm run db:generate` — Prisma client generation once schema exists
- `npm run db:push` — Prisma schema push once the database is configured
- `npm run inngest:dev` — local Inngest dev server for `/api/inngest`

---

## Architecture Decisions & Future Builds

### Gmail / Email Infrastructure

#### v1 Approach (current)
Each brand connects their own Gmail account via OAuth 2.0 ("Sign in with Google" flow).

How it works:
- Seed Scale owns one Google Cloud OAuth app (client ID + secret in env vars)
- The OAuth app's owner email is irrelevant — any Google account can authorize it
- When a brand clicks "Connect Gmail," they authenticate with **their** Google account
- Seed Scale stores their refresh token in `ProviderCredential` (AES-256-GCM encrypted)
- The platform sends and reads email on behalf of that brand's Gmail
- Google's OAuth verification is required before non-test accounts can authorize — submit verification early (2–6 week backlog)

During development: add up to 100 test Gmail addresses in the Google Cloud Console to bypass verification entirely.

#### Gmail OAuth Verification
The Google Cloud project belongs to Seed Scale. The consent screen displays "Seed Scale wants to access Gmail." Brands see this when connecting. Unverified apps are limited to 100 test users — fine for dev, required to remove before launch.

Required scopes:
- `https://www.googleapis.com/auth/gmail.send` — send on behalf of brand
- `https://www.googleapis.com/auth/gmail.readonly` — read inbound replies
- `https://www.googleapis.com/auth/gmail.modify` — mark messages read, label threads

#### v2+ Deliverability Suite (build later — see Instantly/Smartlead as reference)
The schema already supports this via the `EmailAlias` model (multiple aliases per brand).

What needs to be built:
1. **Multi-alias connect** — brands connect multiple Gmail accounts or Google Workspace aliases, each as a separate `EmailAlias` row with its own OAuth token
2. **Warm-up scheduler** — Inngest function that gradually ramps sending volume per alias (e.g. 5 emails day 1 → 50 emails day 30), writing `SendingMetric` rows for health tracking
3. **Sending rotation** — round-robin across healthy aliases per brand; skip aliases above daily limit, bounce rate threshold, or complaint rate threshold
4. **Alias health pausing** — auto-pause an alias when bounce >5% or complaint >0.1%, open `InterventionCase` for operator review
5. **Custom sending domains** — integrate Google Workspace or dedicated SMTP relay (Postfix/SES/Mailgun) instead of personal Gmail; unlocks higher volume per domain
6. **Inbox placement monitoring** — periodic seed tests to detect Gmail tab routing (Primary vs Promotions), surface in `SendingMetric`
7. **Unsubscribe/complaint webhooks** — handle Gmail FBL (Feedback Loop) events to auto-suppress complainers without waiting for a reply

This is a standalone phase (call it Phase 10 or "Deliverability Suite") — not blocking v1 pilot.

---

### Open Items / Build Later Reference

- [ ] **Email deliverability suite** (above) — warm-up, rotation, multi-alias, custom domains
- [ ] **Creator portal** — excluded from v1; creators interact only via email in v1
- [ ] **Paid deals / usage rights** — excluded from v1; gifting-only
- [ ] **DM automation** — excluded from v1; email is the canonical v1 outreach channel
- [ ] **Ad asset production workflows** — excluded from v1
- [ ] **Creator whitelisting** — excluded from v1
- [ ] **Shopify public app review** — v1 uses custom/private apps per brand; public app distribution requires Shopify Partner review
- [ ] **Root workspace config** — `workers/creator-search/` is self-contained (HTTP/JSON boundary only); if shared TS types are needed between packages, add `workspaces` field to root `package.json`
- [ ] **Meta/Instagram API verification** — business verification required before public webhook access; use test accounts during dev
