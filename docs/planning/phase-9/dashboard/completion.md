# Dashboard — Phase 9 Completion

## What was built

Replaced the 3-card "Coming soon" stub at `apps/web/app/(platform)/dashboard/page.tsx` with a fully data-driven async server component dashboard.

### Architecture

- **Async server component** — all data fetched server-side via Prisma, no client-side loading spinners for main metrics
- **Brand-scoped** — all queries filtered by `brandId` from the user's `BrandMembership` (matching existing platform page patterns)
- **Auth** — Supabase → `getUserBySupabaseId` → `brandMembership.findFirst` → redirect to `/onboarding` if no brand

### Sections

#### 1. Metric Cards (4-across responsive grid)

| Card | Query |
|---|---|
| Active Campaigns | `Campaign.count({ where: { brandId, status: "active" } })` |
| Creators in Pipeline | `CampaignCreator.count({ where: { campaign: { brandId }, lifecycleStatus: { notIn: ["completed", "opted_out"] } } })` |
| Pending Interventions | `InterventionCase.count({ where: { brandId, status: { in: ["open", "in_progress"] } } })` — highlighted with red ring when > 0 |
| Orders in Transit | `ShopifyOrder.count({ where: { campaignCreator: { campaign: { brandId } }, status: { in: ["created", "processing", "shipped"] } } })` |

Each card: large number, label, contextual sublabel, emoji icon, shadcn `Card`.

#### 2. Two-column Layout

**Left (60%): Campaign Activity Feed**
- Last 5 non-archived campaigns, ordered by `updatedAt`
- Each row: campaign name (linked), status badge (color-coded), creator count, created date
- "View all campaigns →" footer link
- Empty state: "No campaigns yet" with "Create Campaign" CTA

**Right (40%): Action Queue (Interventions)**
- Latest 5 open/in-progress interventions
- Each row: type icon, title, status badge, date
- Links to `/interventions`
- Empty state: green "All clear" message

#### 3. Recent Mentions Strip

- Latest 6 `MentionAsset` records across all campaigns
- Horizontal grid: @handle, type badge (post/story/reel/video), date
- Empty state: "No mentions yet. Keep seeding."

### Status Badge Colors

- Campaign: `active` → green, `draft` → gray, `paused` → yellow, `completed` → blue
- Intervention: `open` → red, `in_progress` → orange, `resolved` → green
- Mention type: `post` → blue, `story` → purple, `reel` → pink, `video` → indigo

### Empty States

Every section has a graceful empty state with icon, title, description, and optional CTA. Zero "Coming soon" text anywhere.

### Performance

All 8 queries run in parallel via `Promise.all` for minimal latency.

## Files Changed

- `apps/web/app/(platform)/dashboard/page.tsx` — complete rewrite
- `docs/planning/phase-9/dashboard/completion.md` — this file
