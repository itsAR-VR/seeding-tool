# Phase 9e — Implement campaigns, creators, approval queue, inbox, and Gmail/AI reply handling

## Focus
Build the first end-to-end operational core of the platform: campaign creation, creator records, review queues, inbox/thread handling, Gmail send and ingest flows, and AI-assisted reply/address processing.

## Inputs
- `docs/planning/phase-9/plan.md`
- `docs/planning/phase-9/d/plan.md`
- `docs/planning/phase-8/finalplan.md`
- `docs/planning/phase-8/b/schema.md`
- `docs/planning/phase-8/c/integrations.md`
- `docs/planning/phase-8/d/product-surfaces.md`
- `apps/web/prisma/schema.prisma`
- auth/tenant/onboarding flows from 9c-9d

## Skills Available for This Subphase
- `find-local-skills` output: unavailable on this machine (missing local index); fallback to manual skill selection.
- `find-skills` output: unavailable on this machine; fallback to confirmed local skills only.
- Planned invocations:
  - `backend-development`
  - `llm-application-dev`
  - `context7-docs`
  - `frontend-design`
  - `react-dev`
  - `javascript-typescript`

## Work

### 1. Implement campaign and creator CRUD/query surfaces
- campaign list
- campaign create flow
- campaign detail / control room
- global creator index
- creator detail/history surface

### 2. Implement approval queue and review actions
- support:
  - approve
  - decline
  - defer/review later
  - approved-without-email handling
- ensure review actions mutate `reviewStatus` and `lifecycleStatus` correctly
- expose filters equivalent to legacy operational views

### 3. Implement inbox data model services
- `ConversationThread`
- `Message`
- `AIArtifact`
- `AIDraft`
- `ShippingAddressSnapshot`
- add server-side services for:
  - thread resolution
  - message normalization
  - thread listing/filtering
  - message audit history

### 4. Implement Gmail send path
- alias selection
- human-confirmed send flow
- initial outreach + follow-up send services
- message persistence and dedupe
- do not auto-send AI drafts in v1

### 5. Implement Gmail ingest + AI reply pipeline
- Gmail callback/webhook/poll path
- inbound message normalization
- AI reply classification
- address extraction
- draft generation
- low-confidence/manual-review handling

### 6. Implement inbox UI
- thread list
- thread detail
- draft review/edit/send flow
- extracted-address review and confirm action
- audit / AI-history panel

### 7. Wire lifecycle transitions through queue-backed jobs
- initial outreach request
- follow-up scheduling
- reply processing
- address confirmation
- ensure transitions follow the Phase 8 idempotency rules

### 8. Validation
- `npm run web:build` (from repo root)
- targeted route/API verification for inbox and Gmail paths
- targeted Playwright or equivalent flow for:
  - approve creator
  - send outreach
  - receive/store reply
  - review AI draft
  - confirm extracted address

## Validation (RED TEAM)
- Gmail development must work with test accounts (unverified OAuth app, 100-user limit). Submit for verification at START of Phase 9.
- AI classification must handle OpenAI API failures gracefully (create intervention, don't crash)
- AI drafts must NEVER auto-send in v1 — verify this invariant explicitly in tests
- Follow-up cadence must respect `maxFollowUps` from BrandSettings, not use hardcoded values
- Inbox thread resolution must handle the case where a Gmail message arrives for an unknown creator
- Dedupe keys must be tested: replay the same Gmail webhook twice, verify no duplicate Message rows

## Output
- The platform supports the core flow from campaign creation through creator approval, outreach, inbox reply handling, and address confirmation.
- Gmail and AI are integrated as real app behaviors rather than only plan-level contracts.

## Handoff
Phase 9f should extend this core loop into Shopify orders, delivery/reminder handling, mention attribution, intervention resolution, and unsubscribe suppression, using the reply/address state from this subphase as its entry point.

## Assumptions / Open Questions (RED TEAM)
- Gmail OAuth verification submitted at Phase 9 start but may not complete before 9e executes.
  - Why it matters: without verification, only test accounts work. Production brands can't connect.
  - Current default: use test accounts during dev, poll-based fallback until push notification verification completes.
- OpenAI structured output (JSON mode or function calling) for address extraction.
  - Why it matters: unstructured output requires brittle parsing.
  - Current default: use `response_format: { type: "json_schema" }` with explicit schema.
