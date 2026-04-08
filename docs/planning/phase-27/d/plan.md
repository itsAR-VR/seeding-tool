# Phase 27d — Campaign Health Watchdog

## Focus

Build a lightweight campaign health monitoring system that replaces raw count dashboards with operational intelligence. A brand manager should open the dashboard and instantly know: "Campaign X is healthy. Campaign Y needs attention."

Confidence: **85%**

## Deep Sweep Corrections Applied

- [x] CRITICAL: `SendingMetric` has no `campaignId` field — cannot compute per-campaign outreach velocity from it. Use `CampaignOutcome.outreachSentAt` timestamps instead: count outcomes where `outreachSentAt` is within trailing 7-day window.
- [x] HIGH: Reply rate must use `CampaignOutcome` rows: filter by `outreachSentAt` within window, count `repliedAt IS NOT NULL` for reply rate.
- [x] HIGH: Integration health requires checking BOTH `BrandConnection.status` AND `ProviderCredential.isValid` + `expiresAt` for each provider.
- [x] HIGH: Reuse existing `computeConversionRates()` from `lib/analytics/conversion.ts` for lifecycle metrics. Don't reimp.
- [x] MEDIUM: InterventionCase deduplication — check if open/in_progress case of type "health_critical" already exists before creating new one.
- [x] MEDIUM: Fetch health data server-side in `dashboard/page.tsx` `Promise.all()` and pass as props — avoid client fetch waterfall.
- [x] MEDIUM: `mentionGap` query must exclude `opted_out` and `stalled` creators. Use `CampaignOutcome.deliveredAt IS NOT NULL AND postedAt IS NULL`.
- [x] MEDIUM: Define `HealthAlert` TypeScript type for the `alerts` JSON field.
- [x] LOW: Filter campaigns with `status IN ("active", "paused")` — paused campaigns may have in-flight creators.

## Inputs

- `apps/web/app/(platform)/dashboard/page.tsx` — existing dashboard (Server Component)
- `apps/web/prisma/schema.prisma` — `Campaign`, `CampaignCreator`, `CampaignOutcome`, `BrandConnection`, `ProviderCredential`, `InterventionCase`
- `apps/web/lib/analytics/conversion.ts` — `computeConversionRates()` (existing, reuse)
- `apps/web/lib/inngest/events.ts` — event types
- `apps/web/app/api/` — existing API patterns

## Skills Available

- `backend-coding-agent`, `frontend-coding-agent`, `tdd-guide`, `code-review`

## Work

### 1. Define HealthAlert Type

**New file**: `apps/web/lib/health/types.ts`

```ts
export type HealthAlert = {
  severity: "critical" | "warning" | "info";
  message: string;
  metric?: string;
  value?: number;
  threshold?: number;
};

export type HealthMetrics = {
  outreachVelocity: number;      // messages sent / day (trailing 7 days)
  replyRate: number;             // replies / sent (trailing 7 days)
  conversionRate: number;        // posted / delivered (all time, from computeConversionRates)
  pipelineBottlenecks: Array<{   // stages with high dwell time
    stage: string;
    count: number;
    avgDwellDays: number;
  }>;
  mentionGap: number;            // delivered creators with no mention (excludes opted_out/stalled)
  stalledCount: number;          // creators in "stalled" status
  integrationHealth: {
    gmail: boolean;
    shopify: boolean;
    instagram: boolean;
  };
};

export type HealthStatus = "healthy" | "warning" | "critical";
```

### 2. Add CampaignHealthSnapshot Model

**File**: `apps/web/prisma/schema.prisma`

```prisma
model CampaignHealthSnapshot {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now())
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id])
  status      String   // "healthy" | "warning" | "critical"
  metrics     Json     // HealthMetrics (typed in application code)
  alerts      Json     // HealthAlert[] (typed in application code)

  @@index([campaignId, createdAt])
  @@map("campaign_health_snapshots")
}
```

### 3. Health Check Cron

**New file**: `apps/web/lib/inngest/functions/campaign-health-check.ts`

Daily cron (`0 6 * * *` — 6 AM UTC):

For each active or paused campaign (`status IN ("active", "paused")` — paused campaigns may have in-flight creators), compute:

**Outreach velocity** — use `CampaignOutcome` rows (NOT `SendingMetric`, which has no `campaignId` field):
```ts
const sevenDaysAgo = subDays(new Date(), 7);
const recentOutreach = await prisma.campaignOutcome.count({
  where: {
    campaignId,
    outreachSentAt: { gte: sevenDaysAgo },
  },
});
const outreachVelocity = recentOutreach / 7;
```

**Reply rate** — also from `CampaignOutcome`:
```ts
const recentWithReply = await prisma.campaignOutcome.count({
  where: {
    campaignId,
    outreachSentAt: { gte: sevenDaysAgo },
    repliedAt: { not: null },
  },
});
const replyRate = recentOutreach > 0 ? recentWithReply / recentOutreach : 0;
```

**Conversion rate** — reuse `computeConversionRates()` from `lib/analytics/conversion.ts`:
```ts
import { computeConversionRates } from "@/lib/analytics/conversion";
// Fetch lifecycle breakdown for the campaign, pass to computeConversionRates
```

