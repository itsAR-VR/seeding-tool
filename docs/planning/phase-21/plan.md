# Phase 21 — Phase 20 Finalization: Forecasting Extraction & Commit

## Original User Request (verbatim)

Forecasting was taken to a different project. This is what Codex told me after I gave it this prompt. "Had a review done on the seeding process and phase 2. Go ahead and check it out and complete any of the action items that are there if necessary."

Worked for 9m 20s
I checked both reviews. Phase 2 is historical and already closed as a landing-page audit in plan.md, so there was nothing to execute there. The live action items were in review.md, and I completed the ones that were still real in code.

I added fail-closed Phase 20 flag gating in the main seeding runtime and APIs, so scoring/identity/portfolio/provenance/KPI surfaces no longer run unconditionally when the brand flags are off. That work is in job-runner.ts, service.ts, route.ts, route.ts, route.ts, route.ts, and route.ts. I also filled the feedback-loop gap by calculating responseTimeHours on reply events in outcome-recorder.ts, improved multilingual classification in classification.ts, and added the missing review-driven tests for anomaly detection, authenticity, contact extraction, outcome recording/features, calibration, and multilingual classification under tests. I then updated review.md so it reflects the current state instead of stale follow-ups that were already resolved.

Verification passed with targeted eslint, vitest (45 tests), and npm run build. The remaining open items from the review are the ones that actually still need a different environment or a broader rollout step: rehearse the manual Phase 20 migration on a disposable DB, add DB-backed integration tests for matching.ts and decision-engine.ts, and do browser QA on the new identity-review/seed-list surfaces.

In the prompt, I meant to say phase 20, not phase 2. We need to go ahead and complete the rest of the work here as well, with the feature flag gating, the missing test, the daily cron job, and obviously committing changes as well.

## Purpose

Finalize Phase 20 (Seeding Decision Engine) for commit. The forecasting domain was developed in the same worktree but has been moved to a separate project. Nine shared files contain mixed forecasting + Phase 20 changes that must be surgically separated before Phase 20 can be committed cleanly. Codex already completed the feature flag gating, missing tests, daily cron jobs, and review updates — the remaining work is forecasting extraction and commit.

## Context

Phase 20 implementation is complete: 18 library files, 8 Prisma models, 6 API routes, 45 passing tests, 5 feature flags (fail-closed), 2 Inngest cron jobs. All changes are uncommitted — 37 modified files + 50+ untracked files.

The forecasting domain (7 Prisma models, 5 library files, 8 API routes, 3 pages, 4 components, 1 Inngest function, 1 migration) was built in the same worktree but is being moved to a separate project. Nine shared files have both forecasting and Phase 20 changes mixed together.

### What Codex Already Completed (from Phase 20 review follow-ups)

- Feature flag gating in job-runner.ts and 6 API routes
- responseTimeHours computation in outcome-recorder.ts
- Multilingual classification improvements
- Tests for anomaly detection, authenticity, contact extraction, outcome recording/features, calibration (45 tests total)
- Daily cron jobs: collect-daily-snapshots.ts + compute-authenticity.ts (both registered in inngest route)
- Manual Prisma migration (20260330004500_add_phase20_seeding_decision_engine)
- Updated review.md

### Mixed Files Requiring Surgical Edits

| File | Forecast to remove | Phase 20 to keep |
|------|-------------------|-----------------|
| `prisma/schema.prisma` | 7 Brand relations (lines 120-126), Automation.type comment, 7 forecast model blocks (lines 1273-1476) | All Phase 20 models |
| `app/api/inngest/route.ts` | `processRequestedForecastRun` import + array entry | `collectDailySnapshots` + `computeAuthenticity` |
| `app/(platform)/layout.tsx` | Forecast nav item (line 9) | No Phase 20 changes in this file |
| `app/(platform)/settings/page.tsx` | Forecast settings link (lines 34-39) | No Phase 20 changes in this file |
| `app/(platform)/settings/connections/page.tsx` | 4 provider guide blocks (google_ads, meta_ads, amazon_seller_central, google_sheets) | No Phase 20 changes in this file |
| `lib/inngest/functions/run-automation.ts` | 2 forecast imports + else-if block (lines 5-6, 137-157) | No Phase 20 changes in this file |
| `app/api/gmail/webhook/route.ts` | 3 forecast imports + forecast email trigger block (lines 9-13, 87-126) + extractEmailAddress helper (lines 340-350) | `recordOutcomeEvent` import + 3 outcome recording calls |
| `lib/integrations/methods.ts` | 4 forecast provider entries | No Phase 20 changes in this file |
| `package.json` | `xlsx` dependency | No Phase 20 dependency additions |

### Files to NOT Stage (pure forecasting)

- `apps/web/lib/forecasting/` (5 files)
- `apps/web/app/(platform)/forecast/` (3 pages)
- `apps/web/app/(platform)/settings/forecast/page.tsx`
- `apps/web/app/api/forecast/` (8 routes)
- `apps/web/components/forecast-*.tsx` (4 files)
- `apps/web/__tests__/forecasting/` (4 files)
- `apps/web/__tests__/webhooks/gmail-forecast-trigger.test.ts`
- `apps/web/lib/inngest/functions/process-forecast-run.ts`
- `apps/web/prisma/migrations/20260328224500_add_forecasting_domain/`

