# Finding 2 — Missing product guardrail before outreach send

## Status
Partially resolved and verified locally.

## Acceptance bar
UI explicitly blocks draft outreach/send when no Shopify product is attached; error message actionable.

## Files changed
- `apps/web/app/(platform)/campaigns/[campaignId]/page.tsx`
- `apps/web/app/(platform)/campaigns/[campaignId]/outreach/page.tsx`

## What changed
- Added an operator-readiness card to the campaign detail page.
- Disabled the top-level `Draft Outreach` entry point when required setup is missing.
- Added actionable CTA buttons (`Add products`, `Open review queue`, `Open connections`).
- Added outreach-page readiness gating and an inline blocker message that prevents draft generation without campaign products.

## Verification
### Static verification
- `./node_modules/.bin/eslint "app/(platform)/campaigns/[campaignId]/page.tsx" "app/(platform)/campaigns/[campaignId]/outreach/page.tsx"` ✅
- `npm run build` ✅

### Browser verification
Local dev server: `http://localhost:3000`
- Campaign detail screenshot: `/home/podhi/.openclaw/media/browser/d56fedb5-87a9-4ca6-a398-9c4ea0706b6a.png`
  - Verified `Draft Outreach blocked` button is disabled.
  - Verified readiness card shows missing products / approved creators / send channels.
  - Verified action CTAs are visible.
- Outreach page screenshot: `/home/podhi/.openclaw/media/browser/5dbddc81-ba56-4642-894d-15a125976c80.png`
  - Verified readiness card appears at top of page.
  - Verified `Add products` CTA is visible.
  - Verified orange blocker copy appears above the disabled `Generate Drafts (0)` action.

## Remaining gap
This turn verifies the zero-product blocked path. Send-button behavior with non-zero drafts still needs QA on a campaign that has approved creators but missing products/integration state.
