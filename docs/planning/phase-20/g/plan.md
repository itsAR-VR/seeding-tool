# Phase 20g — Execution Hardening: Tenancy, Retention, Feature-Flag Cutover & Evaluation Gates

## Focus

This append-only RED TEAM subphase adds the cross-cutting execution gates that Phase 20a–20f currently assume but do not specify tightly enough: shared-schema sequencing, global-identity tenancy boundaries, raw-payload retention/redaction, feature-flagged rollout, and measurable evaluation gates before any auto-linking or portfolio-driven write path goes live.

This subphase exists because Phase 20a–20f already contain non-empty `Output` and `Handoff` sections, so they are treated as read-only by the RED TEAM skill rules.

## Inputs

- Root RED TEAM findings in `docs/planning/phase-20/plan.md`
- Current worktree overlap:
  - `apps/web/prisma/schema.prisma` has active forecasting-domain changes
  - `apps/web/lib/creator-search/*` and `apps/web/app/api/campaigns/[campaignId]/search/route.ts` have active local edits
- Existing auth and rollout primitives:
  - `apps/web/lib/feature-flags.ts`
  - membership-based route authorization patterns in `apps/web/app/api/**`
- Deep research reference: `deep-research-report (1).md` sections on identity resolution, evaluation, and privacy/terms risk

## Skills Available for This Subphase

- `find-local-skills`: local skill-index path from the skill docs is missing in this environment, so availability was verified via the installed `/Users/AR180/.codex/skills` inventory instead.
- Immediately available:
  - `phase-gaps`
  - `backend-coding-agent`
  - `database-design`
  - `database-schema-designer`
  - `code-review`
  - `context7-docs`
  - `playwright-testing`
  - `browse-qa`
  - `session-handoff`
  - `skill-oracle`
- `find-skills`: global search returned `darraghh1/my-claude-setup@audit-plan` and `rfxlamia/claude-skillkit@red-teaming`, but they are not installed here.
- Missing but referenced in Phase 20a–20f:
  - `superpowers:test-driven-development`
  - `superpowers:writing-plans`
  - `superpowers:executing-plans`
  - `superpowers:brainstorming`
  - `superpowers:dispatching-parallel-agents`
  - `superpowers:verification-before-completion`
  - `superpowers:requesting-code-review`
  - `vercel:nextjs`
  - `vercel:workflow`
  - `vercel:cron-jobs`
- Fallback handling:
  - Use local `backend-coding-agent` + `database-design` for implementation planning.
  - Use repo-native Next.js/Inngest patterns instead of missing Vercel-specific skills.
  - Use targeted Vitest/ESLint/Playwright verification instead of missing `superpowers:*` wrappers.
- Continuous note:
  - Skill checks are being rerun during refinement; if availability changes, this subphase must be updated before implementation starts.

## Work

### 1. Shared-Schema Preflight & Sequencing

1. Freeze a schema baseline before any Phase 20 implementation branch starts.
2. Require the forecasting migration currently present in the worktree to land or be explicitly rebased first.
3. Record one migration strategy for Phase 20:
   - either a single coordinated migration train across 20a–20f
   - or one migration per subphase with explicit rebase steps between letters.
4. Validation:
   - `cd apps/web && npx prisma validate`
   - `cd apps/web && npm run db:push` against a disposable/dev DB before the first Phase 20 migration is cut
5. Add a conflict log entry if `apps/web/prisma/schema.prisma` changes while Phase 20 is in flight.

### 2. Tenancy & Authorization Rules for Global Identity

1. Treat `InfluencerIdentity`, `InfluencerPlatformProfile`, `IdentityEdge`, and `ContactPoint` as internal/global data structures.
2. For every new API route proposed in 20b, 20e, and 20f, require brand-scoped authorization via:
   - `createClient()`
   - `getUserBySupabaseId()`
   - `BrandMembership`
   - a brand-owned anchor record (`Creator`, `CampaignCreator`, or `Campaign`)
3. Forbid direct “list all possible matches” queries over global identity tables without a brand-scoped join.
4. Require tests for cross-brand denial cases on:
   - `/api/identity/review`
   - `/api/campaigns/[campaignId]/seed-list`
   - `/api/creators/[creatorId]/provenance`
   - `/api/analytics/seeding-kpis`

### 3. Raw Payload, Logging & Retention Guardrails

1. `CreatorRawPayload` must default to normalized/truncated payloads, not full raw HTML dumps.
2. Full raw payload capture, if ever enabled, must be:
   - feature-flagged
   - time-limited
   - redacted for obvious PII
   - capped by size
3. Require explicit retention and cleanup:
   - normalized payloads retained for a bounded window
   - any full-payload mode purged aggressively
4. Structured logs must never emit raw email addresses or full HTML bodies.
5. Add a cleanup/retention task before considering 20a complete.

### 4. Feature-Flagged Rollout & Shadow Mode

1. Reuse `apps/web/lib/feature-flags.ts` instead of inventing a second rollout system.
2. Add Phase 20 flags before implementation work starts:
   - `identityGraphEnabled`
   - `identityAutoLinkEnabled`
   - `decisionEngineScoringEnabled`
   - `portfolioOptimizerEnabled`
   - `outcomeLearningEnabled`
3. Rollout sequence:
   - shadow-write raw evidence and score components first
   - review-only identity queue second
   - shadow portfolio preview third
   - live ranking / live auto-link only after evaluation gates pass
4. All flags fail closed; broken flag reads disable the new behaviors.

### 5. Evaluation Gates Before Live Decisions

1. Identity auto-link must not enable until measured precision is acceptable on a labeled review set.
2. Composite scoring must produce side-by-side comparisons against the current ranking before it becomes the default shortlist order.
3. Portfolio output must first ship as preview-only so operators can compare:
   - top-N current list
   - optimized portfolio candidate set
4. Minimum verification set before promotion:
   - unit tests for each new scorer/matcher
   - integration tests on one full discovery job
   - manual review on a real campaign-sized sample
   - browse QA for the new operator surfaces

### 6. Validation Commands & Completion Gates

Use these gates for every Phase 20 implementation slice that touches the app:

- `cd apps/web && ./node_modules/.bin/eslint <touched files>`
- `cd apps/web && ./node_modules/.bin/vitest run <touched tests>`
- `cd apps/web && npx prisma validate` when schema changes
- `cd apps/web && npm run build` before merging any new API/UI surfaces
- Local API smoke checks for any new route using a brand-scoped session
- Playwright/browser QA for review queue, provenance UI, and seed-list preview when those surfaces land

## Output

- A fixed execution contract for Phase 20 covering schema sequencing, tenancy, retention, rollout, and evaluation gates
- A required feature-flag list for Phase 20 behaviors
- A concrete validation checklist for future implementation letters / branches
- A coordination policy for shared-schema and creator-search overlaps

## Handoff

All future implementation against Phase 20a–20f should treat this hardening subphase as a prerequisite overlay. If any implementation branch cannot satisfy these gates, Phase 20 should pause and the root plan should be updated before code continues.
