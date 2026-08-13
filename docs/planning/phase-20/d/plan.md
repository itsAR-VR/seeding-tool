# Phase 20d — Time-Series Metrics & Authenticity Signals

## Focus

Add daily metrics snapshots per platform profile so the system can compute growth velocity, detect anomalies, and score authenticity. Without time-series data, "is this creator trustworthy?" is guesswork. This subphase builds the snapshot infrastructure, anomaly detection, and authenticity assessment pipeline — then wires these signals into the scoring engine from Phase 20c.

The user explicitly called this out: "time series is not a nice-to-have here; it is part of identification quality."

## Inputs

- Phase 20b: InfluencerPlatformProfile (the profile records snapshots attach to)
- Phase 20c: scoring engine with placeholder inputs for `growthAnomalyScore`, `botRiskScore`, `recentEngagementTrend`
- Current data: Creator.followerCount, Creator.avgViews, CreatorProfile.followerCount, CreatorProfile.engagementRate (point-in-time, no history)
- Deep research report: proposed InfluencerMetricsDaily + InfluencerAuthenticityAssessment tables

## Skills Available for This Subphase

- `database-design` — Time-series schema design
- `backend-coding-agent` — Snapshot jobs, anomaly detection
- `vercel:cron-jobs` — Scheduled snapshot execution
- `vercel:workflow` — Durable enrichment workflows
- `superpowers:test-driven-development` — TDD for anomaly detection

## Work

### 1. Metrics Snapshot Schema

```prisma
model InfluencerMetricsDaily {
  id              String   @id @default(cuid())
  profileId       String
  date            DateTime @db.Date  // day-level granularity
  followers       Int?
  following       Int?
  posts           Int?
  avgViews        Int?
  engagementRate  Float?
  likes           Int?     // total or avg recent
  comments        Int?     // total or avg recent
  source          String   // "validator", "apify_profile", "api_youtube", etc.
  sourceConfidence Float   // inherited from source-confidence.ts
  createdAt       DateTime @default(now())

  profile         InfluencerPlatformProfile @relation(fields: [profileId], references: [id])

  @@unique([profileId, date])
  @@index([profileId, date])
  @@index([date])
}

model InfluencerAuthenticityAssessment {
  id                  String   @id @default(cuid())
  profileId           String
  computedAt          DateTime @default(now())
  authScore           Float    // composite authenticity 0-1
  botRiskScore        Float    // 0 = definitely human, 1 = definitely bot
  growthAnomalyScore  Float    // 0 = organic, 1 = highly anomalous
  engagementQualityScore Float // 0 = fake engagement, 1 = genuine
  modelVersion        String   // versioning for reproducibility
  notesJson           Json?    // detailed breakdown of signals
  inputSnapshotCount  Int      // how many daily snapshots were used

  profile             InfluencerPlatformProfile @relation(fields: [profileId], references: [id])

  @@index([profileId, computedAt])
  @@index([authScore])
}
```

### 2. Daily Snapshot Collection Job

**New file: `lib/inngest/functions/collect-daily-snapshots.ts`**

This Inngest function runs on a cron schedule (once daily) and collects metrics for active profiles:

```typescript
// Triggered by cron: "0 6 * * *" (6 AM UTC daily)
// Or by event: "metrics/snapshot-requested"

export const collectDailySnapshots = inngest.createFunction(
  {
    id: "collect-daily-snapshots",
    concurrency: { limit: 1 },
    retries: 2,
  },
  { cron: "0 6 * * *" },
  async ({ step }) => {
    // Step 1: Identify profiles needing snapshots
    //   - All profiles linked to active campaigns (CampaignCreator where lifecycleStatus not terminal)
    //   - All profiles with recent search results (last 7 days)
    //   - Limit: 500 profiles per run to stay within Inngest budget

    // Step 2: Batch collect via existing Apify profile scraper
    //   - Reuse lib/apify/client.ts profile scraper
    //   - Extract: followers, following, posts, engagementRate
    //   - Rate limit: respect Apify actor concurrency

    // Step 3: Upsert InfluencerMetricsDaily records
    //   - One row per profile per day
    //   - If row already exists for today, update with newer source if higher confidence

    // Step 4: Log collection stats
  }
);
```

**Opportunistic snapshots** — also collect snapshots as a side-effect of existing operations:
- When validator runs (follower count is already extracted) → snapshot
- When Apify search returns profile data → snapshot
- When enrichment runs → snapshot

**New file: `lib/metrics/snapshot.ts`**

```typescript
export async function recordMetricsSnapshot(input: {
  profileId: string;
  date: Date;
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  avgViews?: number | null;
  engagementRate?: number | null;
  source: string;
}): Promise<void>;

// Opportunistic — call from validator, Apify client, enrichment
export async function recordOpportunisticSnapshot(
  handle: string,
  platform: string,
  metrics: Partial<MetricsInput>,
  source: string,
): Promise<void>;
```

### 3. Growth Velocity & Anomaly Detection

**New file: `lib/metrics/anomaly-detection.ts`**

Compute growth signals from the daily time series:

