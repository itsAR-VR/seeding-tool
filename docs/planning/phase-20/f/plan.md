# Phase 20f — Feedback Loop, Outcome Learning & UI Provenance

## Focus

Close the loop. The current system is a finder that forgets everything after search. This subphase makes the seeding engine learn from outcomes: approvals, rejections, replies, deliveries, content quality, and payout efficiency. It also surfaces the full decision stack to the UI — provenance, score components, confidence bands, risk flags, and portfolio reasoning — so internal users can see exactly why each creator was found and ranked.

The user's directive: "The system should learn from approvals, rejections, replies, acceptances, delivery rate, content quality, and even payout efficiency. Without outcome memory, your search stack keeps behaving like a finder, not a seeding engine."

## Inputs

- Phase 20b: InfluencerIdentity, ContactPoint records
- Phase 20c: score decomposition (7 components), triage classification, fit reasoning
- Phase 20d: authenticity assessments, growth analysis, daily metrics
- Phase 20e: portfolio metrics, diversity analysis, portfolio explanation
- Current: CampaignCreator with reviewStatus + lifecycleStatus, outreachCount, lastOutreachAt, lastReplyAt
- Deep research report: "start logging these outcomes as features and labels"

## Skills Available for This Subphase

- `backend-coding-agent` — Outcome tracking, API design
- `database-design` — Outcome schema
- `vercel:nextjs` — UI components (Server Components)
- `superpowers:test-driven-development` — TDD

## Work

### 1. Campaign Outcome Model

**Schema — new model:**

```prisma
model CampaignOutcome {
  id                String   @id @default(cuid())
  campaignCreatorId String
  campaignId        String
  creatorId         String
  identityId        String?  // link to InfluencerIdentity for cross-campaign learning

  // ── Review outcomes ──
  reviewDecision    String?  // "approved" | "declined" | "deferred"
  reviewedAt        DateTime?
  reviewedBy        String?
  declineReason     String?  // "off_brand", "too_expensive", "low_engagement", "wrong_audience", etc.

  // ── Outreach outcomes ──
  outreachSentAt    DateTime?
  outreachMethod    String?  // "email" | "dm" | "agency"
  repliedAt         DateTime?
  replyType         String?  // "interested" | "declined" | "negotiating" | "no_response"
  responseTimeHours Float?   // hours from outreach to reply

  // ── Execution outcomes ──
  acceptedAt        DateTime?
  addressConfirmedAt DateTime?
  shippedAt         DateTime?
  deliveredAt       DateTime?
  postedAt          DateTime?
  completedAt       DateTime?
  optedOutAt        DateTime?
  stalledAt         DateTime?
  stallReason       String?

  // ── Quality signals ──
  contentQuality    String?  // "excellent" | "good" | "acceptable" | "poor" (human-rated)
  contentReach      Int?     // views/impressions of the posted content
  contentEngagement Float?   // engagement rate of the posted content
  costPerCreator    Float?   // total cost for this creator
  costPerEngagement Float?   // cost / engagements

  // ── Scoring context at time of seeding ──
  fitScoreAtSeed    Float?   // what the composite score was when seeded
  triageAtSeed      String?  // what the triage was when seeded
  scoreComponentsAtSeed Json? // full decomposition snapshot

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  campaignCreator   CampaignCreator @relation(fields: [campaignCreatorId], references: [id])
  campaign          Campaign        @relation(fields: [campaignId], references: [id])
  creator           Creator         @relation(fields: [creatorId], references: [id])

  @@unique([campaignCreatorId])
  @@index([campaignId])
  @@index([creatorId])
  @@index([identityId])
  @@index([reviewDecision])
}
```

### 2. Outcome Recording Pipeline

**New file: `lib/seeding/outcome-recorder.ts`**

Record outcomes from existing CampaignCreator lifecycle transitions:

```typescript
export async function recordOutcomeEvent(input: {
  campaignCreatorId: string;
  event: OutcomeEvent;
}): Promise<void>;

export type OutcomeEvent =
  | { type: "review"; decision: string; reason?: string; by: string }
  | { type: "outreach_sent"; method: string }
  | { type: "reply_received"; replyType: string }
  | { type: "accepted" }
  | { type: "address_confirmed" }
  | { type: "shipped" }
  | { type: "delivered" }
  | { type: "posted"; reach?: number; engagement?: number }
  | { type: "completed"; contentQuality?: string; costPerCreator?: number }
  | { type: "opted_out" }
  | { type: "stalled"; reason: string };
```

**Integration hooks** — add outcome recording to existing lifecycle transitions:

- `CampaignCreator.reviewStatus` changes → record review event
- `CampaignCreator.lifecycleStatus` changes → record lifecycle event
- When outreach is sent → record outreach event with method
- When content is posted → record content quality signals

### 3. Feature Derivation for Future ML

**New file: `lib/seeding/outcome-features.ts`**

Compute aggregate features from outcome history that become inputs to scoring:

```typescript
export interface CreatorOutcomeFeatures {
  // Across all campaigns for this identity
  totalCampaignsOffered: number;
  approvalRate: number;           // approved / (approved + declined)
  responseRate: number;           // replied / outreach_sent
  avgResponseTimeHours: number;
  acceptanceRate: number;         // accepted / replied
  completionRate: number;         // completed / accepted
  avgContentQuality: number;      // numeric encoding of quality ratings
  avgContentReach: number;
  avgCostPerEngagement: number;

  // Recency
  lastCampaignOutcomeAt: Date | null;
  daysSinceLastOutcome: number;
}

export async function computeOutcomeFeatures(identityId: string): Promise<CreatorOutcomeFeatures>;
```

