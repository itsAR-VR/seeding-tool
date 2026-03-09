# Phase 10 Plan — End-to-End Seeding Rollout Completion

## Original User Request
> Split this whole program up and one-shot the entire thing until it is working in the platform.
> Include the credit-based system.
> Re-run the full process with brand identity deciding approve/disapprove and only finding influencers within the brand niche.
> Do explorer passes first to pull previous seeding-tool context from repo/docs/memory/history so missed details are included.
> Then run /skill phase-plan.
> Then run /skill phase-gaps with Opus 4.6.
> Then use /skill terminus-maximus to relentlessly complete the full implementation and testing.
> Only surface to the human if there is a massive blocker or something genuinely uncertain after using available context.

## Concrete Product/Program Scope
1. Finish the real Playwright execution path in the Fly creator-search worker.
2. Keep minimum-safe Fly sizing: shared-cpu-1x, 1 GB RAM, no volume, low concurrency unless evidence proves insufficient.
3. Wire app <-> worker auth and request flow so analysis jobs actually run, not 501.
4. Add cost/credit consumption logic with roughly 2-3x markup over raw cost.
5. Use brand website URL in onboarding, with https://sleepkalm.com as live reference.
6. Use extracted brand metadata/content plus campaign-specific product/context for brand identity approvals.
7. Support per-campaign product selection and use it in brand fit evaluation.
8. Narrow discovery inputs toward brand ICP instead of random creators.
9. Derive matching categories/segments from brand website/profile.
10. Implement in-platform verification: open Instagram/profile links and approve/disapprove against Sleepkalm brand identity + campaign product context.
11. Re-run full flow: discovery -> verification -> approve/disapprove -> outreach drafting -> send-path testing for email + Instagram DM.

## Explorer Findings Summary
- Repo already has a mature Next.js platform under `apps/web` with campaigns, creators, onboarding, review, outreach, inbox, Gmail, Shopify, Unipile, and brand profile scaffolding.
- Brand onboarding already stores `Brand.websiteUrl` and `BrandSettings.brandProfile` using website extraction.
- Review endpoint exists: `/api/campaigns/[campaignId]/creators/[creatorId]/review` with approve/decline/defer state transitions.
- Creator search path is still stubbed in two places:
  - `apps/web/lib/workers/creator-search.ts` only emits Inngest.
  - `apps/web/lib/inngest/functions/creator-search.ts` only creates a tracking job/intervention.
- Fly worker exists at `workers/creator-search/` and is deployed as `podhi-seeding-creator-search`, but `/v1/search` returns `501 not_implemented`.
- Fly config already matches requested minimum-safe sizing: shared CPU, 1 vCPU, 1 GB RAM, no volume, low concurrency.
- Canonical Collabstr dataset exists at `scripts/collabstr-influencers.jsonl` with 568 rows and `profileDump` populated on all sampled rows. Records include `niche`, `bio`, `instagramUrl`, `tiktokUrl`, price, rating, etc.
- No credit system exists in Prisma schema yet.
- Existing send-paths already exist for outreach draft/send, Gmail send, and Instagram DM via Unipile.

## Phase 10 Workstreams

### A. Planning and Red Team
- Create this phase doc with request preserved verbatim.
- Run gap pass with strongest available model lane, explicitly red-teaming missing edges.

### B. Credit System
- Add Prisma models for brand credit balance + ledger/transactions + usage events.
- Add server-side credit pricing constants and debit flow for creator analysis/search.
- Extend billing so Stripe purchase events can mint credits.
- Expose current balance in platform surfaces needed for testing.

### C. Brand Identity + ICP Derivation
- Build brand identity composer from:
  - `Brand.websiteUrl`
  - `BrandSettings.brandProfile`
  - campaign description
  - selected campaign products
- Derive narrow ICP segments/categories/keywords from brand profile and campaign context.
- Seed with Sleepkalm-specific expected niches: sleep, wellness, recovery, self-care, beauty, skincare, fitness, healthy lifestyle, nighttime routine, women’s wellness.

### D. Real Discovery + Verification Pipeline
- Replace stub app->Inngest-only flow with app->Fly worker authenticated request.
- Implement worker search/analysis path using Playwright + OpenAI against profile links.
- Use Collabstr dataset as current discovery source, filtered by derived ICP and campaign criteria, then verify via external profile pages where available.
- Persist search job results + creator recommendations back into Prisma.
- Auto-set approve/disapprove recommendations, with explicit rationale.

### E. Full Workflow Verification
- Apply migrations.
- Run app locally and verify UI changes in browser if any platform screens are touched.
- Test full flow: onboarding/brand -> campaign/product context -> search -> review -> draft outreach -> email send path -> Instagram DM send path.
- Deploy/verify Fly worker and prove the remaining blocker if any final send path cannot complete because of external account constraints.

## Success Criteria
- No more `501` from creator-search worker.
- Credits are deducted on qualifying analysis/search operations and balances are visible/traceable.
- Discovery is narrowed to Sleepkalm-like niches rather than broad random creators.
- Brand identity and campaign product context materially affect approve/disapprove outcomes.
- Platform workflow runs end-to-end inside the app with evidence.

## Known Risks
- Instagram direct scraping/auth may hit platform access friction. If so, fallback must still verify against public profile pages or declared creator profile links and clearly log the constraint.
- Gmail / Unipile send-path testing may require live connected accounts in local env. Need to distinguish platform bug from missing external auth.
- Fly worker may need env synchronization for OpenAI/internal auth before deployment.