```typescript
export interface GrowthAnalysis {
  velocityDaily: number;         // avg daily follower change (last 14 days)
  velocityWeekly: number;        // avg weekly follower change (last 8 weeks)
  accelerationTrend: "accelerating" | "steady" | "decelerating" | "insufficient_data";
  anomalyScore: number;          // 0 = organic, 1 = highly anomalous
  anomalySignals: AnomalySignal[];
}

export interface AnomalySignal {
  type: "spike" | "staircase" | "drop" | "engagement_divergence" | "suspicious_ratio";
  severity: "low" | "medium" | "high";
  description: string;
  detectedAt: Date;
  value: number;
}

export function analyzeGrowth(snapshots: InfluencerMetricsDaily[]): GrowthAnalysis;
```

**Anomaly detection rules (heuristic, no ML):**

1. **Spike detection**: >10% follower increase in a single day (outside of viral content evidence)
2. **Staircase pattern**: 3+ sequential equal-sized jumps (signature of purchased followers)
3. **Engagement divergence**: follower growth without proportional engagement growth
4. **Suspicious ratios**: following/follower ratio > 2.0, or engagement rate suspiciously high (>15%) or low (<0.1%)
5. **Drop detection**: >5% follower loss in a day (cleanup event = previously had fakes)

### 4. Authenticity Assessment Pipeline

**New file: `lib/metrics/authenticity.ts`**

```typescript
export interface AuthenticityInput {
  snapshots: InfluencerMetricsDaily[];  // at least 7 days preferred
  validationStatus: string;
  sourceConfidence: number;
  isVerified: boolean;
  followerCount: number | null;
  followingCount: number | null;
  postCount: number | null;
  engagementRate: number | null;
}

export interface AuthenticityResult {
  authScore: number;              // 0-1 composite
  botRiskScore: number;           // 0-1
  growthAnomalyScore: number;     // 0-1
  engagementQualityScore: number; // 0-1
  modelVersion: string;
  notes: AuthenticityNote[];
}

export function assessAuthenticity(input: AuthenticityInput): AuthenticityResult;
```

**Scoring formula:**

```
botRiskScore = weighted_sum(
  0.30 * (followingToFollowerRatio > 2.0 ? 1 : ratio / 2),
  0.25 * (postFrequency < 0.5/week for 30 days ? 0.8 : 0),
  0.20 * (profileIncomplete ? 0.6 : 0),  // no bio, no image, no website
  0.25 * spikeCount / maxExpectedSpikes,
)

growthAnomalyScore = anomalyDetection.anomalyScore  // from growth analysis

engagementQualityScore = 1 - abs(engagementRate - expectedRateForTier) / expectedRateForTier
  // where expectedRateForTier is derived from follower count band

authScore = (1 - botRiskScore) * 0.35
          + (1 - growthAnomalyScore) * 0.35
          + engagementQualityScore * 0.20
          + (isVerified ? 0.10 : sourceConfidence * 0.10)
```

### 5. Wire into Scoring Engine

**Update `lib/creator-search/scoring/features.ts`:**

The Phase 20c placeholders become real:

```typescript
export function computeEngagementQuality(input: {
  // ... existing fields ...
  recentEngagementTrend?: "improving" | "stable" | "declining";
  viewToFollowerRatio?: number;
  snapshotCount?: number;
}): { score: number; signals: string[] };

export function computeAuthenticity(input: {
  // ... existing fields ...
  growthAnomalyScore?: number;
  botRiskScore?: number;
  engagementQualityScore?: number;
  snapshotCount?: number;
}): { score: number; signals: string[] };
```

When snapshots exist (snapshotCount > 0), authenticity scoring is evidence-based. When snapshots are absent, it falls back to the heuristic-only approach from Phase 20c.

### 6. Scheduled Assessment Job

**New Inngest function: `lib/inngest/functions/compute-authenticity.ts`**

Runs after daily snapshots complete:

```typescript
// Triggered by: "metrics/snapshots-collected" event
// For each profile with ≥7 snapshots: compute authenticity assessment
// Store result in InfluencerAuthenticityAssessment
// Update scoring features cache
```

### 7. Cron Configuration

Add to `vercel.json` (or `vercel.ts`):

```json
{
  "crons": [
    { "path": "/api/inngest", "schedule": "0 6 * * *" }
  ]
}
```

The cron triggers the Inngest event that starts the snapshot collection chain.

### 8. Tests

- Unit tests for growth velocity computation (steady growth, spike, staircase, organic)
- Unit tests for anomaly detection (each of the 5 detection rules)
- Unit tests for authenticity assessment (high-auth, low-auth, bot-like, insufficient data)
- Unit tests for scoring engine integration (with and without snapshots)
- Integration test: snapshot → growth analysis → authenticity → score update pipeline
- Edge case: profile with only 1-2 snapshots (insufficient data graceful degradation)

## Output

- New Prisma models: InfluencerMetricsDaily, InfluencerAuthenticityAssessment
- `lib/metrics/snapshot.ts` — snapshot recording (scheduled + opportunistic)
- `lib/metrics/anomaly-detection.ts` — growth analysis + anomaly detection
- `lib/metrics/authenticity.ts` — composite authenticity assessment
- `lib/inngest/functions/collect-daily-snapshots.ts` — daily cron job
- `lib/inngest/functions/compute-authenticity.ts` — post-snapshot assessment
- Updated scoring engine features to consume authenticity signals
- Cron configuration
- Test suite

## Handoff

Phase 20e builds portfolio construction on top of the full scoring engine. With authenticity scores now available, the portfolio optimizer can balance not just topic and tier diversity but also risk — avoiding seed lists that are concentrated in low-authenticity or insufficient-data creators. The time-series data also enables the "explain why we trust this creator" UI requirement in Phase 20f.
