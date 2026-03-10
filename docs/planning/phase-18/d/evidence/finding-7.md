# Finding 7 — Metric labels ambiguous

## Status
Partially resolved.

## Acceptance bar
Labels clearly describe what they count.

## Files changed
- `apps/web/app/(platform)/campaigns/[campaignId]/page.tsx`

## What changed
- Renamed the campaign stat label from `Address` to `Address Confirmed` so the card reflects the actual lifecycle state being counted.

## Verification
- `./node_modules/.bin/eslint "app/(platform)/campaigns/[campaignId]/page.tsx"` ✅
- `npm run build` ✅
- Browser screenshot: `/home/podhi/.openclaw/media/browser/d56fedb5-87a9-4ca6-a398-9c4ea0706b6a.png` ✅

## Remaining gap
Only the most misleading label was corrected in this pass. Broader metric-label sweep / hover-help remains open if QA flags more ambiguity.
