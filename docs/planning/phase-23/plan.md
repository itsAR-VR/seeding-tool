# Phase 23 — Complete Core Automation

## Original User Request (verbatim)

I Want to do a big test and see how we can actually improve the seeding tool. I'm pretty sure the influencer identification is pretty garbage. The data labeling of those influencers is pretty shit too. The enrichment is not there. I'm not sure if email outreach works and all the platforms are connected. I'm just not sure what's going on. I need clarity, I need structure, I need it to work, and I'm just confused.

## Purpose

Close the automation gaps in the seeding lifecycle. Every step from address confirmation to Shopify order should be automated. Add integration tests for the critical paths hardened in Phase 22.

## Context

Phase 22 (committed `86c1fcd`) stabilized the platform: credit enforcement, RBAC, daily send limits, List-Unsubscribe, typed Inngest events, Shopify 2025-04, AI model config. Phase 23 builds on that foundation to automate the address→order pipeline and add integration test coverage.

### Ultraplan Corrections (ground truth)
- Instagram Graph API is a full 356-line implementation (`lib/instagram/client.ts`), not a stub
- Cloudinary has full upload/optimize/delete (`lib/cloudinary/client.ts`, 133 lines)
- Track17 has full client (166 lines) + 2 Inngest functions + webhook handler
- `process-reply.ts:74-93` already extracts addresses and creates `ShippingAddressSnapshot` with `isActive: false` — the gap is wiring approval to order creation

### Dependencies
- Phase 22 must be complete (committed) — needs typed Inngest events, RBAC middleware, credit enforcement patterns
- Phase 23 blocks Phase 25 (calibration needs outcome data from completed campaigns)

### Deep Sweep Confidence
- **88%** — well-scoped, building blocks exist
- Risk: Shopify draft order REST endpoint behavior on 2025-04, TOCTOU on double-confirm

## Skills Available for Implementation
- `backend-coding-agent` — automation pipeline, API endpoints
- `tdd-guide` — integration tests, TDD workflow
- `database-reviewer` — schema review for new models
- `context7-docs` — Shopify draft order API docs
- `code-review` — post-implementation review

## Objectives
* [ ] Address confirmation triggers Shopify draft order creation automatically
* [ ] `ShippingAddressSnapshot.isActive` approval flow with brand-user confirmation step
* [ ] Inngest function for async order creation with retry logic
* [ ] Integration tests for send-pipeline, credit enforcement, and process-reply
* [ ] `CampaignOutcome` event recorded for `order_created` milestone

## Constraints
- Use existing `createDraftOrder()` in `lib/shopify/orders.ts` (already complete)
- New Inngest event (`shipping/address.approved`) must use typed events from Phase 22c
- RBAC: only editor/owner can approve addresses (use `requireWriteAccess` from Phase 22b)
- Keep Playwright worker on Fly.io for validation (user decision)

## Success Criteria
1. Approving an address fires `shipping/address.approved` Inngest event
2. Inngest function creates Shopify draft order + completes it
3. `CampaignCreator.lifecycleStatus` updated to `order_created` on success
4. `InterventionCase` created on Shopify API failure
5. Integration tests pass for send-pipeline, credit enforcement, and process-reply
6. `npm run build` + `vitest run` pass

## Subphase Index
* a — Address-to-Order Automation Pipeline
* b — Integration Tests for Critical Paths
