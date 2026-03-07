# Phase 8e Rollout, QA, and Migration Contract

Last updated: 2026-03-06
Owner: Phase 8 execution

## 1. Rollout Objective

Replace the current Airtable + n8n runtime with the new Seed Scale platform without losing:
- approval control
- outreach cadence
- address capture behavior
- one-time order creation
- delivery/reminder logic
- mention tracking
- intervention visibility

## 2. Migration Strategy

## M0. Bootstrap and Fixtures
- export pilot-brand Airtable People and Mentions records
- export or fetch recent Gmail thread history for active creators
- export representative provider payload fixtures:
  - Stripe
  - Shopify order/fulfillment
  - Gmail inbound notification
  - Instagram mention event or poll result
- redact or rotate any exposed legacy secrets before using fixtures in tests

## M1. Pilot Brand Import

Default pilot brand: current Kalm brand.

### Import targets
- `Organization`
- `Client`
- `Brand`
- `BrandSettings`
- `BrandProduct`
- `OutreachTemplate`
- `Creator`
- `CreatorProfile`
- `Campaign`
- `CampaignCreator`
- `MentionAsset`
- `ConversationThread` / `Message` where recoverable

### Status mapping

| Legacy state / view | New state |
|---|---|
| `Waiting Approval` | `reviewStatus=PENDING`, `lifecycleStatus=DISCOVERED` |
| `Approved` | `reviewStatus=APPROVED`, `lifecycleStatus=READY_FOR_OUTREACH` or a later lifecycle inferred from timestamps |
| `Approved Without Email` | `reviewStatus=APPROVED`, `missingEmail=true` |
| `Shopify` with order created | `reviewStatus=APPROVED`, `lifecycleStatus=ORDER_CREATED` |
| delivered records | `lifecycleStatus=DELIVERED` |
| posted/history counts present | `lifecycleStatus=POSTED` or `COMPLETED` depending on current state |
| `Intervention Flag` | open `InterventionCase` |
| `Declined` | `reviewStatus=DECLINED` |

### Import rules
- do not infer missing data beyond what is operationally necessary
- preserve legacy dates where possible
- if Gmail thread history is incomplete, import creator state first and mark thread history as partial
- never auto-open provider connections from imported tokens unless they are re-verified

## M2. Replay Shadow

### Purpose
Prove the new system makes the same decisions without letting it send real outreach or create real orders.

### Mode
- consume copied or replayed provider fixtures
- write all platform state
- suppress real outbound email sends
- suppress real Shopify order creation
- compare resulting state transitions with expected parity outcomes

### Minimum duration
- ideal: 1 week for the pilot brand
- compressed path for urgent launch: 48-72 hours of replay shadow plus manual sign-off

## M3. Controlled Live Pilot

### Sequence
1. Enable brand onboarding, campaign creation, and creator approval in the new app.
2. Keep actual outreach human-confirmed in inbox.
3. Turn on real Gmail sending for the pilot brand.
4. Monitor 48 hours.
5. Turn on real Shopify order creation.
6. Monitor 48 hours.
7. Turn on real reminder + mentions processing.
8. Monitor 72 hours.

### During pilot
- every outbound send remains human-confirmed
- every low-confidence AI output stays manual
- creator search is limited to approved operators
- open interventions are reviewed at least twice daily

## M4. Brand-by-Brand Cutover

For each additional brand:
1. import config + campaign state
2. verify provider connections
3. run parity replay against sample fixtures
4. enable outreach
5. enable orders
6. enable reminder/mentions
7. freeze legacy workflows for that brand only

## M5. Legacy Freeze

After brand cutover is stable:
- disable relevant n8n workflows for that brand
- keep exports and Airtable data read-only for 90 days
- retain rollback instructions and data mapping artifacts

## 3. QA Contract

## Unit Tests
- allowed/blocked lifecycle transitions on `CampaignCreator`
- dedupe-key generation and duplicate suppression
- brand config resolution
- template selection by brand and reminder type
- AI structured output parsing and confidence threshold rules
- opt-out suppression logic

## Integration Tests
- Stripe webhook -> `Subscription` sync -> entitlement gating
- Gmail connect -> alias creation -> outbound send record -> inbound message normalization
- Shopify order create -> fulfillment update -> delivery update
- Instagram/mention ingest -> mention dedupe -> reminder suppression
- creator-search dispatch -> worker callback -> result normalization

