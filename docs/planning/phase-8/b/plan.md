# Phase 8b — Design canonical data model, billing model, hierarchy, and config surface

## Focus
Define the canonical platform schema that replaces Airtable and supports self-serve SaaS, agency/client/brand hierarchy, gifting-first campaigns, Stripe billing, and multi-brand configuration without hardcoded values.

## Inputs
- `docs/planning/phase-8/plan.md` (root plan with RED TEAM findings)
- `docs/planning/phase-8/a/architecture.md` (architecture lock — stack, providers, route groups, build order)
- `docs/seed-scale-handoff/appendix/source-truth-map.md` (Airtable base/table IDs, hardcoded brand values, workflow metadata)
- `docs/seed-scale-handoff/appendix/behavior-parity-checklist.md` (10-section verification checklist: intake, outreach, reply handling, Shopify, fulfillment, mentions, reminders, intervention, security, reliability)
- `docs/seed-source-2026-03-01/Airtable-Database-Guide.txt` (current Airtable People + Mentions table structure)
- `docs/seed-scale-handoff/appendix/decision-log.md` (accepted decisions D-001 through D-010 + open decisions O-001 through O-005)

## Work

### 1. Define the tenancy hierarchy and access model
- `Organization` — top-level billing entity (maps to Stripe Customer)
- `Client` — organization's client (for agency model)
- `Brand` — client's brand (the operational unit: owns campaigns, credentials, products, messaging config)
- `User` — authenticated person (Supabase Auth user)
- `Membership` — join table: User x Organization with role enum (`owner`, `admin`, `member`, `viewer`)
- `BrandAccess` — join table: User x Brand with optional role override
- Access model: organization-scoped by default, brand-filtered for operational views

### 2. Define billing entities and ownership
- Stripe Customer created at Organization level
- `Subscription` entity linked to Organization
- `Plan` and `Entitlement` tables for feature gating (campaign limits, creator limits, search quota, inbox AI toggle)
- Webhook-driven status sync (no polling)

### 3. Define core operational entities
Map each Airtable People table field to a new entity/field:

- **Campaign** — replaces implicit "batch" concept. Has brand, date range, product mapping, messaging config, status.
- **Creator** — canonical creator profile. Source handle, platform, email, follower metrics, fit score. Dedupe key: `platform + handle`.
- **CampaignCreator** — join table with lifecycle status enum (replaces Airtable status views):
  ```
  pending_review -> approved -> outreach_sent -> follow_up_1..5 ->
  replied -> address_captured -> order_created -> shipped -> delivered ->
  reminder_sent -> posted -> completed
  ```
  Plus branch states: `declined`, `unresponsive`, `intervention_required`, `opted_out`
- **Conversation** — email thread between brand and creator. Linked to CampaignCreator.
- **Message** — individual email in a conversation. Direction (inbound/outbound), raw content, AI classification, parsed entities.
- **AIDraft** — AI-generated reply draft. Linked to Message. Status: `generated`, `edited`, `sent`, `discarded`.
- **ShippingSnapshot** — captured address from creator reply. Linked to CampaignCreator. Immutable once Shopify order created.
- **ShopifyOrder** — order reference. Order ID, status, tracking number, fulfillment timestamps. Dedupe key: `campaign_creator_id` (one order per creator per campaign).
- **Mention** — detected social media post/story. Creator, campaign, platform, media URL, media type, post date, capture date. Dedupe key: `platform + media_url`.
- **Reminder** — scheduled post-delivery follow-up. Linked to CampaignCreator. Status: `scheduled`, `sent`, `cancelled_posted`.
- **InterventionFlag** — manual recovery record. Linked to CampaignCreator. Reason enum, assigned owner, resolution notes.
- **BackgroundJob** — job queue record (if using DB-backed jobs). Type, payload, status, retry count, dedupe key, error log.
- **WebhookEvent** — raw webhook payload audit trail. Provider, event type, payload hash, processing status, idempotency key.
- **ActivityLog** — audit trail for operator actions. Who did what, when, on which entity.

### 4. Define email alias and deliverability entities
Each brand can have multiple sending addresses for deliverability scaling:

