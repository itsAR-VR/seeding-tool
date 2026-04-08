# Seeding OS — Core Functionality Spec

> **This is the canonical reference for what the platform must do.**
> All QA, deep sweeps, and implementation decisions should validate against this lifecycle.
> Last audited: 2026-04-08 against commit 6146364.

## The Seeding Lifecycle

```
1. IDENTIFY creators for a brand's niche
2. APPROVE them (AI scoring + human review)
3. OUTREACH via email, Instagram DM, TikTok DM
4. COMMUNICATE to get their shipping address
5. SHIP product via Shopify + 3PL
6. TRACK delivery
7. DETECT content (mentions, tags, posts)
8. FOLLOW UP if no content posted after delivery
9. ARCHIVE and measure posted content
```

## Step-by-Step Flow

### Step 1: Identify Creators
**What it does**: Multi-source discovery pipeline finds Instagram creators matching brand niche.
**Code**: `orchestrator.ts` → 4 parallel lanes (stored DB, Apify search, seed following, keyword email) → enrich → classify (16 categories + LLM fallback) → validate (Playwright) → score (decision engine) → persist as `CampaignCreator`
**Lifecycle**: Creates `CampaignCreator` with `reviewStatus: "pending"`, `lifecycleStatus: "ready"`
**Status**: WORKS

### Step 2: Approve for Brand Niche
**What it does**: Human reviews AI-scored creators and approves/declines/defers.
**Code**: `POST /api/campaigns/[campaignId]/creators/[creatorId]/review` → RBAC → update `reviewStatus`
**Lifecycle**: Approved → `reviewStatus: "approved"`, `lifecycleStatus: "ready"`
**Status**: WORKS

### Step 3: Brand Context Ingestion
**What it does**: Scrapes brand website, synthesizes Business DNA via AI, derives ICP for scoring and drafting.
**Code**: `brands/profile.ts` → `brands/synthesis.ts` → `brands/icp.ts` → stored in `BrandSettings.brandProfile`
**Status**: WORKS

### Step 4: Draft and Outreach
**What it does**: AI generates personalized outreach, human approves, system sends via email or Instagram DM.
**Code**: `outreach-drafter.ts` → `send-pipeline.ts` → `gmail/send.ts` (email) or `unipile/send-dm.ts` (Instagram DM)
**Lifecycle**: `"ready"` → `"outreach_sent"`
**Status**: PARTIAL
- Email: WORKS (Gmail API, HTML templates, warmup, suppression, CAN-SPAM)
- Instagram DM: WORKS (Unipile API, exact handle verification)
- TikTok DM: MISSING (no integration exists)

### Step 5: Communicate to Get Address
**What it does**: Processes replies, AI classifies intent (positive/negative/address/question), extracts shipping address.
**Code**: `gmail/webhook/route.ts` → `process-reply.ts` → `inbox/ai.ts` (classify + extract) → `ShippingAddressSnapshot`
**Lifecycle**: `"outreach_sent"` → `"replied"` → `"address_confirmed"`
**Status**: PARTIAL
- Email replies: WORKS (full AI pipeline)
- Instagram DM replies: BROKEN — `unipile/message.received` event has NO consumer. Messages are persisted but never AI-classified, no address extraction, no draft generation.

### Step 6: Ship Product via Shopify
**What it does**: Human approves address → system creates Shopify draft order → completes it → ships.
**Code**: `approve-address/route.ts` → `create-order-from-address.ts` (Inngest) → `shopify/orders.ts`
**Lifecycle**: `"address_confirmed"` → `"order_created"` → `"shipped"` (on fulfillment)
**Status**: WORKS (feature-flagged: `shopifyOrderEnabled` defaults false)

### Step 7: Track Delivery
**What it does**: Detects when product is delivered via Shopify webhook or Track17 polling.
**Code**: `webhooks/shopify/route.ts` (fulfillment update) + `track17-sync.ts` (cron every 2 hours)
**Lifecycle**: `"shipped"` → `"delivered"`
**Status**: WORKS (dual detection)
**Gap**: No outcome event recorded for delivery (`deliveredAt` stays null on `CampaignOutcome`)

### Step 8: Detect Posted Content
**What it does**: Polls Instagram for tagged media, attributes to campaign creators, tracks engagement.
**Code**: `instagram-mention-poll.ts` (cron every 15 min) → `attribution.ts` → `MentionAsset` + outcome event
**Lifecycle**: `"delivered"` → `"posted"`
**Status**: WORKS (Instagram only)
**Gap**: No TikTok content detection. No @mention detection (only tags — @mentions require webhook infrastructure).

