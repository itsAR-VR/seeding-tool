# Phase 18a — QA Synthesis Commit + Skill-Oracle Discovery

## Focus

Two setup actions before any fix work starts:
1. Commit the existing QA synthesis document (`docs/qa/seed-platform-qa-master.md`) so it is in version control as the authoritative input artifact for phase-18.
2. Run a skill-oracle discovery pass to confirm which local skills cover each planned fix area, and surface any gaps before red-team.

This subphase produces zero product code changes. Its sole outputs are a commit and a skill map.

---

## Inputs

- `docs/qa/seed-platform-qa-master.md` — untracked QA synthesis (15 findings, severity-ranked, fast-fix plan included)
- `docs/qa/` directory — currently untracked per `git status`
- Phase 18 root plan (`phase-18/plan.md`) — Skills Available section as starting reference

---

## Skills Available for This Subphase

### Locally installed and applicable
| Skill | Role |
|-------|------|
| `skill-oracle` | Full 172-skill discovery scan — confirm coverage for fix subphases |
| `commit-work` | Commit the QA synthesis as phase-18 input artifact |
| `karpathy-guidelines` | Keep scope tight — only stage `docs/qa/` in this commit |

### Requested-but-Missing
None for this subphase.

---

## Work

### Step 1 — Commit QA synthesis

```bash
cd /path/to/seeding-tool
git status  # confirm only docs/qa/ is untracked
git add docs/qa/seed-platform-qa-master.md
git commit -m "docs(qa): add seed scale platform qa synthesis as phase-18 input"
```

Stage only `docs/qa/`. Do not bundle unrelated changes.

### Step 2 — Skill-Oracle pass

Invoke `skill-oracle` with the following capability queries:

1. `"playwright browser screenshot verification for Next.js"` → confirm `live-env-playwright`, `playwright-testing`, `browser-automation` coverage
2. `"bulk review ergonomics data table UI"` → confirm `react-dev`, `ui-skills`, `premium-ui-components` coverage
3. `"credential masking secure input UX"` → check for any security-input skill
4. `"QA regression test plan"` → confirm `qa-regression`, `qa-test-planner`, `webapp-testing` coverage
5. `"commit discipline atomic git"` → confirm `commit-work` coverage

For any capability query that returns no local match: document fallback path in the skill-map output.

### Step 3 — Produce skill map artifact

Write skill coverage findings to: `docs/planning/phase-18/a/skill-map.md`

Format:
```
# Phase 18 Skill Map

| Fix Area | Required Capability | Local Skill | Confidence | Fallback |
|----------|--------------------|-----------  |-----------|---------|
| Trust repair (creator data) | ... | ... | high/med/low | ... |
...
```

---

## Output

1. `docs/qa/seed-platform-qa-master.md` committed to git with clean commit message
2. `docs/planning/phase-18/a/skill-map.md` — skill coverage map for all phase-18 fix areas

---

## Handoff

Skill map in `a/skill-map.md` feeds directly into subphase b (RED TEAM / phase-gaps).
The red-team pass uses the skill map + root plan as its primary input docs.
Phase-gaps executes on GPT-5.4 (not Claude) per AR model strategy rule.
