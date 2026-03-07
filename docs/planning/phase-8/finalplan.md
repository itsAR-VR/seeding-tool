# Seed Scale Final Platform Plan

Last updated: 2026-03-06
Canonical planning artifact for Phase 8

This document is the execution-ready plan for building Seed Scale as a full replacement for the current Airtable + n8n runtime. It is intentionally self-contained so an implementation agent can start from here without reopening core architecture decisions.

## 1. Executive Summary

Seed Scale is becoming a self-serve, multi-brand seeding operations platform that replaces the current manual + n8n + Airtable stack with a single operational system.

The platform must support the full seeding loop:
1. onboard a brand,
2. source creators,
3. approve or reject,
4. send email outreach and follow-ups,
5. read replies and capture addresses,
6. create Shopify orders,
7. track delivery,
8. follow up after delivery,
9. detect mentions,
10. surface interventions.

The first launch is gifting-first and email-first. It is not a paid-deals platform, DM automation product, usage-rights system, or creator portal.

## 2. Locked Decisions

These decisions are resolved and should not be reopened during implementation unless a hard technical blocker appears.

### Product Direction
- Full replacement now, not an Airtable/n8n wrapper.
- Self-serve onboarding is in scope for v1.
- Stripe checkout/subscription gating is in scope for v1.
- Hierarchy is `Organization -> Client -> Brand`.
- Human approval remains a required gate before outreach.
- Email is the canonical outreach channel for v1.
- AI is a copilot in v1, not an autonomous sender.

### Runtime
- The shipping runtime is `apps/web`.
- Marketing and platform live in the same Next.js app, but in separate route groups.
- The platform uses Supabase Auth, Supabase Postgres, Prisma, Stripe, OpenAI, Inngest, and a separate Playwright worker.
- Browser-based creator search is isolated in a separate worker service.
- Prisma schema lives at `apps/web/prisma/schema.prisma`.
- IDs use Prisma/Postgres-supported UUIDs, not UUID v7.

### Scope Boundaries
- v1 includes live creator search, approval queue, inbox, Shopify ordering, reminders, mentions, interventions, billing, and onboarding.
- v1 excludes DM automation, paid deals, creator whitelisting, usage-rights collection, creator portal, and ad asset production workflows.

## 3. System Architecture

## App Topology

```text
apps/web/
  app/
    layout.tsx
    (marketing)/*
    (auth)/*
    (platform)/*
    api/*
  actions/*
  components/ui/*
  components/platform/*
  lib/*
  prisma/schema.prisma
  middleware.ts
```

### Route Groups
- `(marketing)` owns public homepage and pricing.
- `(auth)` owns login, signup, and onboarding entry.
- `(platform)` owns the authenticated product.
- `api/*` owns callbacks, webhooks, cron entrypoints, Inngest, unsubscribe, and internal worker callbacks.

### Runtime Boundaries
- marketing pages stay public
- auth and platform routes use Supabase SSR auth
- route handlers do not run long operations inline
- background work runs through Inngest + durable DB rows
- creator search runs in a separate Playwright worker

## Provider Map

| Provider | Role |
|---|---|
| Supabase Auth | user/session management |
| Supabase Postgres | canonical product state |
| Prisma | app data access and migrations |
| Stripe | subscription billing |
| Shopify | store connect, product mapping, order creation, fulfillment status |
| Gmail | brand-scoped sending and reply ingestion |
| Instagram / Meta | mention/event ingest |
| Meta Creator Marketplace | live creator discovery via worker |
| OpenAI | reply classification, address extraction, drafts, creator-fit reasoning |
| Inngest | orchestration, retries, cron dispatch |

## 4. Canonical Data Model

## Tenancy and Billing
- `User`
- `Organization`
- `OrganizationMembership`
- `Client`
- `Brand`
- `BrandMembership`
- `SubscriptionPlan`
- `SubscriptionEntitlement`
- `Subscription`

Billing is organization-scoped. Operational work is brand-scoped.

## Brand Configuration
- `BrandOnboarding`
- `BrandSettings`
- `OutreachTemplate`
- `BrandProduct`
- `ProviderCredential`
- `BrandConnection`
- `EmailAlias`
- `SendingMetric`
- `DiscoverySeed`

