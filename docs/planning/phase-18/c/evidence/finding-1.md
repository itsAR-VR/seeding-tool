# Finding 1 — Placeholder / test creator leakage

## Status
Resolved at the import guard layer and verified locally.

## Acceptance bar
Zero creators showing `1,500,000` uniform follower count in reviewed campaign data; import path no longer reintroduces creator-marketplace placeholder metrics.

## Concrete diff path
- `apps/web/app/api/creators/import/route.ts`
- `apps/web/lib/creators/follower-count.ts`

## Root cause
`/api/creators/import` sanitized imported follower counts using the hardcoded source `instagram_html` even when the underlying row/search result came from `creator_marketplace`. That meant a row with a fallback follower count of `1,500,000` could bypass the placeholder sanitizer and persist as if it were real data.

## What changed
- Added `isPlaceholderFollowerCount(...)` helper to make the marketplace placeholder check explicit and reusable.
- Updated `/api/creators/import` to resolve the effective follower-count source from `searchResult.primarySource ?? searchResult.source ?? row.discoverySource` before sanitizing.
- Added `placeholderSanitized` to the import response so QA/operators can see when placeholder rows were nulled instead of silently preserved.
- Removed duplicate `creatorSearchResult` fetches in the two import branches by loading it once per row before follower normalization.

## Verification
### Static verification
- `./node_modules/.bin/eslint "app/api/creators/import/route.ts" "lib/creators/follower-count.ts"` ✅

### Behavior verification
- `npx tsx -e "import { sanitizeFollowerCount, isPlaceholderFollowerCount } from './lib/creators/follower-count.ts'; ..."` ✅
  - `sanitizeFollowerCount('creator_marketplace', 1500000) -> null`
  - `sanitizeFollowerCount('collabstr', 1500000) -> 1500000`
  - `isPlaceholderFollowerCount('creator_marketplace', 1500000) -> true`

### Local DB state check
- Queried local DB counts after the guard landed:
  - `creatorPlaceholderCount: 0`
  - `profilePlaceholderCount: 0`
  - `campaignPlaceholderCount: 0`
- Command used local app env and Prisma via `tsx` to read current counts only. No data mutation performed.

## Remaining gap
This closes the reintroduction path and confirms the current local DB is clean. Postfix QA should still include one targeted import-path regression check that submits a marketplace-like row with `1,500,000` and confirms the API returns `placeholderSanitized > 0` while the stored follower count remains null.
