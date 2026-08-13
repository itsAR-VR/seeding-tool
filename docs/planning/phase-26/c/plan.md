# Phase 26c — Campaign Analytics Dashboard Enhancement

## Focus

Enhance the existing 301-line campaign analytics page with interactive charts, conversion rate calculations, time-to-post distribution, creator leaderboard, date range filtering, and CSV export.

Confidence: **88%** (after corrections applied)

## Deep Sweep Corrections Applied

- [x] CRITICAL: No charting library in `package.json` — need to install `recharts` (best fit for React/shadcn)
- [x] HIGH: Plan claimed page is "minimal" — it's actually 301 lines with summary cards, lifecycle funnel bars, engagement metrics, cost overview. Rebaselined as ENHANCEMENT, not rebuild.
- [x] HIGH: Plan used 5 lifecycle stages — actual schema has 11 (ready, outreach_sent, replied, address_confirmed, order_created, shipped, delivered, posted, completed, opted_out, stalled)
- [x] HIGH: Page is a Server Component (async) but interactive features need Client Components. Architecture must be hybrid (RSC + client islands) following existing campaign sub-page patterns.
- [x] MEDIUM: Existing API route (182 lines) returns aggregate totals but NOT conversion rates, time-to-post distribution, per-creator engagement ranking, or date-filtered results. API needs enhancement.
- [x] MEDIUM: No CSV export pattern exists in codebase (only CSV import exists). Need to define approach.
- [x] MEDIUM: Test plan was incomplete (3 tests). Expanded to cover CSV, date filtering, leaderboard, empty states.
- [x] LOW: PDF report generation is unrealistic scope — no PDF library exists, removed from plan.
- [x] LOW: `@tanstack/react-query` in package.json but unused throughout app — use raw `fetch` + `useState` to match existing patterns.

## Inputs

- `apps/web/app/(platform)/campaigns/[campaignId]/analytics/page.tsx` (301 lines) — existing Server Component with summary cards, funnel bars, engagement, cost
- `apps/web/app/api/campaigns/[campaignId]/analytics/route.ts` (182 lines) — existing API returning lifecycle/review/mention/order breakdowns + `totalCostCents`
- `apps/web/prisma/schema.prisma`:
  - `CampaignCreator.lifecycleStatus` — 11 values
  - `CampaignOutcome` — timestamped milestones (outreachSentAt through completedAt)
  - `MentionAsset` — platform, type, likes, comments, views
  - `CostRecord` — type (product/shipping/platform_fee/other), amount (cents), currency
  - `ShopifyOrder` — totalPrice (cents), status
- `apps/web/lib/seeding/outcome-features.ts` — per-identity feature computation (responseRate, avgResponseTimeHours, etc.)
- `apps/web/app/api/analytics/seeding-kpis/route.ts` — brand-level KPIs reference

## Skills Available

- `frontend-coding-agent` — dashboard UI, recharts integration
- `backend-coding-agent` — aggregation API enhancement
- `tdd-guide` — test coverage
- `code-review` — post-implementation

## Work

### 0. Install Charting Library

```bash
cd apps/web && npm install recharts
```

`recharts` is the best fit: React-native, works with shadcn patterns, lightweight. Charts render as Client Components wrapped in the Server Component page.

### 1. Enhance Analytics API

**File**: `apps/web/app/api/campaigns/[campaignId]/analytics/route.ts`

Add to the response:

```ts
{
  // Existing fields preserved...
  
  // NEW
  conversionRates: {
    readyToOutreachSent: number,      // % of ready → outreach_sent
    outreachSentToReplied: number,    // % of outreach_sent → replied
    repliedToAddressConfirmed: number,
    addressConfirmedToOrderCreated: number,
    orderCreatedToShipped: number,
    shippedToDelivered: number,
    deliveredToPosted: number,
    overallConversion: number,         // % of ready → posted
  },
  timeToPost: number[],               // array of hours from outreachSentAt to postedAt
  creatorLeaderboard: Array<{
    creatorId: string,
    creatorName: string,
    handle: string,
    platform: string,
    totalLikes: number,
    totalComments: number,
    totalViews: number,
    mentionCount: number,
  }>,
  costsByType: Record<string, number>, // { product: cents, shipping: cents, ... }
}
```