This replaces the legacy hardcoded values:
- Shopify store slug
- product ids / variant ids
- subject lines
- product URLs
- cadence numbers
- email aliases
- provider tokens

## Campaign and Creator Backbone
- `Campaign`
- `CampaignProduct`
- `Creator`
- `CreatorProfile`
- `CampaignCreator`
- `CreatorSearchJob`
- `CreatorSearchResult`

`CampaignCreator` is the operational replacement for Airtable’s People table views.

Important design decision:
- `reviewStatus` handles human approval
- `lifecycleStatus` handles post-approval execution

This avoids conflating review state with execution state.

## Inbox, Orders, Mentions, and Exceptions
- `ConversationThread`
- `Message`
- `AIArtifact`
- `AIDraft`
- `ShippingAddressSnapshot`
- `ShopifyOrder`
- `FulfillmentEvent`
- `CostRecord`
- `MentionAsset`
- `ReminderSchedule`
- `InterventionCase`
- `WebhookEvent`
- `BackgroundJob`
- `ActivityLog`

## Key Operational Rules
- one order per `CampaignCreator`
- one inbox thread per `CampaignCreator` in v1
- multiple shipping snapshots allowed; one active/locked snapshot at a time
- mention dedupe by `platform + mediaUrl`
- every background mutation path must be replay-safe

## 5. Integration and Async Contract

## Public Surfaces
- `app/api/webhooks/stripe/route.ts`
- `app/api/auth/shopify/callback/route.ts`
- `app/api/webhooks/shopify/route.ts`
- `app/api/auth/gmail/callback/route.ts`
- `app/api/webhooks/gmail/route.ts`
- `app/api/webhooks/instagram/route.ts`
- `app/api/inngest/route.ts`
- `app/api/internal/creator-search/route.ts`
- `app/api/cron/[job]/route.ts`
- `app/api/unsubscribe/[token]/route.ts`

## Core Async Pattern
1. verify request
2. normalize payload
3. write `WebhookEvent` or `BackgroundJob`
4. emit Inngest event with stable dedupe/dispatch key
5. return immediately
6. run background work with retries and bounded concurrency
7. write final state + intervention if needed

## Durable Work Types
- initial outreach
- follow-up send
- reply processing
- address confirmation
- order creation
- fulfillment sync
- reminder scheduling
- reminder sending
- mention processing
- creator-search dispatch
- creator-search result processing
- billing sync
- alias warm-up
- health checks

## Idempotency Contract

Every risky step has a deterministic dedupe key.

Examples:
- `outreach:initial:{campaignCreatorId}`
- `outreach:followup:{campaignCreatorId}:{n}`
- `reply:process:{messageId}`
- `order:{campaignCreatorId}`
- `mention:{platform}:{mediaUrl}`
- `reminder-send:{reminderId}`

Non-negotiables:
- duplicate replies do not create duplicate messages
- duplicate order requests do not create duplicate orders
- duplicate mention events do not double-increment counts
- duplicate reminders do not re-send

## Browser Worker Contract

The Playwright worker is separate from the web app.

The app owns:
- job creation
- quotas
- brand auth resolution
- normalized persistence

The worker owns:
- browser context
- session health
- result extraction
- evidence capture

Failure rules:
- CAPTCHA or checkpoint pauses the job and opens intervention
- repeated worker failure pauses search for that brand
- CSV/manual import remains available as fallback

## 6. Product Surface Contract

## Onboarding Wizard

Flow:
1. account
2. organization
3. subscription plan
4. client
5. brand
6. Shopify connect
7. Gmail connect
8. Meta/Instagram connect
9. brand voice and templates
10. products
11. seed creators
12. first campaign
13. launch review

Each step writes immediately to its backing entity. Users can leave and resume.

## Main Routes
- dashboard
- onboarding
- campaigns
- creators
- creator search
- inbox
- orders
- mentions
- interventions
- settings / billing / brands / aliases / team

## Operational UI Equivalents

