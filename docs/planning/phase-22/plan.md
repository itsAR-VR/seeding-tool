# Phase 22 — Stabilize & Unlock: Revenue Safety, Access Control, and Cleanup

## Original User Request (verbatim)

I Want to do a big test and see how we can actually improve the seeding tool. I'm pretty sure the influencer identification is pretty garbage. The data labeling of those influencers is pretty shit too. The enrichment is not there. I'm not sure if email outreach works and all the platforms are connected. I'm just not sure what's going on. I need clarity, I need structure, I need it to work, and I'm just confused.

I need to figure out, using the skills that we have in our repository, how we can make this work, how we can make this work well. If we need to refactor the entire platform, I'm down with it. I just want it to look good, work, not be clunky, and be intelligently designed. I'm even fine again with refactoring the entire thing. I just want the key items to be fixed and for it to work.

## Purpose

Fix revenue/safety blockers, enforce access control, and clean up tech debt before building new features. This is the "stop the bleeding, lock the doors, sweep the floor" phase — the prerequisite for everything that follows.

## Context

A comprehensive audit (3 parallel exploration agents + skill-oracle + 10x analysis + Ultraplan refinement) revealed the platform has strong bones but critical safety gaps:

### Verified Broken Items (Ultraplan-corrected)

1. **Credit enforcement missing**: `ensureCredits()`/`debitForOperation()` exist in `lib/credits.ts` but are **never called** from any API route. Searches proceed without payment.
2. **Daily send limits unenforced**: `EmailAlias.dailyLimit` (default 50) exists in schema. `SendingMetric` tracks daily sends. But `lib/gmail/send.ts` never checks `sent >= dailyLimit`.
3. **No `List-Unsubscribe` header**: `buildRawEmail()` builds headers but never includes `List-Unsubscribe`. The unsubscribe endpoint and HMAC system exist at `app/api/webhooks/unsubscribe/route.ts` — only the header is missing.
4. **First-brand assumption everywhere**: `getCurrentBrandMembership()` and ~20 API routes use `findFirst({ orderBy: { createdAt: 'asc' } })` — always returns the oldest brand.
5. **RBAC stored but not enforced**: `BrandMembership.role` has owner/editor/viewer but only 1 of ~20 routes checks it.
6. **Inngest events untyped**: `events.ts` declares 3 event types but 17+ `inngest.send()` calls use undeclared names.
7. **Shopify API outdated**: Hardcoded `apiVersion = "2024-01"` in `lib/shopify/client.ts:39`.
8. **AI model hardcoded**: `gpt-5-mini` appears 7 times across `lib/ai/outreach-drafter.ts` and `lib/inbox/ai.ts`.
9. **Credits re-export**: `lib/credits/credits.ts` is a one-line `export * from "../credits"` — trivial cleanup but confusing.

### Ultraplan Corrections (draft plan inaccuracies fixed)

| Draft Claim | Reality |
|---|---|
| "Phase 20 decision engine is dormant" | Phase 20 code doesn't exist in the codebase |
| "Instagram Graph API is a stub" | Full 356-line implementation at `lib/instagram/client.ts` |
| "Cloudinary is empty" | Full implementation at `lib/cloudinary/client.ts` (133 lines) |
| "Track17 is unused" | Full client (166 lines) + 2 Inngest functions + webhook handler |
| "No unsubscribe endpoint" | Exists at `app/api/webhooks/unsubscribe/route.ts` |
| "`job-runner.ts` is 829 lines" | 600 lines |

## Skills Available for Implementation

**Local (installed):**
- `backend-coding-agent` — API routes, middleware, credit enforcement, RBAC
- `gstack-cso` — Security audit for billing/auth code
- `mo-book-email-deliverability-setup` — CAN-SPAM/List-Unsubscribe compliance
- `mo-book-email-preference-center` — Unsubscribe flow patterns
- `javascript-typescript` — Inngest event type safety, TypeScript generics
- `code-refactoring` — AI config extraction, credits consolidation
- `dependency-updater` — Shopify API version update
- `context7-docs` — Fetch current Inngest/Shopify/Stripe docs
- `qa-test-planner` — Integration test plan generation
- `code-review` — Post-implementation review gate
- `phase-review` — Post-phase verification
- `deep-build` — Multi-model execution for security-sensitive work
- Stripe MCP tools — Direct Stripe API for billing verification

**ClawHub (installable if needed):**
- `authorization` — RBAC patterns (recommended install for subphase b)
- `stripe-best-practices` — Billing safety patterns
- `compliance-officer` — CAN-SPAM compliance review

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 21 | Complete | `docs/planning/phase-21/plan.md` modified (uncommitted) | No conflict — Phase 21 was forecasting extraction |
| Phase 20 | Complete | Schema + lib modules from Phase 20 commit | No conflict — Phase 22 builds on top |

## Objectives

* [ ] Credit checks enforced (fail-closed) on all billable API routes
* [ ] Daily email send limits enforced before every send
* [ ] `List-Unsubscribe` header added to all outbound emails
* [ ] Credits module consolidated (remove re-export file)
* [ ] RBAC middleware enforcing viewer/editor/owner roles on mutations
* [ ] Multi-brand switching works via `X-Brand-Id` header
* [ ] All Inngest event types declared with typed payloads
* [ ] Shopify API updated to `2025-04`
* [ ] AI model extracted to configurable constant
* [ ] Integration tests for credit enforcement and send pipeline

## Constraints

- No behavioral changes to working features — safety fixes only
- All changes must be backward-compatible (existing brands unaffected)
- Feature flags remain as-is (7 existing flags, no new ones needed)
- Keep Playwright worker on Fly.io for Instagram validation (user decision)
- Immutable patterns required (no in-place mutation)
- Max 800 lines per file
- 80%+ test coverage on new code

## Success Criteria

1. `npm run build` passes with zero type errors
2. `vitest run` passes all existing + new tests
3. Attempting a search with 0 credits returns HTTP 402
4. Sending email when alias at dailyLimit returns an error (not silent proceed)
5. Sent emails contain `List-Unsubscribe` header with valid HMAC token
6. Viewer-role user cannot POST to mutation routes (returns 403)
7. Multi-brand user can switch brands via `X-Brand-Id` header
8. All `inngest.send()` calls use declared event types (TypeScript enforced)
9. Shopify API calls use `2025-04` version
10. AI model references use shared `AI_MODEL` constant (0 hardcoded strings)

## Subphase Index

* a — Revenue & Safety Guards (credits, send limits, List-Unsubscribe, credits cleanup)
* b — RBAC & Multi-Brand Fix (role enforcement, brand switching, route migration)
* c — Cleanup & Type Safety (Inngest events, Shopify version, AI config)