### Step 9: Follow Up if No Content
**What it does**: Schedules reminders after fulfillment, sends follow-up emails if no mention detected.
**Code**: `reminders.ts` (on `shopify/order.fulfilled`) → `mention-check.ts` (on `reminder/send`)
**Lifecycle**: Stays at `"delivered"` while reminders fire
**Status**: WORKS (feature-flagged: `reminderEmailEnabled` defaults false)
**Gap**: No automated `"stalled"` transition after all reminders exhausted with no post.

### Step 10: Archive and Measure Content
**What it does**: Archives posted content to Supabase Storage (+ optional Cloudinary), stores engagement metrics.
**Code**: `mention-media-archive.ts` (immediate + daily cron) → Supabase Storage upload
**Status**: WORKS
**Gap**: No automated `"posted"` → `"completed"` transition. No content quality scoring.

---

## Broken Connections

| # | Issue | Impact | Fix Effort |
|---|-------|--------|-----------|
| 1 | `unipile/message.received` has NO consumer | Instagram DM replies are dead-ended — no AI classification, no address extraction | Medium — create Inngest function mirroring `process-reply.ts` |
| 2 | No `recordOutcomeEvent({type: "delivered"})` call | `CampaignOutcome.deliveredAt` stays null, calibration data incomplete | Small — add call in both delivery paths |
| 3 | No `"posted"` → `"completed"` transition | Lifecycle never reaches terminal success state | Small — add automation after content quality check |
| 4 | No `"stalled"` detection | Creators who never post stay in `"delivered"` forever | Small — cron after max reminders exhausted |

## Missing Functionality

| # | Feature | User Expectation | Current State |
|---|---------|-----------------|---------------|
| 1 | TikTok DM outreach | "outreaching via TikTok" | No TikTok messaging integration |
| 2 | TikTok content tracking | "tracking that content" (all platforms) | No TikTok API for mention/tag detection |
| 3 | TikTok discovery | Find TikTok creators | Platform type exists, no search lanes |
| 4 | Instagram DM reply processing | "communicate with them to get their email" (via DM) | Event emitted but no consumer |

## Feature Flags (9 total, 8 default OFF)

| Flag | Default | Controls |
|------|---------|----------|
| `instagramMentionPollEnabled` | **true** | Instagram tagged media polling |
| `decisionEngineScoringEnabled` | false | AI fit scoring during discovery |
| `identityGraphEnabled` | false | Identity graph creation |
| `identityAutoLinkEnabled` | false | Auto-merge above 0.82 threshold |
| `outcomeLearningEnabled` | false | CampaignOutcome creation |
| `shopifyOrderEnabled` | false | Shopify order from approved address |
| `reminderEmailEnabled` | false | Follow-up reminder emails |
| `aiReplyEnabled` | false | AI draft generation for replies |
| `embeddingScoringEnabled` | false | Semantic embedding scoring (25c, deferred) |

## Lifecycle Status Values

```
ready → outreach_sent → replied → address_confirmed → order_created → shipped → delivered → posted → completed
                                                                                    ↓
                                                                              opted_out | stalled
```

## Validation Checklist (for QA)

- [ ] Can discover Instagram creators for a brand's niche
- [ ] AI scores creators with fit reasoning
- [ ] Human can approve/decline creators in review queue
- [ ] Brand context (website scrape + Business DNA) feeds into scoring and drafts
- [ ] AI generates personalized outreach drafts
- [ ] Email sends with HTML template, unsubscribe link, warmup gate
- [ ] Instagram DM sends via Unipile with handle verification
- [ ] Email replies are AI-classified (positive/negative/address/question)
- [ ] Addresses extracted from email replies create ShippingAddressSnapshot
- [ ] Approved address triggers Shopify draft order creation
- [ ] Shopify fulfillment webhook updates lifecycle to "shipped"
- [ ] Delivery detected (Shopify webhook or Track17 polling)
- [ ] Instagram tagged media detected and attributed to campaign creator
- [ ] Lifecycle updated to "posted" with engagement metrics
- [ ] Follow-up reminders sent if no post after delivery
- [ ] Posted content archived to Supabase Storage
- [ ] All feature flags can be toggled per brand