| Legacy operational view | New surface |
|---|---|
| Waiting Approval | campaign control room review filter |
| Approved | campaign creator table / ready-for-outreach filters |
| Shopify | orders board |
| Mentions | mentions board |
| Intervention Flag | interventions queue |
| Declined | creator/campaign history filters |

## v1 AI Copilot Contract
AI may:
- classify replies
- extract addresses
- score creator fit
- suggest next action
- draft replies

AI may not:
- send automatically
- auto-approve creators
- auto-create orders without a confirmed address state
- silently resolve commercial or ambiguous cases

## 7. Funnel State Machines

## A. Discovery and Approval
- creator enters from search, seed expansion, CSV, or manual add
- creator is reviewable even if email is missing
- operator can approve, decline, or defer
- approved creators with missing email must surface in a dedicated handling state

## B. Outreach
- approval creates readiness for outreach
- initial outreach sends once
- fixed cadence follow-ups continue until:
  - a reply arrives,
  - max follow-ups are reached,
  - the creator opts out,
  - an intervention blocks further sends

## C. Reply Handling
- inbound message is normalized
- AI classifies and attempts structured extraction
- if address is incomplete, draft clarification
- if address is valid, create a confirmed snapshot
- if message is unclear or commercial, route to human review

## D. Order and Delivery
- human confirms extracted address
- order creates once
- fulfillment and delivery events append immutably
- delivered state triggers reminder scheduling

## E. Post-Delivery and Mentions
- reminders are suppressed if posting evidence already exists
- mention ingest updates counters and marks creator as posted
- if no content appears after configured windows, reminders stop and creator is completed without forcing false intervention

## F. Intervention
- every unsafe failure branch opens or updates an intervention
- interventions are assignable, resolvable, and reopenable
- manual correction must resume automation safely without duplicate side effects

## G. Consent
- every outreach email contains unsubscribe
- unsubscribe sets opt-out and suppresses future outreach/reminders
- historical data remains visible for audit

## 8. Migration and Cutover

## Pilot Brand
Start with the current Kalm brand because:
- it has the most complete existing runtime evidence
- the hardcoded legacy values are already known
- it exercises the full lifecycle

## Migration Sequence
1. export Airtable People + Mentions
2. import brand config, creators, campaigns, mentions, and recoverable thread history
3. run replay shadow with provider fixtures
4. enable real Gmail sends with human confirmation
5. enable real Shopify order creation
6. enable reminder + mentions
7. disable legacy workflows for the pilot brand only
8. repeat brand-by-brand

## Shadow Mode
- ideal: 1 week
- compressed path for urgency: 48-72 hours plus manual sign-off

## Legacy Freeze
- disable, do not delete, legacy workflows after stable cutover
- retain legacy data read-only for 90 days

## 9. QA and Release Contract

## Required Test Types
- unit tests for state transitions and dedupe logic
- integration tests for providers and callbacks
- replay tests for duplicate-event safety
- Playwright E2E for major operator flows

## Required E2E Flows
1. onboarding to first campaign
2. creator approval to outreach
3. reply to address confirmation to order creation
4. delivery to reminder to mention suppression
5. intervention creation and resolution
6. unsubscribe suppression

## Parity Gate

The release is not valid unless the platform covers the parity checklist:
- A intake and approval
- B outreach and follow-up
- C reply handling and address capture
- D Shopify order creation and sync
- E fulfillment and delivery
- F mentions tracking
- G non-post reminder loop
- H intervention and manual recovery
- I security and config controls
- J operational reliability

## 10. Observability Contract

Every lifecycle failure path must be observable.

### Logs
Include:
- brand id
- campaign id
- campaign creator id
- provider
- job/event type
- dedupe key
- status
- failure reason

### Core Metrics
- pending jobs
- failed jobs
- open interventions
- paused aliases
- approval -> outreach conversion
- outreach -> reply conversion
- address -> order conversion
- delivered -> posted conversion

### Alerts
Critical:
- duplicate order
- Gmail auth failure on active brand
- stalled queue
- worker repeatedly blocked or failing

Warning:
- alias bounce/complaint threshold crossed
- intervention queue too large
- mention attribution failure rate too high

