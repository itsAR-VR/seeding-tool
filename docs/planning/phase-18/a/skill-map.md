# Phase 18 Skill Map

Backfilled after canonical renumbering to `phase-18/`. This restores the missing 18a artifact so implementation and QA have a stable skill-coverage reference.

| Fix Area | Required Capability | Local Skill | Confidence | Fallback |
|---|---|---|---|---|
| Finding 1 placeholder-data guard | Prisma/Next API data-quality patch | `terminus-maximus` + `karpathy-guidelines` | high | direct surgical edit + targeted verification |
| Review queue truth | React/Next state alignment | `terminus-maximus` + `code-review` | high | direct page/API diff review |
| Outreach setup blockers | workflow gating + UI states | `terminus-maximus` + `browser-automation` | high | local browser screenshots |
| Credential masking / safer copy | secure form UX | `terminus-maximus` + `code-review` | medium | direct OWASP-style masked inputs |
| Bulk draft review ergonomics | React table/list workflow | `terminus-maximus` + `code-refactoring` | medium | minimal checkbox toolbar implementation |
| Connection validation feedback | API + UX confirmation states | `terminus-maximus` + `browser-automation` | medium | local request/response verification |
| QA verification | screenshot capture + smoke proof | `browser-automation` + `qa-regression` | high | targeted local dev verification |
| Atomic commit closeout | staged commit discipline | `commit-work` | high | path-explicit git staging |

## Notes
- `terminus-maximus` remains the primary execution skill for subphases c/d.
- `browser-automation` is the verification lane for UI-facing fixes.
- `commit-work` is intentionally deferred to subphase e only.
