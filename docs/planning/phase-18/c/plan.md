# Phase 18c — Trust Repair: Critical + High Severity Fixes

## Focus

Implement the **Critical** and **High** severity QA findings from `docs/qa/seed-platform-qa-master.md` using `terminus-maximus` driven by **GPT-5.4 xhigh** (OpenAI SOTA, highest reasoning level).

This is the highest-stakes subphase. The Critical finding (placeholder data leakage) and the High findings directly determine whether the platform reads as trustworthy to an operator. All six items here must be resolved before subphase d begins.

---

## Inputs

- `docs/qa/seed-platform-qa-master.md` — findings 1–6 (Critical + High, lines 1–6 in severity table)
- `docs/planning/phase-18/b/red-team-summary.md` — refined scope from red-team pass
- Refined `phase-18/plan.md` (post red-team edits)
- `terminus-maximus` skill at `~/.openclaw/skills/terminus-maximus/SKILL.md`

---

## Findings Targeted (in implementation order)

| # | Severity | Finding | Acceptance Bar |
|---|----------|---------|---------------|
| 1 | **Critical** | Placeholder/test creator data leaking into operator-facing flows | Zero creators showing `1,500,000` uniform follower count in a real campaign; missing handles/data flagged or excluded |
| 2 | **High** | Missing product guardrail before outreach send | UI explicitly blocks draft outreach send when no Shopify product is attached; error message actionable |
| 3 | **High** | Review-queue count mismatch (UI shows N, DB truth differs) | `discover → review` counts match exactly; source of mismatch identified and patched |
| 4 | **High** | Unsafe credential UX (secrets visible in plain text fields) | Access tokens and API keys masked (password-type input); copy/reveal toggle; no raw secret in page source |
| 5 | **High** | Weak bulk draft-review ergonomics (no bulk actions at 30+ items) | Draft Outreach page supports: inline edit, bulk approve, bulk decline; sticky review toolbar |
| 6 | **High** | No connection validation feedback after credential save | Shopify and Unipile connections test the credential after save and surface success/failure state clearly |

---

## Skills Available for This Subphase

### Locally installed and applicable
| Skill | Role |
|-------|------|
| `terminus-maximus` | Primary — relentless implementation loop, GPT-5.4 xhigh |
| `karpathy-guidelines` | Surgical change discipline — no drive-by refactors |
| `code-review` | Review each fix before closing the loop iteration |
| `browser-automation` | Playwright verification screenshots after each fix |
| `live-env-playwright` | Live-env browser verification |
| `react-dev` | React/Next.js component work (bulk review UI, credential masking) |
| `ui-skills` | UI pattern reference for bulk actions and input masking |
| `sentry-debugger` | If count mismatch has a runtime error trail |

### Requested-but-Missing
- No dedicated "credential masking input" skill — use `react-dev` + `ui-skills` as combined coverage. Fallback: reference OWASP input masking pattern directly.

---

## Work

### Pre-flight
```bash
cd seeding-tool
git status            # confirm clean working tree after 16a commit
git pull --rebase     # ensure latest
npx playwright test   # baseline pass before any changes
```

### Terminus-Maximus loop for each finding

For each finding (1 → 6, in order):
1. Identify affected files (search codebase, trace from QA evidence files)
2. Implement minimal fix
3. Run build + lint
4. Playwright screenshot of affected surface
5. Visually verify screenshot matches acceptance bar
6. If not: fix and re-verify. Repeat until clean.
7. Document evidence in `docs/planning/phase-18/c/evidence/finding-<N>.md`

### Finding 1 — Placeholder data
Key files to check:
- `apps/web/prisma/schema.prisma` (seed scripts / fixtures)
- `apps/web/scripts/` (any seed or fixture scripts generating `1_500_000` followers)
- `apps/web/app/api/creators/` (import route — does it strip/warn on obviously fake metrics?)

Fix approach: add a data-quality guard on import that flags uniform-metric creator rows; remove hardcoded seed data from any dev fixture that leaks into demo campaigns.

### Finding 3 — Review-queue count mismatch
Key files to check:
- `apps/web/app/(platform)/campaigns/[campaignId]/review/` page
- `apps/web/app/api/campaigns/[campaignId]/creators/` route
- Any `count()` query for CampaignCreators in review status