- **EmailAlias** — sending identity for a brand:
  - `brand_id` (FK)
  - `email_address` (e.g., `collabs@brand.com`, `partnerships@brand.com`)
  - `display_name` (e.g., "Kalm Partnerships")
  - `provider_credential_id` (FK -> ProviderCredential, the Gmail OAuth token for this alias)
  - `status` enum: `warming_up`, `active`, `paused`, `disabled`
  - `warmup_daily_limit` (starts at 50, increases 25% weekly)
  - `current_daily_limit` (computed: min of warmup_daily_limit and platform soft cap)
  - `created_at`, `updated_at`

- **SendingMetric** — daily tracking per alias:
  - `email_alias_id` (FK)
  - `date` (date, not timestamp)
  - `sent_count`, `bounce_count`, `complaint_count`, `reply_count`
  - Unique constraint: `(email_alias_id, date)`
  - Used for: warm-up progression, deliverability alerts, rate limiting decisions

### 5. Define brand configuration surface
Replace ALL hardcoded brand-coupled values (documented in `source-truth-map.md`) with typed config:

- **BrandConfig** entity or JSON column on Brand:
  - `shopify_store_slug` (replaces hardcoded `kalmwellness`)
  - `shopify_product_mappings` (replaces hardcoded product/variant IDs)
  - `default_email_alias_id` (FK -> EmailAlias, replaces hardcoded email)
  - `email_subject_template` (replaces hardcoded `Kalm - Partnership!`)
  - `outreach_templates` (welcome, follow-up 1-5, post-delivery, reminder)
  - `brand_voice_prompt` (AI persona for reply handling)
  - `product_page_url` (replaces hardcoded `clubkalm.com/...`)
  - `follow_up_cadence_days` (replaces hardcoded 3-day interval)
  - `max_follow_ups` (replaces hardcoded threshold before intervention)
  - `post_delivery_reminder_delay_hours` (replaces hardcoded 24h)
  - `reminder_stop_after_days` (stop reminding after N days)
  - `email_warmup_daily_limit` (initial sending cap for new aliases, default 50)

### 6. Define immutable IDs, dedupe keys, and required indexes
- All entities use UUID v7 primary keys (time-sortable)
- Dedupe keys defined above per entity
- Required indexes: `campaign_creator(campaign_id, creator_id)` unique, `creator(platform, handle)` unique, `mention(platform, media_url)` unique, `webhook_event(idempotency_key)` unique
- Soft delete (`deleted_at` timestamp) on Creator, Campaign — never hard delete PII without explicit request

### 7. Define future-facing dormant tables
Present in v1 schema as dormant (no UI, no logic) for future features:
- `UsageRightsRequest` — for automated rights collection (v2)
- `ContentAsset` — for ingested/downloaded content (v2)
- `WhitelistingGrant` — for creator whitelisting (v2)
- `DealTerms` — for paid-deal workflows (v2)

### 8. Data privacy and PII handling
- Creator PII (email, shipping address) must be encryptable at the application level (Prisma middleware or Supabase vault).
- OAuth tokens (Gmail, Shopify) stored encrypted in a separate `ProviderCredential` table, NOT in brand config.
- Data retention policy: define `retention_days` per data type. Default: 365 days for PII, indefinite for anonymized metrics.
- Creator opt-out: `opted_out` flag on Creator record. When set, all outreach stops, PII is scheduled for deletion.

## Output
- Completed artifact: `docs/planning/phase-8/b/schema.md`
- The artifact now locks:
  - canonical tenancy: `Organization -> Client -> Brand`
  - organization-scoped Stripe billing via `SubscriptionPlan`, `SubscriptionEntitlement`, and `Subscription`
  - typed brand config via `BrandSettings`, `OutreachTemplate`, and `BrandProduct`
  - encrypted provider access via `ProviderCredential` and `BrandConnection`
  - onboarding and discovery models via `BrandOnboarding`, `DiscoverySeed`, `CreatorSearchJob`, and `CreatorSearchResult`
  - a split between approval state (`reviewStatus`) and execution state (`lifecycleStatus`) on `CampaignCreator`
  - durable operational models for inbox, address capture, Shopify, mentions, reminders, interventions, webhook ingress, and background work