These features feed into Phase 20c's scoring engine (specifically `computeContactability()` and a new `computeHistoricalPerformance()` feature that can be added once enough data accumulates).

### 4. Outcome-Based Score Calibration

**New file: `lib/seeding/score-calibration.ts`**

Analyze correlation between scores and outcomes to detect systematic bias:

```typescript
export interface CalibrationReport {
  // Per score component: how well does it predict good outcomes?
  componentCorrelations: Record<string, {
    correlationWithApproval: number;
    correlationWithCompletion: number;
    suggestedWeightAdjustment: number; // positive = increase weight, negative = decrease
  }>;
  // Overall calibration
  scoreVsApprovalCurve: Array<{ scoreBucket: string; approvalRate: number; count: number }>;
  // Recommendations
  suggestions: string[];
}

export async function generateCalibrationReport(campaignId?: string): Promise<CalibrationReport>;
```

This is not ML — it's descriptive statistics that help the team manually adjust weights until enough data exists for a proper learning-to-rank model (Phase 21+).

### 5. UI Provenance — Creator Card Enrichment

**Modify existing creator card/detail components to show:**

a. **Source provenance**: "Found via: Apify search (Mar 15), Collabstr import (Mar 10), Seed expansion from @janedoe (Mar 18)" — from CreatorDiscoveryTouch records

b. **Score decomposition**:
```
Fit Score: 0.82 (auto-shortlisted)
├── Topical Match:    0.90  ★★★★★  "beauty, skincare keywords in bio"
├── Engagement:       0.78  ★★★★   "4.2% ER, healthy for tier"
├── Authenticity:     0.85  ★★★★   "organic growth, 14-day trend stable"
├── Category:         0.75  ★★★★   "Beauty — high confidence"
├── Scale Fit:        0.95  ★★★★★  "12k followers, within 5k-50k band"
├── Identity:         0.70  ★★★★   "2 platforms linked, 3 sources"
└── Contactability:   0.60  ★★★    "public email (moderate confidence)"
```

c. **Confidence band**: "High confidence" / "Moderate — needs review" / "Low — insufficient data"

d. **Risk flags**: "Growth anomaly detected (Mar 20)", "Single source only", "Email may be stale (last verified 45 days ago)"

e. **Portfolio role**: "Selected for: nano tier diversity in Beauty category"

f. **Historical performance** (when available): "Previously seeded in 2 campaigns. Response rate: 100%. Completion rate: 50%."

**New API route: `app/api/creators/[creatorId]/provenance/route.ts`**

```typescript
// GET: Returns full provenance + score + risk for a creator
// Response:
{
  discoveryTouches: [...],
  scoreDecomposition: { ... },
  confidenceBand: "high" | "moderate" | "low",
  riskFlags: [...],
  portfolioRole: "...",
  outcomeHistory: [...],
  authenticityAssessment: { ... },
  growthAnalysis: { ... },
}
```

### 6. KPI Dashboard Data

**New API route: `app/api/analytics/seeding-kpis/route.ts`**

Surface the KPIs the user specified:

```typescript
{
  precisionTop20: number,            // % of top-20 seeded creators that were approved
  mergePrecision: number,            // % of auto-linked identity merges that are correct
  shortlistApprovalRate: number,     // approved / total shortlisted
  outreachReplyRate: number,         // replied / outreach sent
  costPerApprovedCreator: number,    // total spend / approved count
  costPerDeliveredCreator: number,   // total spend / delivered count
  validationUnknownRate: number,     // unknown validations / total validations
  timeToUsableSeedList: number,      // seconds from search start to seed list ready
}
```

### 7. Tests

- Unit tests for outcome recording (each event type)
- Unit tests for outcome feature computation (edge cases: zero campaigns, all declined, etc.)
- Unit tests for calibration report generation
- Integration test: full lifecycle (search → score → seed → approve → outreach → deliver → outcome recorded)
- Test: provenance API returns complete decision stack
- Test: KPI computation from real-ish outcome data

## Output

- New Prisma model: CampaignOutcome
- `lib/seeding/outcome-recorder.ts` — outcome event recording
- `lib/seeding/outcome-features.ts` — feature derivation from outcomes
- `lib/seeding/score-calibration.ts` — score-vs-outcome analysis
- `app/api/creators/[creatorId]/provenance/route.ts` — full provenance API
- `app/api/analytics/seeding-kpis/route.ts` — KPI dashboard data
- UI enrichment for creator cards (provenance, score decomposition, risk flags)
- Integration with existing CampaignCreator lifecycle hooks
- Test suite

## Handoff

Phase 20 is complete after this subphase. The system now has:

1. **Foundation**: 4-state validation, source confidence tiers, structured logging (20a)
2. **Identity**: canonical identity graph with evidence-based linking and review queue (20b)
3. **Scoring**: 7-dimension composite scoring with decomposition and triage (20c)
4. **Authenticity**: daily snapshots, growth analysis, anomaly detection (20d)
5. **Portfolio**: diversity-aware seed list optimization (20e)
6. **Feedback**: outcome tracking, calibration, UI provenance (20f)

**Phase 21+ candidates:**
- ML learning-to-rank model trained on outcome labels (requires 1-2 months of logged outcomes from 20f)
- YouTube Data API enrichment (official API, subscriber counts + topic details)
- TikTok Display API integration (creator-authorized, OAuth-based)
- Profile image perceptual hashing for identity matching (Phase 20b left this as a placeholder)
- Advanced NLP classification (embeddings for bio/caption analysis, replacing TF-IDF)
- Automated A/B testing of scoring weights via calibration report insights
