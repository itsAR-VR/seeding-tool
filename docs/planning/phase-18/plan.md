# Phase 18 — Seed Scale Platform QA / Fix Cycle

## Original User Request (verbatim)

create a plan using /skill phase-plan pulling in /skill skill-oracle then have a different model red team and do /skill phase-gaps (if we are using claude, use openai models, always use SOTA for this. for example opus 4.6 and gpt 5.4 are SOTA from the 2 research companies right now) then implement with the stronger model which is gpt 5.4 xhigh right now. using /skill terminus-maximus. then run QA with our QA agent on the changes and the thought process + everything done. and once done /skill commit-work

---

## Purpose

Close the operator-trust gap surfaced in `docs/qa/seed-platform-qa-master.md`. Work through a structured QA→triage→fix→verify→commit cycle so Seed Scale moves from "demoable but not clean" to signoff-ready for an internal pilot. The cycle follows AR's prescribed skill chain: phase-plan → skill-oracle discovery → GPT red-team + phase-gaps → implement via terminus-maximus (GPT-5.4 xhigh) → QA agent verification → commit-work.

---

## Context

**QA synthesis exists on disk:** `docs/qa/seed-platform-qa-master.md` (untracked, created 2026-03-10)
- 1 Critical finding (placeholder data leakage into live creator flows)
- 5 High findings (missing product guardrails, review-queue count mismatch, unsafe credential UX, weak bulk draft-review ergonomics, connection validation feedback)
- 6 Medium findings (metric label ambiguity, empty-state dead ends, false QA green status, poor explainability, scale ergonomics, multi-brand ghost behavior)
- 3 Low findings (date formatting, icon inconsistency, CTA affordance)

**Last completed phase:** Phase 15 (unified influencer discovery + source-normalized enrichment) — fully closed per `phase-15/review.md`.

**Untracked file on disk:** `docs/qa/` directory (new, not yet committed). This is QA input to phase-18 and should be committed as part of this phase.

**Git status at phase creation:** Only `docs/qa/` untracked. No other in-progress agent work detected.

**Fast-fix sequence from QA master:**
1. Trust repair → remove/flag placeholder creator data, fix review-queue count truth, add integration blockers
2. Operator workflow repair → bulk draft-review, empty-state CTAs, connection UX, metric labels
3. QA reliability repair → seeded local auth fixture, platform smoke suite, fresh screenshot evidence

---

## Model Strategy (AR mandate)

| Role | Model | Why |
|------|-------|-----|
| Planning / orchestration | Claude Sonnet 4.6 (current) | Phase plan author |
| Red team / phase-gaps | **GPT-5.4** (OpenAI SOTA) | Adversarial pass — different architecture, catch Claude blind spots |
| Implementation | **GPT-5.4 xhigh** via terminus-maximus | Strongest available coding model |
| QA verification agent | QA agent (configured lane) | Independent verification of changes + thought process |
| Commit | commit-work skill | Atomic, well-messaged commits |

Rule: when Claude is planning, red team uses OpenAI. Always SOTA for adversarial passes.

---

## Skills Available for Implementation

### Locally Installed — Directly Relevant
| Skill | Location | Role in This Phase |
|-------|----------|--------------------|
| `plan` | `~/.openclaw/skills/plan` | Phase scaffold (this file) |
| `skill-oracle` | `~/.openclaw/skills/skill-oracle` | Full skill discovery across 172 local skills |
| `phase-gaps` | `~/.openclaw/skills/phase-gaps` | RED TEAM adversarial review of this plan |
| `terminus-maximus` | `~/.openclaw/skills/terminus-maximus` | Relentless implementation loop (GPT-5.4 xhigh) |
| `commit-work` | `~/.openclaw/skills/commit-work` | Atomic git commits with good messages |
| `qa-regression` | `~/.openclaw/skills/qa-regression` | Regression test guidance |
| `qa-test-planner` | `~/.openclaw/skills/qa-test-planner` | QA test plan generation |
| `webapp-testing` | `~/.openclaw/skills/webapp-testing` | Web app test patterns |
| `code-review` | `~/.openclaw/skills/code-review` | Code review patterns |
| `code-refactoring` | `~/.openclaw/skills/code-refactoring` | Refactoring guidance |
| `browser-automation` | `~/.openclaw/skills/browser-automation` | Playwright browser verification |
| `live-env-playwright` | `~/.openclaw/skills/live-env-playwright` | Playwright against live env |
| `playwright-testing` | `~/.openclaw/skills/playwright-testing` | Playwright test patterns |
| `karpathy-guidelines` | `~/.openclaw/skills/karpathy-guidelines` | Surgical change discipline |
| `sentry-debugger` | `~/.openclaw/skills/sentry-debugger` | Error surface analysis |

