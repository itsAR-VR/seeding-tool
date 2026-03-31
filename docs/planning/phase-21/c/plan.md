# Phase 21c — Commit Hardening (RED TEAM append-only): extraction manifest audit, staged-diff grep, and branch/commit safety

## Focus

This append-only RED TEAM subphase adds the missing execution guardrails that Phase 21a–21b assume but do not currently specify tightly enough: a final extraction-manifest audit, focused verification commands, stage-only forecast grep, lockfile churn control, and a direct-to-`main` commit safety gate.

This subphase exists because `a` and `b` already contain non-empty `Output` and `Handoff`, so they are treated as read-only by the RED TEAM rules.

## Inputs

- `docs/planning/phase-21/plan.md`
- `docs/planning/phase-21/a/plan.md`
- `docs/planning/phase-21/b/plan.md`
- Current worktree status and forecast-ref grep over `apps/web/`
- Mixed-file extraction targets:
  - `apps/web/prisma/schema.prisma`
  - `apps/web/app/api/inngest/route.ts`
  - `apps/web/app/api/gmail/webhook/route.ts`
  - `apps/web/lib/inngest/functions/run-automation.ts`
  - `apps/web/lib/integrations/methods.ts`
  - `apps/web/app/(platform)/layout.tsx`
  - `apps/web/app/(platform)/settings/page.tsx`
  - `apps/web/app/(platform)/settings/connections/page.tsx`
  - `apps/web/package.json`

## Skills Available for This Subphase

- Immediately available via continuous `skill-oracle` checks:
  - `commit-work` — commit structure and staging discipline
  - `backend-coding-agent` — shared-file extraction and schema awareness
  - `code-review` — pre-commit diff review
  - `phase-review` — verification framing if a follow-up review pass is needed
- Missing but required:
  - No dedicated partial-staging / mixed-worktree extraction skill
  - Fallback: explicit path-based `git add`, staged diff review, and forecast-ref grep against staged files only
  - Optional install if fallback proves insufficient:
    - `npx clawhub@latest inspect git-workflows`
    - `npx clawhub@latest install git-workflows`
    - `npx clawhub@latest inspect pr-commit-workflow`
    - `npx clawhub@latest install pr-commit-workflow`
- Continuous note:
  - `skill-oracle` checks are being rerun while refining this plan so staging/commit assumptions stay aligned with the local skill catalog.

## Work

### 1. Extraction Manifest Audit

1. Re-run forecast-ref grep over the nine shared files before editing.
2. Confirm whether any stale inline comments (for example provider/type comments in `schema.prisma`) still describe removed forecast behavior.
3. Record the exact final extraction list before staging so no shared file is skipped accidentally.

### 2. Focused Verification Commands

Run from `apps/web/` after extraction, before staging:

- `npx prisma validate`
- `npm run build`
- `./node_modules/.bin/vitest run __tests__/creator-search/*.test.ts __tests__/identity/*.test.ts __tests__/metrics/*.test.ts __tests__/seeding/*.test.ts`

If dependency cleanup changes `package-lock.json`, prefer a targeted command and inspect the resulting diff before proceeding.

### 3. Stage Audit (No Blanket Add)

1. Stage only explicit Phase 20 paths.
2. Run:
   - `git diff --cached --name-only`
   - `git diff --cached --stat`
3. Re-grep the staged shared files for forecast refs before commit:
   - `forecast|Forecast|forecasting|processRequestedForecastRun|google_ads|meta_ads|amazon_seller_central|google_sheets|xlsx|forecast_refresh`
4. Confirm `.next/`, screenshots, pure forecast directories, and forecast migration files are absent from the staged set.

### 4. Branch / Commit Safety Gate

1. Treat `main` as the locked commit target.
2. Include `docs/planning/phase-21/` in the staged bundle.
3. Use one coherent commit only after the stage audit is clean.

## Output

- A hardened execution overlay for Phase 21 covering extraction audit, focused verification, staged-file grep, and commit safety
- A direct-to-`main` commit safety overlay that matches the locked decisions in the root plan
- A clarified staged-file review sequence that prevents forecast leakage into the Phase 20 commit

## Handoff

Treat this RED TEAM hardening overlay as a prerequisite for executing 21a–21b. If the extraction manifest or branch target remains ambiguous, stop and resolve that before staging any commit.
