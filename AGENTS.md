# AGENTS.md — Seed Scale

Seed Scale influencer gifting platform. Keep this root file concise and operational.

## Quick Reference
- **Package manager:** npm
- **App dev:** `npm run web:dev`
- **App build:** `npm run web:build`
- **Marketing audit:** `npm run audit:marketing`
- **Platform audit:** `npm run audit:platform`
- **Competitor audit:** `npm run audit:competitors`
- **Collabstr scrape:** `npm run collabstr:scrape`
- **Collabstr import:** `npm run collabstr:import`

## Routing
- **Codex owns:** local app changes, tests, scripts, migrations, and direct repo debugging.
- **Podhi sidecar owns:** product research, browser workflows, visual QA, competitor analysis, strategy synthesis, and multi-agent execution.
- **Primary lane:** `openclaw-seed` using `seed-sidecar`.
- **Async default:** prefer `podhi_seed_bg` for parallelizable research/review/audit work; ask for `summary`, `verification`, `blockers`, `nextAction`.
- **Ops-only issues:** use `openclaw-ops` / `podhi_ops_bg` for gateway, tailscale, cron, Vercel-adjacent infra, and environment-health triage.

## Hard Overrides
- Do **not** deploy to Vercel as part of the normal dev/test loop.
- Run visual verification against `localhost:3000` / local app flow when applicable.
- Keep the product feel calm, operator-grade, and relevance-first.

## Detailed Context
- [Design context](docs/agent-context/design.md)
- [Workflow](docs/agent-context/workflow.md)
- [Shared git/file safety contract](../orchestration/STEINBERGER_GIT_SAFETY.md)
