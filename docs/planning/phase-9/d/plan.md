# Phase 9d — Implement billing, onboarding, brand configuration, and provider connection flows

## Focus
Build the self-serve activation path from authenticated user to launch-ready brand: Stripe billing, onboarding wizard, templates/products/config, and the first provider connection flows.

## Inputs
- `docs/planning/phase-9/plan.md`
- `docs/planning/phase-9/c/plan.md`
- `docs/planning/phase-8/finalplan.md`
- `docs/planning/phase-8/d/product-surfaces.md`
- `docs/planning/phase-8/e/rollout.md`
- `apps/web/prisma/schema.prisma`
- `(platform)` shell and auth flows from 9c

## Skills Available for This Subphase
- `find-local-skills` output: unavailable on this machine (missing local index); fallback to manual skill selection.
- `find-skills` output: unavailable on this machine; fallback to confirmed local skills only.
- Planned invocations:
  - `backend-development`
  - `context7-docs`
  - `frontend-design`
  - `react-dev`
  - `javascript-typescript`

## Work

### 1. Implement Stripe subscription flow
- Add plan selection UI.
- Add checkout launch flow.
- Add Stripe webhook handler and subscription-state sync.
- Gate platform progress where the plan contract requires it.

### 2. Implement the onboarding wizard
- Add step routes and persistent/resumable writes for:
  - organization
  - client
  - brand
  - plan
  - Shopify connect
  - Gmail connect
  - Meta connect
  - templates/voice
  - products
  - seed creators
  - first campaign
  - launch review
- Every step must write to a real Phase 9 schema entity.

### 3. Implement brand configuration management
- `BrandSettings`
- `OutreachTemplate`
- `BrandProduct`
- `DiscoverySeed`
- launch-readiness checks

### 4. Implement provider connection entry flows
- Shopify connect/callback scaffolding
- Gmail connect/callback scaffolding
- Meta/Instagram connection scaffolding
- Store real connection rows and credentials, even if some downstream processing lands in later subphases

### 5. Implement settings surfaces required by onboarding
- organization/billing page
- brand settings page
- brand product management
- template editor
- alias/connect placeholders if full alias UX waits until 9e

### 6. Enforce launch readiness
- Define and implement the gating checks that determine when a brand can launch its first campaign.
- Surface missing prerequisites clearly in UI rather than silently blocking.

### 7. Validation
- `npm run web:build` (from repo root)
- Stripe webhook route smoke path (use Stripe CLI `stripe listen --forward-to`)
- onboarding step persistence sanity check
- verify onboarding resume behavior after refresh/navigation

## Validation (RED TEAM)
- Stripe products/prices must exist in Stripe dashboard before checkout can work
- Shopify custom app must be created in Partner Dashboard before OAuth connect works
- Gmail OAuth consent screen must exist in Google Cloud Console before connect works
- Onboarding must handle partial completion gracefully (user abandons at step 5, returns later)
- Stripe webhook signature verification must be tested with real `stripe-signature` headers
- Provider credentials must be encrypted via the 9b encryption helpers, not stored in plaintext

## Output
- A real self-serve activation path exists from signup through first brand/campaign readiness.
- Billing, config, and provider connection state are stored in canonical runtime tables.

## Handoff
Phase 9e should assume onboarding can produce a real launch-ready brand and should build the operational creator/campaign/inbox lifecycle on top of that state rather than adding alternate config paths.

## Assumptions / Open Questions (RED TEAM)
- Stripe is in test mode during development. Live mode switch is a deployment-time config change.
  - Why it matters: test mode uses test card numbers and separate webhook secrets.
  - Current default: test mode throughout Phase 9.
- Shopify custom app, not embedded app. Single-brand initially, not app store distribution.
  - Why it matters: embedded apps require Shopify App Bridge and additional review.
  - Current default: custom app with direct OAuth.
