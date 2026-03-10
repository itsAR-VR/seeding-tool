# Phase 18e — QA Agent Verification + Commit

## Focus

Final QA agent verification pass over everything done in subphases c and d, followed by atomic git commits via the `commit-work` skill. This subphase closes the loop AR specified: implement → QA agent → commit-work.

The QA agent reviews not just the code changes but also **the thought process + everything done** — subphase evidence files, red-team summary, skill map, and implementation decisions are all in scope.

---

## Inputs

- Full staged diff from subphases c + d
- `docs/planning/phase-18/c/evidence/` — Critical/High finding evidence
- `docs/planning/phase-18/d/evidence/` — Medium/Low finding evidence
- `docs/planning/phase-18/b/red-team-summary.md` — red-team verdict and open questions
- `docs/qa/seed-platform-qa-master.md` — original QA findings (acceptance bars)
- Phase 18 success criteria (from root plan)

---

## Skills Available for This Subphase

### Locally installed and applicable
| Skill | Role |
|-------|------|
| `qa-regression` | Regression check — did any fix introduce new breakage? |
| `qa-test-planner` | Confirm test coverage for each fix area |
| `webapp-testing` | Web app verification patterns |
| `commit-work` | Atomic git commits with clean messages |
| `browser-automation` | Final Playwright screenshot sweep |
| `live-env-playwright` | Live-env confirmation run |
| `karpathy-guidelines` | Verify changes are minimal and targeted |
| `code-review` | Final code quality sweep before commit |
| `changelog-generator` | Optional — generate phase changelog from commits |

### Requested-but-Missing
None for this subphase.

---

## Work

### Step 1 — QA Agent verification pass

Invoke the QA agent with the following scope:

**Input to QA agent:**
- Diff: `git diff --staged` (full diff from c+d)
- Context: phase-18 root plan (success criteria section)
- Evidence package: `docs/planning/phase-18/c/evidence/` + `docs/planning/phase-18/d/evidence/`
- Red-team summary: `docs/planning/phase-18/b/red-team-summary.md`
- QA master: `docs/qa/seed-platform-qa-master.md`

**QA agent checklist:**
```
For each finding in the QA master:
  [ ] Is the fix present in the diff?
  [ ] Does the evidence file confirm visual/test verification?
  [ ] Does the fix match the acceptance bar defined in subphase c/d?
  [ ] Did the fix introduce any obvious regression?
  [ ] Is the change minimal and surgical (no scope creep)?

For the overall phase:
  [ ] All success criteria in phase-18/plan.md are met
  [ ] Platform smoke spec runs non-skipped
  [ ] No placeholder data remains in demo campaigns
  [ ] Credential inputs are masked
  [ ] Bulk review toolbar exists and works
  [ ] Empty states have CTAs
  [ ] Review queue counts match DB truth
```

**QA agent output:** `docs/planning/phase-18/e/qa-verdict.md`

Format:
```
# QA Agent Verdict — Phase 18

Date: [date]
Model: [model used]
Diff reviewed: [commit hash range or staged diff summary]

## Per-Finding Status
| # | Severity | Fix Present | Evidence | Acceptance Bar Met | Regression Risk |
|---|----------|------------|----------|-------------------|-----------------|
| 1 | Critical | ✅/❌ | [link] | ✅/❌ | none/low/med/high |
...

## Success Criteria Status
[checklist with ✅/❌/⚠️]

## Open Issues
[any items that need resolution before commit]

## Verdict
✅ PASS — clear to commit
⚠️ CONDITIONAL — commit with noted caveats
❌ FAIL — [blocking issues list]
```

### Step 2 — Address any QA agent issues

If the QA agent returns conditional or fail:
- Fix blocking issues (loop back to terminus-maximus if needed)
- Re-run QA agent on updated diff
- Do not proceed to commit until verdict is ✅ PASS or ✅ CONDITIONAL with non-blocking caveats

### Step 3 — Atomic commits via commit-work

Invoke `commit-work` skill for staged changes. Commit strategy:

| Commit | Scope | Message pattern |
|--------|-------|-----------------|
| 1 | Placeholder data guard + seed cleanup | `fix(creators): remove placeholder data and add import quality guard` |
| 2 | Review-queue count truth | `fix(review): align queue count query with rendered list filters` |
| 3 | Credential input masking | `fix(connections): mask access tokens and api keys in connection forms` |
| 4 | Bulk draft-review toolbar | `feat(outreach): add bulk approve/decline toolbar to draft review` |
| 5 | Connection validation feedback | `feat(connections): surface validation feedback after credential save` |
| 6 | Operator workflow fixes (empty states, navigation, metrics) | `fix(ux): empty state CTAs, campaign subnav, metric label clarity` |
| 7 | QA reliability (Playwright fixture + config) | `test(e2e): add platform smoke project and seeded auth fixture` |
| 8 | Polish (dates, icons, CTAs) | `fix(polish): localized dates, icon consistency, CTA affordances` |
| 9 | Phase 18 planning docs | `docs(phase-18): add qa/fix cycle planning artifacts` |

Each commit should be staged and committed separately using `git add <specific files>`.

### Step 4 — Final smoke check post-commit

```bash
npx playwright test --project=platform-smoke   # must pass
git log --oneline -10                          # verify commit sequence
```

### Step 5 — Phase close

Write `docs/planning/phase-18/review.md` summarizing:
- What shipped
- QA agent verdict
- Commit SHAs
- Any deferred items and their tracking path

---

## Output

1. `docs/planning/phase-18/e/qa-verdict.md` — QA agent sign-off
2. All phase-18 changes committed atomically (8–9 commits)
3. `docs/planning/phase-18/review.md` — phase close document

---

## Handoff

Phase 18 is **complete** when:
- QA verdict is ✅ PASS
- All commits are on the branch
- `review.md` is written
- No open blocking issues remain

Next action after phase close: AR reviews and decides whether to promote to external pilot readiness or continue with follow-on hardening.