- Key design decisions made in 8b:
  - use database-generated UUIDs (`gen_random_uuid()`) instead of UUID v7
  - colocate the future Prisma file at `apps/web/prisma/schema.prisma`
  - preserve Airtable-style operator views through denormalized counters and dates on `CampaignCreator`
  - model hardcoded brand literals as typed config instead of JSON-only blobs
  - store PII and OAuth/session material via ciphertext + hash/preview patterns where lookups are needed

## Coordination Notes

- Re-read before editing:
  - `docs/planning/phase-8/a/architecture.md`
  - `docs/seed-scale-handoff/appendix/behavior-parity-checklist.md`
  - `docs/seed-scale-handoff/appendix/source-truth-map.md`
  - `docs/seed-source-2026-03-01/Airtable-Database-Guide.txt`
- Integrated findings from the handoff-doc subagent:
  - creator discovery is modeled as pluggable intake before approval, because source docs disagree on whether discovery is manual or scraped
  - mention tracking is provider-agnostic in the schema because PRD and current runtime disagree on the vendor path

## Validation Notes

- Airtable field mapping is documented explicitly in `schema.md`.
- Brand-coupled literals from `source-truth-map.md` are mapped to new typed config homes.
- Reliability/open-choice concerns are represented with unique dedupe keys and queue/event tables.
- Prisma docs were checked for UUID defaults; the draft intentionally uses supported UUID patterns instead of UUID v7.
- `npx prisma validate` was not run in this planning subphase because `apps/web/prisma/schema.prisma` is not yet materialized as a runtime file.

## Handoff
Subphase 8c should treat `docs/planning/phase-8/b/schema.md` as the canonical data contract. Integration design now has to map every async and provider behavior onto these concrete surfaces:

- `ProviderCredential` and `BrandConnection` for OAuth/session ownership
- `CreatorSearchJob` and `CreatorSearchResult` for worker-mediated discovery
- `CampaignCreator`, `ConversationThread`, `Message`, `AIArtifact`, and `AIDraft` for inbox/reply flow
- `ShippingAddressSnapshot`, `ShopifyOrder`, `FulfillmentEvent`, `ReminderSchedule`, and `MentionAsset` for post-outreach lifecycle
- `WebhookEvent` and `BackgroundJob` for ingestion, retries, and idempotent execution

8c should not redesign entities. It should define provider entrypoints, retry semantics, dedupe keys, and state-transition contracts against the schema now locked here.

## Validation (RED TEAM)
- Verify that every Airtable People table field from `Airtable-Database-Guide.txt` has a corresponding field in the new schema.
- Verify that all 10 behavior parity checklist sections (A-J) can be satisfied by the schema's entities and status enums.
- Verify that all hardcoded brand values from `source-truth-map.md` are replaced by BrandConfig fields.
- Verify that dedupe keys prevent the duplicate-action scenarios listed in `open-choices.md` Choice Set D.
- Run `npx prisma validate` on the draft schema to catch syntax errors.

## Skills Available for This Subphase
- `database-schema-designer`: available — primary skill for schema design
- `backend-development`: available — for entity relationship patterns
- `context7-docs`: available — for up-to-date Prisma/Supabase docs
- Planned invocations: `database-schema-designer`, `backend-development`, `context7-docs`
- ZRG reference: read `ZRG-Dashboard/prisma/schema.prisma` for production patterns (multi-tenant, enums, WebhookEvent/BackgroundJob/BackgroundFunctionRun tables, audit timestamps, JSON fields)

## Assumptions / Open Questions (RED TEAM)
- UUID generation is now locked to `gen_random_uuid()` / Prisma-supported UUID patterns instead of UUID v7.
  - Why it matters: removes avoidable implementation ambiguity during the build phase.
  - Current default: database-generated UUIDs.
- Prisma schema location is now locked to `apps/web/prisma/schema.prisma`.
  - Why it matters: aligns runtime code, deploy root, and migration tooling with the actual shipping app.
  - Current default: `apps/web/prisma/`.
