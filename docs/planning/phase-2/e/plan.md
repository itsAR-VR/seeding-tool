# Phase 2e — Implement Markdown reporter + living docs structure

## Focus
Generate and continuously update a living Markdown knowledge base that indexes marketing + platform pages and documents each page and flow with structured sections and artifact links.

## Inputs
- Artifact output contract (Phase 2a) and produced data:
  - `routes.json`, `tokens.json`, `animations.json`, flow artifacts
- Requirement: one Markdown file per page, plus global index and separate flow docs.

## Work
1. Define doc structure and paths:
   - `docs/audit/index.md` (global index)
   - `docs/audit/pages/marketing/<slug>.md`
   - `docs/audit/pages/platform/<slug>.md`
   - `docs/audit/flows/platform/<flow>.md`
2. Implement a reporter that rewrites docs deterministically each run:
   - For each route, write:
     - URL + status + title
     - layout/components observed (headings, cards, sections)
     - typography summary (computed font families/sizes/weights)
     - color palette (top colors + usage hints)
     - animations/micro-interactions observed
     - artifacts section (links to latest run folder)
   - For each flow, write:
     - goal + preconditions
     - step table (step name, fields, action, API calls, screenshot links)
3. Maintain a small run history:
   - Store the last N run IDs in `docs/audit/index.md` with pointers to artifact folders.
4. Ensure the reporter is safe for “capture everything”:
   - Markdown should link to artifacts without inlining secrets.
   - Avoid writing raw auth tokens into docs; keep those only inside HAR/artifacts.

## Output
- `docs/audit/index.md` updated each run
- Per-page docs under `docs/audit/pages/**`
- Flow docs under `docs/audit/flows/platform/**`

## Handoff
Subphase 2f should translate audit outputs (tokens, animations, page/flow structure) into a rebuild blueprint and parity-testing approach for Next.js + Tailwind + functional workflows.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Verified deterministic reporter is implemented and generates page docs + index from latest/canonical run artifacts.
  - Verified living docs tree is populated for marketing/platform/competitors.
  - Verified runbook and blueprint generation hooks are wired into reporter pass.
- Commands run:
  - `cat src/audit/report/report.ts` — pass; per-route doc generation + index + runbook + blueprint emit implemented.
  - `cat docs/audit/index.md` — pass; deterministic canonical run links present.
  - `find docs/audit/pages -maxdepth 3 -type f | head` — pass; page docs exist across targets.
- Blockers:
  - None for the reporting system itself.
- Next concrete steps:
  - Keep canonical run id pinned until authenticated platform rerun is complete.

## Output (Execution Status — 2026-03-02)
- Complete.
- Evidence:
  - `src/audit/report/report.ts`
  - `docs/audit/index.md`
  - `docs/audit/pages/marketing/home.md`
  - `docs/audit/pages/platform/login.md`
  - `docs/audit/pages/competitors/refunnel/home.md`

## Handoff (Execution Status — 2026-03-02)
- 2f can consume route/token/flow docs as current source-of-truth for blueprint and parity strategy.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Regenerated docs/report for landing-only run id and confirmed index refresh.
- Commands run:
  - `RUN_ID=20260302-landing-only npm run audit:report` — pass; docs regenerated for landing-only run.
- Blockers:
  - None.
- Next concrete steps:
  - Keep landing-page audit run id as baseline for Phase 2 completion evidence.
