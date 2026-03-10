# Finding 8 — Empty-state dead ends

## Status
Resolved for the campaign review flow; reinforced on campaign detail.

## Acceptance bar
Every empty state has at least one primary CTA routing to the correct next action.

## Files changed
- `apps/web/app/(platform)/campaigns/[campaignId]/review/page.tsx`
- `apps/web/app/(platform)/campaigns/[campaignId]/page.tsx`

## What changed
- Review queue empty state now explains why pending can be empty and includes `Discover more creators`.
- When approved creators exist, the same state will expose `Open draft outreach`.
- Campaign detail empty creators state already had CTAs; the new readiness card now adds setup CTAs for products, review, and connections.

## Verification
- `./node_modules/.bin/eslint "app/(platform)/campaigns/[campaignId]/review/page.tsx" "app/(platform)/campaigns/[campaignId]/page.tsx"` ✅
- `npm run build` ✅
- Review screenshot: `/home/podhi/.openclaw/media/browser/7d40430e-7585-44fc-9441-83f3792f55a6.png` ✅
- Campaign detail screenshot: `/home/podhi/.openclaw/media/browser/d56fedb5-87a9-4ca6-a398-9c4ea0706b6a.png` ✅

## Remaining gap
This pass covers review/campaign empty states. Other empty states across the app still need the broader QA sweep described in subphase d.