Fix approach: ensure the count query matches the rendered list query (same filters, same status predicate).

### Finding 4 — Credential UX
Key files:
- `apps/web/app/(platform)/settings/connections/page.tsx`
- Any credential input components

Fix approach: `type="password"` + reveal toggle for access token / API key inputs.

### Finding 5 — Bulk draft-review
Key files:
- `apps/web/app/(platform)/campaigns/[campaignId]/outreach/` (or equivalent draft outreach page)
- Any CampaignCreator action APIs

Fix approach: add checkbox column + sticky "Approve selected / Decline selected" toolbar.

---

## Output

1. Code changes implementing findings 1–6 (all in `apps/web/`)
2. `docs/planning/phase-18/c/evidence/` — one finding evidence file per fix (screenshots + verification notes)
3. All changes staged but NOT yet committed (subphase e handles commits)

---

## Handoff

Subphase c hands off to subphase d when all 6 Critical/High findings have evidence files with passing visual verification.

Subphase d picks up Medium findings. The full staged diff from c remains unstaged until after subphase e QA agent pass.

> **Do not commit in this subphase.** Commit discipline is owned by subphase e (commit-work).

## Progress This Turn (Terminus Maximus)
- Work done:
  - Added a source-aware placeholder-data guard in `/api/creators/import` so `creator_marketplace` fallback rows no longer persist the repeated `1,500,000` follower count.
  - Added campaign-level operator-readiness gating so Draft Outreach is blocked until products, approved creators, and at least one send channel exist.
  - Added outreach-page readiness checks plus actionable blockers for missing products / connections.
  - Reworked the review queue to derive headline count and rendered queue from the same in-memory source and added a truthful empty state with next-step CTAs.
  - Tightened credential UX copy on Shopify / Unipile and re-verified masked secret fields.
- Evidence written:
  - `docs/planning/phase-18/c/evidence/finding-1.md`
  - `docs/planning/phase-18/c/evidence/finding-2.md`
  - `docs/planning/phase-18/c/evidence/finding-3.md`
  - `docs/planning/phase-18/c/evidence/finding-4.md`
- Commands run:
  - `./node_modules/.bin/eslint "app/(platform)/campaigns/[campaignId]/page.tsx" "app/(platform)/campaigns/[campaignId]/review/page.tsx" "app/(platform)/campaigns/[campaignId]/outreach/page.tsx" "app/(platform)/settings/connections/page.tsx"` ✅
  - `./node_modules/.bin/eslint "app/api/creators/import/route.ts" "lib/creators/follower-count.ts"` ✅
  - `npm install --no-fund --no-audit` ✅ (restored missing local `playwright` dependency so build verification could run)
  - `npm run build` ✅
  - `npx tsx -e "import { sanitizeFollowerCount, isPlaceholderFollowerCount } from './lib/creators/follower-count.ts'; ..."` ✅
  - local Prisma count check for placeholder marketplace rows ✅ (`creatorPlaceholderCount: 0`, `profilePlaceholderCount: 0`, `campaignPlaceholderCount: 0`)
  - Browser verification against local dev server (`http://localhost:3000`) ✅
- Changed files:
  - `apps/web/app/api/creators/import/route.ts`
  - `apps/web/lib/creators/follower-count.ts`
  - `apps/web/app/(platform)/campaigns/[campaignId]/page.tsx`
  - `apps/web/app/(platform)/campaigns/[campaignId]/review/page.tsx`
  - `apps/web/app/(platform)/campaigns/[campaignId]/outreach/page.tsx`
  - `apps/web/app/(platform)/settings/connections/page.tsx`
- Blockers / open items:
  - Finding 5 (bulk approve/decline toolbar) and finding 6 (post-save connection validation feedback) are still open.
  - Missing phase artifacts were backfilled under `docs/planning/phase-18/a/skill-map.md` and `docs/planning/phase-18/b/red-team-summary.md`.
- Next action:
  - Hand off Finding 1 to postfix QA with the concrete diff path and verification evidence, then continue on findings 5 and 6 if this lane remains active.