## Repo Reality Check (RED TEAM)

- What exists today:
  - Forecast references are present in the nine shared files named above, and a broader repo grep confirms the remaining forecast refs are isolated to forecast-only directories/routes that the plan already intends to leave unstaged.
  - `apps/web/package.json` still carries `xlsx`, and repo search shows it is only imported by `apps/web/lib/forecasting/workbook.ts`.
  - The current worktree is heavily dirty across both Phase 20 and forecasting files, plus untracked docs and artifacts (`.next/`, screenshots, `docs/planning/phase-20/`, `docs/planning/phase-21/`).
  - `docs/planning/phase-21/a/plan.md` and `docs/planning/phase-21/b/plan.md` already have non-empty `Output` and `Handoff`, so they are read-only under `phase-gaps`.
- What the plan assumes:
  - Only the nine shared files need surgical extraction before a clean Phase 20 commit can be staged.
  - Running a generic `npm install` is an acceptable way to update the lockfile after removing `xlsx`.
  - A direct commit on `main` is the chosen target for this phase.
  - Full-suite `vitest` is the right verification target even though forecast tests and other unrelated work are present in the tree.
- Skills discovered via `skill-oracle` checks:
  - Immediately available: `commit-work`, `backend-coding-agent`, `code-review`, `code-refactoring`, `phase-review`, `session-handoff`.
  - No dedicated local skill was found for “forecast extraction from a mixed worktree” or “git partial staging guardrails”; fallback is explicit path-based staging plus `code-review`.
  - Continuous `skill-oracle` checks are being used while refining this phase so commit/staging assumptions stay grounded in the local catalog.
- Skills discovered via ClawHub/global search:
  - Relevant installable matches exist (`git-workflows`, `pr-commit-workflow`), but none are required because the local `commit-work` flow is sufficient for this phase.
  - If the local fallback proves insufficient, the most relevant install commands are:
    - `npx clawhub@latest inspect git-workflows`
    - `npx clawhub@latest install git-workflows`
    - `npx clawhub@latest inspect pr-commit-workflow`
    - `npx clawhub@latest install pr-commit-workflow`
- Verified touch points:
  - `apps/web/prisma/schema.prisma`
  - `apps/web/app/api/inngest/route.ts`
  - `apps/web/app/api/gmail/webhook/route.ts`
  - `apps/web/lib/inngest/functions/run-automation.ts`
  - `apps/web/lib/integrations/methods.ts`
  - `apps/web/app/(platform)/layout.tsx`
  - `apps/web/app/(platform)/settings/page.tsx`
  - `apps/web/app/(platform)/settings/connections/page.tsx`
  - `apps/web/package.json`
- Multi-agent coordination:
  - The current dirty worktree includes active Phase 20 implementation files and untracked forecast files at the same time, so this phase must use explicit stage-audit steps and avoid any blanket `git add -A`.
  - Phase 20 and the forecast extraction are coupled through `schema.prisma`, `inngest` routing, Gmail webhook logic, and settings/navigation surfaces.

## Skill Feasibility (RED TEAM)

- Critical skill check:
  - `commit-work` → available
  - `backend-coding-agent` → available
  - `code-review` → available
  - `phase-review` → available
- Missing but required:
  - No dedicated “partial staging / mixed-worktree extraction” skill → fallback: explicit staged-file manifest, `git diff --cached --name-only`, and forecast-ref grep against staged files only.
  - No dedicated “lockfile-only dependency removal” skill → fallback: use repo-native npm commands from `apps/web/` and inspect the resulting `package-lock.json` diff before staging.
  - Optional install path if fallback is insufficient: `git-workflows` or `pr-commit-workflow` from ClawHub (see Repo Reality Check above).

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 20 | Implementation complete, uncommitted | Direct — this phase commits Phase 20's work | This phase is Phase 20's commit vehicle |
| Forecasting domain | Being extracted | schema.prisma, inngest route, gmail webhook, run-automation, layout, settings | Surgical separation in subphase a |
| Phase 21 | Untracked plan + dirty worktree | This plan itself is not yet committed | Include `docs/planning/phase-21/` in the staged Phase 20 bundle as part of the final commit |

## Objectives

* [ ] Remove all forecasting references from shared files so Phase 20 stands alone
* [ ] Verify schema, build, and focused Phase 20 tests pass after forecasting extraction
* [ ] Stage a forecast-free Phase 20 bundle using explicit path-based staging only
* [ ] Create one coherent Phase 20 commit directly on `main`

## Constraints

