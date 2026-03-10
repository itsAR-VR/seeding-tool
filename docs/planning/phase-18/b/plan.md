# Phase 18b — RED TEAM: phase-gaps adversarial review (GPT-5.4)

## Focus

Adversarial RED TEAM pass over the Phase 18 root plan and all subphase plans using the `phase-gaps` skill.

**Model mandate:** This pass MUST run on **GPT-5.4** (OpenAI SOTA). Claude authored the plan; a different model must stress-test it. This is AR's hard rule: when planning is Claude, red team uses OpenAI.

The red-team pass will:
- Challenge every assumption in the plan against the QA master findings
- Identify gaps where the planned fix scope is underspecified or likely to miss root cause
- Flag subphase handoff weaknesses
- Surface any below-84.7% confidence items as targeted questions for AR
- Refine plan docs on disk (root plan + subphase plans) based on findings

---

## Inputs

- `docs/planning/phase-18/plan.md` — root plan (primary red-team target)
- `docs/planning/phase-18/a/skill-map.md` — skill coverage map from subphase a
- `docs/qa/seed-platform-qa-master.md` — full QA findings as ground truth
- `phase-gaps` skill instructions at `~/.openclaw/skills/phase-gaps/SKILL.md`

---

## Skills Available for This Subphase

### Locally installed and applicable
| Skill | Role |
|-------|------|
| `phase-gaps` | Primary — adversarial plan review and doc refinement |
| `skill-oracle` | Re-run if red team uncovers capability gaps not in skill map |
| `requirements-clarity` | If red team surfaces ambiguous requirements, use to sharpen them |
| `karpathy-guidelines` | Keep red-team edits surgical — only update what is genuinely weak |

### Requested-but-Missing
None for this subphase.

---

## Work

### Step 1 — Load context into GPT-5.4 session

Provide to GPT-5.4:
- `docs/planning/phase-18/plan.md` (full text)
- `docs/qa/seed-platform-qa-master.md` (full text)
- `docs/planning/phase-18/a/skill-map.md`
- Instruction: "You are red-teaming a QA/fix phase plan for the Seed Scale influencer seeding platform. Your job is to find gaps, weak assumptions, and underspecified scope. Focus adversarial energy on: (1) whether the fix scope will actually close the QA findings, (2) whether the subphase handoffs are watertight, (3) whether any critical findings are understated or have deeper root causes, (4) whether the success criteria are measurable."

### Step 2 — Run phase-gaps skill

Invoke `phase-gaps` on `docs/planning/phase-18/`:
- The skill will update root plan + subphases in place with RED TEAM annotations
- Any below-84.7% confidence item surfaces as an explicit user question
- Keep the `## Original User Request (verbatim)` block untouched

### Step 3 — Review and merge red-team edits

After GPT-5.4 phase-gaps run:
- Review all changes to plan docs for accuracy and coherence
- Accept refinements that genuinely improve plan quality
- Reject changes that bloat scope or drift from the QA master findings

### Step 4 — Document red-team summary

Write red-team findings to: `docs/planning/phase-18/b/red-team-summary.md`

Format:
```
# RED TEAM Summary — Phase 18

**Model:** GPT-5.4
**Date:** [date]

## Gaps Found
[list]

## Assumptions Challenged
[list]

## Plan Changes Made
[list of files + what changed]

## Open Questions for AR (below 84.7% confidence)
[list — requires human response before proceeding]

## Verdict
[pass / conditional pass / needs rework]
```

---

## Output

1. Refined plan docs on disk (`phase-18/plan.md` and subphase plans updated in place)
2. `docs/planning/phase-18/b/red-team-summary.md` — red-team findings and verdict

---

## Handoff

If red-team verdict is **pass** or **conditional pass** with no blocking open questions:
→ proceed directly to subphase c (trust repair implementation)

If red-team surfaces blocking open questions:
→ surface questions to AR; block subphase c until resolved

The implementation subphases (c, d) use the refined plan as their canonical spec.
