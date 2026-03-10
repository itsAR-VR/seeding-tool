# Finding 3 — Review queue count mismatch

## Status
Resolved in code path used by the review page; verified locally on empty-state campaign.

## Acceptance bar
`discover → review` counts match exactly; source of mismatch identified and patched.

## Files changed
- `apps/web/app/(platform)/campaigns/[campaignId]/review/page.tsx`

## Root cause addressed
The page was fetching only pending creators and then using that filtered list for both the headline count and the rendered body. That made the empty state feel misleading once campaigns had already-reviewed creators, because the UI had no visibility into approved / declined / deferred totals.

## What changed
- Review page now fetches the full campaign creator list once.
- `pendingCreators` is derived from that single array.
- Headline count and rendered queue both use `pendingCreators`, so they cannot drift.
- Empty state now shows approved / declined / deferred totals plus a next-step CTA.

## Verification
### Static verification
- `./node_modules/.bin/eslint "app/(platform)/campaigns/[campaignId]/review/page.tsx"` ✅
- `npm run build` ✅

### Browser verification
- Review queue screenshot: `/home/podhi/.openclaw/media/browser/7d40430e-7585-44fc-9441-83f3792f55a6.png`
  - Verified headline shows `0 creators pending review`.
  - Verified empty state explains why pending can be empty.
  - Verified CTA `Discover more creators` is present.

## Notes
The local QA campaign used for visual verification has zero creators, so this is strongest as a code-level truth fix plus empty-state validation. A follow-up fixture with mixed reviewed states would strengthen behavioral proof for the QA lane.
