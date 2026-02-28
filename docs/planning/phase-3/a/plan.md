# Phase 3a — Scaffold project + config + output contract

## Focus
Set up the Node/TypeScript + Playwright codebase and define a single, stable configuration/output contract so all later collectors and reporters write consistent artifacts.

## Inputs
- Phase 3 root plan (objectives, constraints, success criteria).
- Existing output conventions referenced in Phase 1:
  - `artifacts/<run-id>/...`
  - `.auth/` for storage state
  - `docs/audit/` for living Markdown docs

## Work
1. Initialize a Node/TypeScript project and install Playwright dependencies.
2. Add a shared `playwright.config.ts`:
   - headed by default
   - viewports: desktop/tablet/mobile
   - retries + trace on first retry
   - artifact paths parameterized by `RUN_ID`
3. Implement a config loader module that reads env vars with safe defaults:
   - `MARKETING_BASE_URL`, `PLATFORM_BASE_URL`, `RUN_ID`, `AUDIT_ENV`
   - `MAX_ROUTES`, `MAX_DEPTH`, `RATE_LIMIT_MS`
   - `CAPTURE_MODE=baseline|motion|both`
   - `ALLOW_DESTRUCTIVE`, `ALLOW_WRITES`
4. Create directories + gitignore rules:
   - `artifacts/`
   - `.auth/`
   - `docs/audit/`
5. Create npm scripts (CLI contract):
   - `audit:marketing`, `audit:platform:bootstrap`, `audit:platform`, `audit:report`, `audit:all`
6. Add a run summary contract:
   - `artifacts/<run-id>/run-summary.json` includes run metadata, targets, and outputs.

## Output
- Runnable Playwright scaffold with stable CLI commands and output paths.

## Handoff
Phase 3b reuses the config + capture primitives from this subphase without adding new env vars or changing output conventions.

