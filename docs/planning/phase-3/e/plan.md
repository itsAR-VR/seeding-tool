# Phase 3e — Implement Markdown reporter + doc indexes + runbook

## Focus
Generate and continuously update a living Markdown knowledge base that indexes marketing + platform pages and onboarding/flows with structured sections and artifact links, plus a runbook for repeatable audits.

## Inputs
- Artifacts produced by Phase 3b–3d:
  - `routes.json`, `tokens.json`, `animations.json`, flow artifacts, HAR/request index
- Output directories from Phase 3a:
  - `docs/audit/`

## Work
1. Define doc paths and templates:
   - `docs/audit/index.md`
   - `docs/audit/pages/marketing/<slug>.md`
   - `docs/audit/pages/platform/<slug>.md`
   - `docs/audit/flows/platform/<flow>.md`
2. Implement deterministic report generation:
   - rewrite docs each run from artifact JSON (no manual edits required to keep in sync)
   - include: URL/status/title, structure outline, typography summary, palette summary, observed micro-animations, artifact links
3. Maintain run history:
   - index keeps last N run IDs and pointers to artifacts
4. Add runbook:
   - environment variables and safe defaults
   - bootstrap login instructions
   - safety flags (`ALLOW_DESTRUCTIVE`, `ALLOW_WRITES`)
   - troubleshooting (timeouts, bot defenses, flaky animations)

## Output
- Updated `docs/audit/index.md`
- Per-page docs under `docs/audit/pages/**`
- Flow docs under `docs/audit/flows/platform/**`
- Runbook doc (location defined in this subphase)

## Handoff
After Phase 3, the repository has a repeatable audit harness and continuously updated documentation sufficient to rebuild UI/UX 1:1 and then adapt to the e-commerce creator seeding niche.