## 11. Rollout Gates

| Subsystem | Proceed when | Roll back when |
|---|---|---|
| onboarding | 3 clean activations | step silently drops data or resume breaks |
| outreach | 20 correct sends | wrong recipient, wrong brand, duplicate send |
| reply handling | 20 reliable classifications | repeated low-confidence or wrong extraction |
| order creation | 5 successful orders | duplicate or wrong order |
| reminder + delivery | 5 correct transitions | reminder sent too early or after post exists |
| mentions | 10 correctly attributed ingests | high attribution/storage failure |
| creator search | 10 successful searches | repeated CAPTCHA/session failure pattern |

## 12. Build Order

### Step 1. Bootstrap the app
- install dependencies in `apps/web`
- add `lib/*`, `components/*`, `actions/*`, `prisma/*`, `middleware.ts`
- keep marketing routes stable

### Step 2. Auth and tenancy
- Supabase SSR clients + middleware
- login/signup/auth callback
- organization/client/brand/membership schema

### Step 3. Billing and onboarding
- Stripe checkout + subscription sync
- onboarding wizard backed by real entities

### Step 4. Brand configuration
- products
- templates
- email aliases
- provider connections
- seed creators

### Step 5. Campaign and creator backbone
- campaigns
- campaign creator state machine
- creator database

### Step 6. Inbox and Gmail
- thread list/detail
- message ingest
- AI copilot
- human-confirmed send flow

### Step 7. Shopify
- store connect
- one-order guard
- fulfillment and delivery sync

### Step 8. Creator search worker
- search job dispatch
- worker callback
- review queue

### Step 9. Mentions and reminders
- mention ingest
- reminder schedule/send
- suppression when posted

### Step 10. Interventions, observability, rollout
- queue surfaces
- alerts
- replay fixtures
- pilot cutover

## 13. Parallel Execution Lanes

| Lane | Can start after | Scope |
|---|---|---|
| A | bootstrap | auth + tenancy |
| B | bootstrap | schema + migrations |
| C | bootstrap | platform shell + route scaffolding |
| D | A+B | billing + onboarding |
| E | A+B | Gmail/inbox |
| F | A+B | Shopify |
| G | B+C | creator-search worker |
| H | E+F | mentions + reminders |
| I | D+E+F+G+H | QA, observability, pilot rollout |

## 14. Skills Invocation Guide

Use these skills deliberately during implementation:

| Build area | Skills |
|---|---|
| scope or design drift | `requirements-clarity`, `phase-gaps` |
| app/runtime architecture | `backend-development`, `context7-docs` |
| schema and migrations | `database-schema-designer`, `backend-development` |
| inbox and AI | `llm-application-dev` |
| creator search worker | `browser-automation`, `backend-development` |
| product surface build | `frontend-design`, `react-dev` |
| end-to-end verification | `playwright-testing`, `qa-test-planner` |
| final hardening / review | `phase-gaps`, `code-review` |

## 15. ZRG Reference Map

Read these before implementing the corresponding subsystem:

| Need | ZRG reference |
|---|---|
| Supabase auth split | `middleware.ts`, `lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/middleware.ts` |
| auth callback flow | `app/auth/callback/route.ts` |
| Inngest wiring | `app/api/inngest/route.ts`, `lib/inngest/client.ts`, `lib/inngest/events.ts`, `lib/inngest/functions/index.ts` |
| background job runner | `lib/background-jobs/enqueue.ts`, `lib/background-jobs/runner.ts`, `app/api/cron/background-jobs/route.ts` |
| webhook queue patterns | `app/api/webhooks/*`, `lib/webhook-events/runner.ts`, `lib/webhook-dedupe.ts` |
| Prisma conventions | `prisma/schema.prisma`, `lib/prisma.ts` |
| dashboard UI patterns | `components/dashboard/*`, `components/ui/*` |

## 16. First Execution Step

Start here:
1. install the app dependencies from the architecture checklist inside `apps/web`
2. scaffold `lib/supabase/*`, `lib/inngest/*`, `prisma/schema.prisma`, `middleware.ts`, and route groups
3. implement auth + tenancy before any provider-specific work
