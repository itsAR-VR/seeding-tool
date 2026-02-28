# Phase 4e — Implement Markdown reporter + runbook + indexes

## Focus
Generate and continuously update a living Markdown knowledge base that:
- indexes owned marketing + owned platform routes
- indexes competitor routes and teardown notes
- includes flow docs for onboarding and in-app wizards
- links all claims to captured local artifacts

## Inputs
- Artifacts from Phase 4c/4d:
  - `routes.json`, token inventories, animation/motion logs, flow artifacts, HAR/request index (owned platform)
- Output contract from Phase 4a.

## Work
1. Define the doc structure (single convention):
   - `docs/audit/index.md` (global run index + links)
   - `docs/audit/pages/marketing/<slug>.md`
   - `docs/audit/pages/platform/<slug>.md`
   - `docs/audit/flows/platform/<flow>.md`
   - `docs/audit/pages/competitors/<site>/<slug>.md`
   - `docs/audit/blueprints/owned/` (rebuild blueprint + parity tests)
   - `docs/audit/blueprints/fusion/` (competitor fusion specs)
   - `docs/audit/runbook.md` (operational guide)
2. Implement deterministic doc generation (`audit:report`):
   - rewrite from artifact JSON; don’t rely on hand-edits staying in sync
   - per-page sections: URL/status/title, structure outline, typography summary, palette summary, motion evidence, artifact links
   - per-flow sections: goal, preconditions, step table (fields/action/API calls), artifact links
3. Runbook:
   - env vars + safe defaults
   - “how to do manual OAuth bootstrap”
   - anti-bot hygiene options and stop-on-challenge behavior
   - safety flags (`ALLOW_DESTRUCTIVE`, `ALLOW_WRITES`)

## Output
- Updated `docs/audit/**` docs and indexes each run.
- A runbook for repeatable audits and debugging.

## Output (Actual)
- Implemented reporter: `src/audit/report/report.ts`
  - Generates per-page docs for marketing/platform/competitors
  - Generates `docs/audit/index.md` and `docs/audit/runbook.md`

## Verification
- [ ] `npm run audit:report` regenerates all docs without errors
- [ ] `docs/audit/index.md` exists and links to all page/flow docs
- [ ] Each page doc contains: URL, status, title, structure outline, typography summary, artifact links
- [ ] `docs/audit/runbook.md` exists with sections for: env vars, OAuth bootstrap, anti-bot hygiene, safety flags, resuming after challenge
- [ ] Running `audit:report` twice produces identical output (deterministic)

## Handoff
Phase 4f should synthesize the audit findings into blueprint docs (owned rebuild + competitor fusion) and add parity test/backlog outputs.