## Replay Tests
- same webhook replayed twice should not duplicate state change
- same Gmail reply notification replayed twice should not duplicate `Message`
- same mention event replayed twice should not duplicate `MentionAsset`
- same order-create request replayed twice should not create second order

## End-to-End Tests
- onboarding from signup to first campaign
- creator approval -> outreach -> reply -> address confirm -> order create
- delivered creator -> reminder due -> reminder sent -> mention ingested
- intervention case appears and resolves cleanly
- unsubscribe suppresses future sends

## Parity Mapping

| Parity section | Required tests |
|---|---|
| A Intake and approval | onboarding + campaign review + missing-email path |
| B Outreach and follow-up | initial outreach + cadence + intervention threshold |
| C Reply handling | message ingest + classification + address retry path |
| D Shopify order creation | product mapping + one-order guard + admin link write |
| E Fulfillment and delivery | delivered signal + reminder scheduling |
| F Mentions tracking | post/history counters + mention row creation + storage degrade path |
| G Non-post reminder loop | reminder stop on mention + no repeated hits |
| H Intervention and recovery | manual correction resumes without duplicate side effects |
| I Security and config | no hardcoded brand literals + scoped credentials + secret hygiene |
| J Operational reliability | alerts + structured context + daily stage sanity check |

## 4. Observability Contract

## Structured Logs
Every log line for lifecycle work must include:
- `brandId`
- `campaignId` if present
- `campaignCreatorId` if present
- `provider`
- `jobType` or `eventType`
- `dedupeKey`
- `status`
- `errorCode` / `lastError` when relevant

## Core Metrics
- pending background jobs by type
- failed background jobs by type
- pending webhook events by provider
- open interventions by type
- paused aliases by brand
- approval -> outreach conversion
- outreach -> reply conversion
- reply -> address conversion
- address -> order conversion
- delivered -> posted conversion

## Alerts

### Critical
- duplicate order detected
- Gmail alias auth failure on active brand
- queue backlog stalled for more than 1 hour
- creator-search worker repeatedly blocked or failing

### Warning
- bounce or complaint threshold crossed
- intervention queue over threshold
- mention attribution failure rate above threshold
- repeated low-confidence AI parsing failures

### Daily Digest
- funnel counts by brand
- reminder backlog
- delivered-but-not-posted counts
- unresolved interventions

## SLA
- open interventions assigned within 4 hours during business days
- critical incidents acknowledged within 30 minutes
- duplicate-order incident triggers immediate pause of order creation for the affected brand

## 5. Rollout Gates

| Subsystem | Proceed gate | Rollback trigger |
|---|---|---|
| onboarding | 3 successful end-to-end activations | any step silently drops data or blocks resume |
| creator approval + outreach | 20 correct human-confirmed sends | wrong recipient, wrong brand voice, or duplicate send |
| reply handling | 20 replies classified with acceptable operator trust | repeated low-confidence or wrong address interpretation |
| order creation | 5 successful orders with correct mapping | duplicate order or wrong product/variant |
| fulfillment + reminders | 5 correct delivered -> reminder transitions | reminder sent before delivery or sent after post exists |
| mentions | 10 correctly attributed mention ingests | >20% attribution or storage-failure rate |
| creator search | 10 successful searches with usable results | repeated CAPTCHA / session failure pattern |

## 6. Rollback Playbook

If a subsystem fails a gate:
1. pause the subsystem at the brand level
2. leave unaffected subsystems running if they are isolated and proven safe
3. route new work to manual operations
4. preserve all failed evidence and dedupe keys
5. open incident + assign owner
6. do not re-enable until replay tests pass on the failure mode

## 7. Non-Blocking Items for Pilot

These do not block the first pilot cutover if the core lifecycle is stable:
- cost sync automation
- advanced media storage enrichment
- custom analytics builder
- automatic creator reactivation logic

## 8. Release Checklist

- pilot brand imported
- provider fixtures stored
- parity replay passed for A-J checklist items that affect the pilot
- real provider connections verified
- intervention queue staffed
- rollback switches documented
- legacy workflows disabled only for the pilot brand being cut over
