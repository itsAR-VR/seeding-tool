# Phase 26c — Campaign Analytics Dashboard

## Focus

Build a campaign analytics dashboard showing funnel visualization, conversion rates, cost per post, and creator leaderboard.

## Inputs
- `CampaignCreator.lifecycleStatus` — existing lifecycle stages
- `CampaignOutcome` — milestones with timestamps
- `MentionAsset` — engagement metrics from detected mentions
- `CostRecord` — product/shipping/fee costs
- `app/(platform)/campaigns/[campaignId]/analytics/page.tsx` — exists but minimal

## Skills Available for This Subphase
- `frontend-coding-agent` — dashboard UI, charts
- `backend-coding-agent` — aggregation API
- `code-review` — post-implementation

## Work

### 1. Analytics Aggregation API

**File**: `apps/web/app/api/campaigns/[campaignId]/analytics/route.ts`

Return:
- Funnel: count at each lifecycle stage (discovered → outreached → replied → shipped → posted)
- Conversion rates at each transition
- Time-to-post distribution
- Cost per post (total costs / posts received)
- Top creators by mention engagement

### 2. Dashboard UI

**File**: `apps/web/app/(platform)/campaigns/[campaignId]/analytics/page.tsx`

- Funnel visualization (horizontal bar chart)
- Conversion rate table
- Cost metrics cards
- Creator leaderboard (by engagement on seeded posts)
- Date range filter

### 3. Export

- CSV export of analytics data
- PDF report generation (stretch goal)

### 4. Tests
- Test: funnel counts match lifecycle status distribution
- Test: conversion rates calculate correctly
- Test: cost per post handles zero-post campaigns

## Output
- Campaign analytics dashboard with funnel, costs, and leaderboard
- Aggregation API for analytics data
- CSV export

## Handoff
Phase 26 complete. The platform now has automated mention detection, multi-platform validation, and campaign analytics. The full seeding lifecycle is instrumented end-to-end.
