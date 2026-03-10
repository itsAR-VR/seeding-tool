# Seed Scale Workflow

## What this repo is
Seed Scale is the influencer seeding / creator operations system. It combines app code, audits, scraping/import scripts, planning docs, and worker logic.

## Working style
- Keep root `AGENTS.md` concise and operational.
- Use this file for local dev flow, repo structure, and verification expectations.
- Codex should handle local code changes, scripts, debugging, and implementation.
- Podhi sidecars should handle research, competitor analysis, browser workflows, strategy synthesis, and side investigations that can run in parallel.

## Local dev loop
1. Start the app locally with `npm run web:dev`.
2. Keep testing and QA on the local app flow, not Vercel production.
3. Make the smallest viable change.
4. Run the most relevant local checks for the change:
   - `npm run web:build` for app safety
   - targeted audit scripts when working on audit/reporting systems
   - scrape/import commands only when the task actually touches that pipeline
5. For visual/product changes, verify on localhost with browser evidence.

## Hard overrides
- Do **not** deploy to Vercel as part of the normal dev/test loop.
- Prefer local browser verification over CLI-only confidence.
- Keep the product calm, operator-grade, and relevance-first.
- If the work is app-local, keep it local. If it is research/strategy/competitive analysis, offload it to `openclaw-seed` / `podhi_seed_bg`.
- Route infra-only issues to `openclaw-ops` / `podhi_ops_bg`.

## Repo shape
- `apps/web/` — primary product app
- `apps/web/app/` — routes/pages
- `apps/web/lib/` — app logic and integrations
- `apps/web/prisma/` — schema and Prisma-related app state
- `src/audit/` — audit runners/reporting utilities
- `scripts/` — scraping/import/utilities
- `workers/creator-search/` — creator-search worker lane
- `docs/planning/phase-*` — planning history and execution artifacts
- `docs/runbooks/`, `docs/seed-scale-handoff/` — operational handoff/runbook material

## Evidence expectations
Good completions should usually include:
- changed files
- commands run
- verification result
- screenshots/browser evidence for UI work
- explicit blocker ownership when something is human- or env-blocked