Add query parameters: `from` (ISO date), `to` (ISO date) — filter `CampaignCreator.createdAt`.

### 2. Conversion Rate Calculation

Conversion rates computed from the 11-stage lifecycle:
- Primary path: ready → outreach_sent → replied → address_confirmed → order_created → shipped → delivered → posted → completed
- Terminal states: opted_out and stalled are dropout branches (shown separately)
- Each rate: `count_at_stage_N+1 / count_at_stage_N * 100`

### 3. Time-to-Post Distribution

Query `CampaignOutcome` records that have both `outreachSentAt` and `postedAt`. Compute `postedAt - outreachSentAt` in hours for each. Return as array for client-side histogram. Use `date-fns` (already in dependencies) for duration formatting.

### 4. Creator Leaderboard

Join `MentionAsset` with `CampaignCreator` + `Creator`. Group by creator, sum likes/comments/views. Sort by total engagement descending. Return top 20.

### 5. Dashboard UI Enhancement

**File**: `apps/web/app/(platform)/campaigns/[campaignId]/analytics/page.tsx`

Architecture: Keep as Server Component for initial data load. Extract interactive elements into Client Components:

**New file**: `apps/web/app/(platform)/campaigns/[campaignId]/analytics/components/`
- `funnel-chart.tsx` — `"use client"`, recharts `BarChart` showing all 11 lifecycle stages with counts + conversion rates. Opted_out/stalled shown as red bars.
- `time-to-post-chart.tsx` — `"use client"`, recharts `Histogram` or `BarChart` showing distribution of hours-to-post in buckets (0-24h, 1-3d, 3-7d, 7-14d, 14-30d, 30d+)
- `creator-leaderboard.tsx` — `"use client"`, raw HTML `<table>` matching existing app pattern. Sortable by likes, comments, views.
- `date-range-filter.tsx` — `"use client"`, date inputs that re-fetch from API with `from`/`to` params
- `cost-breakdown.tsx` — `"use client"`, recharts `PieChart` showing cost by type (product, shipping, platform_fee)
- `csv-export-button.tsx` — `"use client"`, downloads analytics as CSV

### 6. CSV Export

**New file**: `apps/web/lib/analytics/csv-export.ts`

Client-side CSV generation:
```ts
export function downloadCSV(data: AnalyticsData, filename: string): void {
  // Convert analytics data to CSV string
  // Create Blob with text/csv type
  // Create temporary <a> element, trigger click, revoke URL
}
```

Exports: lifecycle breakdown, conversion rates, cost summary, creator leaderboard. Reusable for future export needs across the platform.

### 7. Tests

- Test: conversion rates calculate correctly (each adjacent stage pair)
- Test: conversion rate handles zero creators at a stage (no divide-by-zero)
- Test: time-to-post distribution computed from CampaignOutcome timestamps
- Test: time-to-post handles missing outreachSentAt or postedAt gracefully
- Test: creator leaderboard sorted by total engagement descending
- Test: creator leaderboard handles campaigns with zero mentions
- Test: date range filter narrows API results
- Test: cost-by-type breakdown matches CostRecord aggregation
- Test: CSV export generates valid CSV with correct headers
- Test: empty campaign (zero creators) renders empty state, not error
- Test: all-opted-out campaign shows 0% conversion rates

## Output

(empty — to be filled after implementation)

## Handoff

Phase 26 complete. The platform now has automated mention detection (26a), multi-platform validation (26b), and campaign analytics (26c). The full seeding lifecycle is instrumented end-to-end.