### Requested in AR's Workflow — Status
| Requested Skill | Local Name | Status |
|-----------------|------------|--------|
| `/skill phase-plan` | `plan` | ✅ installed |
| `/skill skill-oracle` | `skill-oracle` | ✅ installed |
| `/skill phase-gaps` | `phase-gaps` | ✅ installed |
| `/skill terminus-maximus` | `terminus-maximus` | ✅ installed |
| `/skill commit-work` | `commit-work` | ✅ installed |

### Requested-but-Missing
None. All five skills named in AR's request are present locally.

---

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 15 | ✅ Complete | Creator search/discovery surfaces — read dependency only | None required, phase closed |

No active concurrent phases detected. `git status` shows only `docs/qa/` untracked. Safe to proceed.

---

## Objectives

* [ ] Commit the existing QA synthesis (`docs/qa/seed-platform-qa-master.md`) as phase input artifact
* [ ] Run skill-oracle discovery pass to confirm tool coverage for each fix subphase
* [ ] RED TEAM this plan with GPT-5.4 via phase-gaps — catch gaps, weak assumptions, ambiguous scope
* [ ] Execute trust-repair fixes (Critical + High) via terminus-maximus / GPT-5.4 xhigh
* [ ] Execute workflow-repair fixes (High/Medium) via terminus-maximus / GPT-5.4 xhigh
* [ ] Execute QA-reliability fixes (Medium) via terminus-maximus / GPT-5.4 xhigh
* [ ] Run QA agent verification pass over all changes + thought process
* [ ] Commit all changes with atomic, well-messaged commits via commit-work skill

---

## Constraints

- Do not touch `.env`, `.env.*`, or any environment-variable/secrets files
- Do not revert or destroy Phase 15 work
- Each fix subphase must produce screenshot/test evidence before closing
- `docs/qa/seed-platform-qa-master.md` is the authoritative source of truth for findings; do not infer new bugs from code inspection without evidence trace
- Commit scope: only the files actually changed by this phase; never stage unrelated diffs
- Red team model must differ from implementation model (OpenAI ↔ Anthropic alternation per AR rule)

---

## Success Criteria

Phase 18 is complete when **all of the following are true**:
- [ ] No placeholder creator metrics remain in reviewed campaign data
- [ ] Discover → review counts match exactly
- [ ] Draft Outreach supports inline edit + bulk approve/decline actions
- [ ] Send/setup blockers are explicit when products or integrations are missing
- [ ] Connection secrets are masked, copy-safe, and testable
- [ ] At least one non-skipped platform smoke flow runs and produces fresh browser evidence
- [ ] QA agent has reviewed all changes and signed off
- [ ] All changes committed atomically with clean commit messages
- [ ] `docs/qa/seed-platform-qa-master.md` committed as phase-18 input artifact

---

## Subphase Index

* **a** — QA Synthesis Commit + Skill-Oracle Discovery
* **b** — RED TEAM: phase-gaps pass (GPT-5.4) on this plan
* **c** — Trust Repair: Critical + High severity fixes (terminus-maximus / GPT-5.4 xhigh)
* **d** — Operator Workflow Repair: High/Medium severity fixes (terminus-maximus / GPT-5.4 xhigh)
* **e** — QA Reliability + Final Verification (QA agent + commit-work)

---

## Execution Log

- 2026-03-10 04:19 EDT — Resynced implementation lane onto canonical `phase-18/` after planning-directory renumber. Existing in-flight UI fixes were preserved; all new evidence/progress logging moved under `docs/planning/phase-18/`.
- 2026-03-10 04:25 EDT — Implemented first trust-repair slice: campaign readiness gating, truthful review empty state, outreach blockers, and safer credential helper copy. Fresh evidence written under `phase-18/c/evidence/` and `phase-18/d/evidence/`.
- 2026-03-10 04:25 EDT — Verification recovered from local environment drift by restoring the missing `playwright` package with `npm install --no-fund --no-audit`, then rerunning `npm run build` successfully.
