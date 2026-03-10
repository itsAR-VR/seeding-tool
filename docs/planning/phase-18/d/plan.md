# Phase 18d — Operator Workflow Repair: Medium Severity + QA Reliability

## Focus

Implement the **Medium** severity findings and the **QA reliability** findings from `docs/qa/seed-platform-qa-master.md`. Continues the `terminus-maximus` / GPT-5.4 xhigh loop from subphase c.

These fixes improve operator polish and confidence, and fix the false-green QA automation status that masks real test gaps. Must complete before the final QA agent verification pass in subphase e.

---

## Inputs

- `docs/qa/seed-platform-qa-master.md` — findings 7–15 (Medium + Low)
- `docs/planning/phase-18/c/evidence/` — verified Critical/High fixes from subphase c
- Refined `phase-18/plan.md` (post red-team)

---

## Findings Targeted

### Medium severity (operator workflow)

| # | Finding | Acceptance Bar |
|---|---------|---------------|
| 7 | Metric labels on dashboard ambiguous | Labels clearly describe what they count; hover tooltip where needed |
| 8 | Empty-state dead ends (no CTA) | Every empty state has ≥1 primary CTA routing to the correct next action |
| 9 | Platform QA automation appears greener than it is | At least 1 non-skipped platform smoke spec runs without manual auth ritual; CI/local output shows which specs actually ran |
| 10 | Long-page scale ergonomics (30+ rows unmanageable) | Creator list and Draft Outreach have pagination or row virtualization |
| 11 | Multi-brand / workspace routing risky | Either: ship a visible brand switcher, OR add a clear guard/warning if workspace routes may mix contexts |
| 12 | Campaign navigation/task hierarchy unclear | Campaign subnav complete (includes Mentions link); recommended next action visually marked by campaign state |

### Low severity (polish pass)

| # | Finding | Acceptance Bar |
|---|---------|---------------|
| 13 | Dates in raw ISO format | All dates shown in human-readable localized format |
| 14 | Icon inconsistency | Emoji placeholders replaced with consistent icon system |
| 15 | CTA affordances too light | Buttons have clear active/disabled state treatment |

### QA reliability (finding 9 expanded)

- Add a seeded local auth/session fixture for platform E2E tests so they don't require live Supabase credentials
- Update `playwright.config.ts` root `testDir` to include the platform specs (not just `./tests`)
- Ensure `.last-run.json` or CI output names which project/spec files actually ran

---

## Skills Available for This Subphase

### Locally installed and applicable
| Skill | Role |
|-------|------|
| `terminus-maximus` | Primary — continue relentless loop, GPT-5.4 xhigh |
| `karpathy-guidelines` | Surgical changes only — especially for Low polish |
| `playwright-testing` | Platform smoke spec + fixture work |
| `live-env-playwright` | Browser verification against running app |
| `webapp-testing` | Test pattern reference for platform flows |
| `react-dev` | Empty state components, CTA patterns, pagination |
| `ui-skills` | Brand switcher, campaign subnav, icon consistency |
| `browser-automation` | Screenshot verification |

### Requested-but-Missing
- No dedicated "pagination/virtualization" skill — use `react-dev` + direct `react-window` or Next.js pattern. Fallback: implement simple `LIMIT/OFFSET` pagination without virtualization for speed.

---

## Work

### Terminus-Maximus loop (same pattern as subphase c)

For each finding (7 → 15, in priority order: Medium before Low):
1. Identify affected files
2. Implement minimal fix
3. Build + lint check
4. Playwright or manual screenshot verification
5. Evidence file: `docs/planning/phase-18/d/evidence/finding-<N>.md`

### Priority order within this subphase
1. Finding 9 (QA reliability) — must fix first so verification tooling is reliable for everything else
2. Finding 8 (empty-state CTAs) — high operator-trust impact relative to effort
3. Finding 12 (campaign navigation) — closes the mentions dead-link bug from smoke report
4. Finding 7 (metric labels) — quick label copy fix
5. Finding 10 (pagination) — implement simple server-side pagination first
6. Finding 11 (multi-brand routing) — guard/warning approach if full switcher is too large
7. Findings 13–15 (Low polish) — sweep at end; don't block e on these if they add risk

### QA fixture work (finding 9)
```bash
# Create fixture in apps/web/e2e/fixtures/auth.ts
# Seed a test user session that bypasses live Supabase OAuth
# Update playwright.config.ts to include platform project
# Verify with: npx playwright test --project=platform-smoke
```

---

## Output

1. Code changes for findings 7–15 (primarily UI + test infra)
2. `docs/planning/phase-18/d/evidence/` — evidence files per fix
3. Updated `playwright.config.ts` with platform smoke project enabled
4. All changes staged (still not committed — subphase e owns commits)

---

## Handoff

Subphase d hands off to subphase e when:
- All Medium findings have evidence files
- Low findings either have evidence or are explicitly deferred with reason
- Platform smoke spec runs non-skipped and produces output

Subphase e runs the QA agent verification pass over the full accumulated diff from c+d, then commits via commit-work.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Corrected the ambiguous `Address` stat label to `Address Confirmed` on the campaign detail surface.
  - Added stronger empty-state CTA coverage to the review queue and campaign detail readiness flow.
- Evidence written:
  - `docs/planning/phase-18/d/evidence/finding-7.md`
  - `docs/planning/phase-18/d/evidence/finding-8.md`
- Verification:
  - Covered by the same local ESLint, production build, and browser screenshots recorded in subphase c evidence.
- Open items:
  - Findings 9–15 remain unimplemented in this lane.
- Next action:
  - Return focus to subphase-c remaining High findings before broadening further into d.