1. No Phase 20 code changes — only remove forecasting references from shared files
2. Forecasting files stay as untracked in the worktree (not deleted, not committed)
3. The Phase 20 Prisma migration (20260330004500) must NOT reference forecast tables
4. Build must pass after extraction — no dangling imports
5. Verification must run from `apps/web/` using the app-local scripts and Vitest globs, not root-level shorthand
6. Staging must be explicit; do not use `git add -A`, `git commit -a`, or any broad include of `.next/`, screenshots, or forecast-only paths
7. Lockfile churn must be minimized — use targeted npm dependency removal/update steps and inspect the diff before staging
8. Because `a` and `b` are already syntactically complete, any new RED TEAM hardening must be appended as a new subphase, not retrofitted into those letters
9. The final commit must include `docs/planning/phase-21/` alongside the Phase 20 code bundle

## Success Criteria

1. `npx prisma validate` passes without forecast models
2. `cd apps/web && npm run build` succeeds after extraction with zero forecast imports in the staged Phase 20 bundle
3. `cd apps/web && ./node_modules/.bin/vitest run __tests__/creator-search/*.test.ts __tests__/identity/*.test.ts __tests__/metrics/*.test.ts __tests__/seeding/*.test.ts` passes
4. `git diff --cached --name-only` excludes forecast-only directories/files and staged-file grep shows no remaining forecast refs in shared files
5. One Phase 20 commit is ready directly on `main`, and the staged set includes `docs/planning/phase-21/`

## Subphase Index

* a — Forecasting extraction: surgical removal from 9 mixed files
* b — Verification & commit: build check, stage Phase 20 files, commit
* c — Commit Hardening (RED TEAM append-only): extraction manifest audit, focused verification commands, staged-diff grep, and branch/commit safety gate

`c` is appended because subphases `a` and `b` already contain non-empty `Output` and `Handoff`, so they are treated as read-only by the RED TEAM rules.

Where `21b` conflicts with this root plan or `21c`, the root plan + `21c` hardening overlay win.

## RED TEAM Findings (Gaps / Weak Spots)

## Decisions Locked

- Commit target: direct to `main`
- Include `docs/planning/phase-21/` in the same commit as the Phase 20 code bundle
- Use the focused Phase 20 Vitest glob suite, not a broad full-repo `vitest` run

## RED TEAM Findings (Gaps / Weak Spots)

### Highest-risk failure modes

- The plan assumes nine mixed files are the only shared extraction points, but it does not require a final staged-file grep to prove no forecast refs remain in shared files.
  - Plan fix: add a commit-hardening lane that audits the extraction manifest and re-greps staged files before commit.
- The plan commits directly on `main` in a very dirty worktree.
  - Plan fix: require explicit path-based staging plus `git diff --cached --name-only` review before commit; do not add any branch-selection pause because `main` is now a locked decision.
- A generic `npm install` can introduce lockfile churn beyond removing `xlsx`.
  - Plan fix: tighten the plan to use targeted npm commands from `apps/web/` and inspect `package-lock.json` diff before staging.

### Missing or ambiguous requirements

- The plan does not specify whether `docs/planning/phase-21/` itself should be staged with the implementation commit.
  - Plan fix: treat the planning docs as an explicit staging decision instead of silently including or excluding them.
- The plan does not define whether stale forecast-specific comments in `schema.prisma` count as extraction targets.
  - Plan fix: include comment cleanup in the extraction audit so the staged bundle does not still describe removed forecast providers/types.

### Repo mismatches (fix the plan)

- The plan’s verification step uses broad `npx vitest run`, but the validated Phase 20 command set in the repo is the focused creator-search/identity/metrics/seeding glob suite.
  - Plan fix: replace the generic test command with the focused app-local glob command.
- The plan stages `package-lock.json` but only names `package.json` in the mixed-file table.
  - Plan fix: call out lockfile update/review as a first-class extraction concern.

### Performance / timeouts

- `npm install` is underspecified and may be slower/noisier than necessary for a single dependency removal.
  - Plan fix: prefer targeted dependency removal or package-lock-only refresh from `apps/web/`.

### Security / permissions

- Commit/staging steps in a dirty worktree can accidentally include local artifacts or unrelated files.
  - Plan fix: require a denylist check for `.next/`, screenshots, and pure-forecast paths immediately before commit.

### Testing / validation

- The plan lacks an explicit check that staged shared files no longer contain forecast symbols after extraction.
  - Plan fix: add `rg` over the staged-file set before commit.
- The plan does not include a post-stage review command before the final commit.
  - Plan fix: add `git diff --cached --stat` and `git diff --cached` review steps in the appended hardening subphase.

## Assumptions (Agent)

- Assumption: `xlsx` is safe to remove from `apps/web/package.json` because repo search shows it is only used by forecast-only code under `apps/web/lib/forecasting/`. (confidence ~93%)
  - Mitigation check: if any non-forecast spreadsheet import appears during extraction, keep the dependency and split removal into the forecasting repo instead.
- Assumption: the focused Phase 20 Vitest glob suite is the correct verification target for this phase, not the entire repo test matrix. (confidence ~90%)
  - Mitigation check: if the user wants a broader confidence pass, add a separate non-blocking full-suite run after the focused commit gate.