**Mention gap** — exclude opted_out and stalled creators:
```ts
const mentionGap = await prisma.campaignOutcome.count({
  where: {
    campaignId,
    deliveredAt: { not: null },
    postedAt: null,
    // Exclude terminal states via campaignCreator join
    campaignCreator: {
      lifecycleStatus: { notIn: ["opted_out", "stalled"] },
    },
  },
});
```

**Integration health** — check BOTH `BrandConnection.status` AND `ProviderCredential.isValid` + `expiresAt`:
```ts
const integrationHealth = {
  gmail: await checkIntegration(brandId, "gmail"),
  shopify: await checkIntegration(brandId, "shopify"),
  instagram: await checkIntegration(brandId, "instagram"),
};

async function checkIntegration(brandId: string, provider: string): Promise<boolean> {
  const connection = await prisma.brandConnection.findFirst({
    where: { brandId, provider, status: "connected" },
  });
  if (!connection) return false;

  const credential = await prisma.providerCredential.findFirst({
    where: {
      brandId,
      provider,
      isValid: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });
  return !!credential;
}
```

**Status calculation**:
- `"critical"`: reply rate < 2% OR integration down OR 0 sends in 48h
- `"warning"`: reply rate < 5% OR mention gap > 10 OR approaching daily limits (>80%)
- `"healthy"`: everything else

**Alerts**: typed `HealthAlert[]`:
- `{ severity: "warning", message: "Reply rate dropped to 3.2% (below 5% threshold)", metric: "replyRate", value: 0.032, threshold: 0.05 }`
- `{ severity: "critical", message: "Gmail connection expired — re-authenticate in Settings", metric: "integrationHealth.gmail" }`
- `{ severity: "warning", message: "12 creators delivered >14 days ago with no post", metric: "mentionGap", value: 12, threshold: 10 }`

**InterventionCase deduplication**: before creating a case for critical status, check if an open/in_progress case of type `"health_critical"` already exists for this campaign:
```ts
if (status === "critical") {
  const existingCase = await prisma.interventionCase.findFirst({
    where: {
      campaignId,
      type: "health_critical",
      status: { in: ["open", "in_progress"] },
    },
  });
  if (!existingCase) {
    await prisma.interventionCase.create({ ... });
  }
}
```

Persist `CampaignHealthSnapshot`.

### 4. Health API

**New route**: `apps/web/app/api/campaigns/[campaignId]/health/route.ts`

`GET` — returns latest `CampaignHealthSnapshot` for the campaign. Auth via `getCurrentBrandMembership()`.

**New route**: `apps/web/app/api/dashboard/health/route.ts`

`GET` — returns latest health snapshot for ALL campaigns of the current brand. Used by dashboard widget.

### 5. Dashboard Health Widget

**New file**: `apps/web/app/(platform)/dashboard/components/campaign-health.tsx`

`"use client"` component showing:
- Traffic light per campaign (green/yellow/red circle + campaign name)
- Click to expand: shows alerts and key metrics
- "View details" links to campaign analytics page

**File**: `apps/web/app/(platform)/dashboard/page.tsx`

Fetch health data **server-side** in `Promise.all()` and pass as props to avoid client fetch waterfall:
```ts
// In the Server Component
const [summaryData, healthSnapshots] = await Promise.all([
  fetchSummary(brandId),
  fetchHealthSnapshots(brandId),
]);

// Pass as props
<CampaignHealthWidget snapshots={healthSnapshots} />
```

### 6. Register Function

**File**: `apps/web/app/api/inngest/route.ts` — register `campaignHealthCheck`

### 7. Tests

- Test: healthy campaign (good reply rate, integrations connected) → status "healthy"
- Test: low reply rate (<5%) → status "warning" with alert
- Test: integration down (BrandConnection disconnected) → status "critical" with alert
- Test: integration expired (ProviderCredential.isValid=false OR expiresAt in past) → status "critical"
- Test: zero sends in 48h → status "critical"
- Test: mention gap >10 (excluding opted_out and stalled) → status "warning" with alert
- Test: health API returns latest snapshot for authenticated brand
- Test: dashboard API returns all campaign health for brand
- Test: intervention case created for critical status
- Test: **InterventionCase dedup** — no duplicate case created if open/in_progress "health_critical" exists
- Test: **Outreach velocity computed from CampaignOutcome.outreachSentAt** (not SendingMetric)
- Test: **Reply rate computed from CampaignOutcome.repliedAt** (not SendingMetric)
- Test: **computeConversionRates reused** from lib/analytics/conversion.ts
- Test: **Paused campaigns included** in health check (may have in-flight creators)
- Test: **HealthAlert type** — alerts array contains typed objects with severity, message, metric fields
- Test: **Server-side fetch** — dashboard page passes health data as props (no client waterfall)

## Output

(empty — to be filled after implementation)

## Handoff

The health watchdog is the foundation for the "air traffic control" concept from the 10x analysis. Future enhancements: Slack/email alerts on status change, weekly health digest email, trend lines (is health improving or degrading?).
