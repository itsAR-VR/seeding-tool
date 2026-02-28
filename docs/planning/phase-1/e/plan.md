# Phase 1e — Implement Markdown reporter + living docs structure

## Focus
Generate and continuously update a living Markdown knowledge base that indexes marketing + platform pages and documents each page and flow with structured sections and artifact links.

## Inputs
- Artifact output contract (Phase 1a) and produced data:
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
Subphase 1f should translate audit outputs (tokens, animations, page/flow structure) into a rebuild blueprint and parity-testing approach for Next.js + Tailwind + functional workflows.

