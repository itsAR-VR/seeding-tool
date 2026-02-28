# Phase 1a — Create audit repo scaffolding + config contract

## Focus
Establish the Node/TypeScript Playwright project structure, configuration schema, and output contract so all subsequent subphases can add capabilities without changing the interface.

## Inputs
- Phase 1 root plan (purpose, constraints, and success criteria).
- Target URLs:
  - Marketing: `https://aha.inc`
  - Platform: `https://platform.aha.inc`
- Requirement: staging/test environment support and local artifact storage.

## Work
1. Initialize a Node/TypeScript project in the workspace root.
2. Add Playwright as a dependency and create a shared `playwright.config.ts`:
   - Default `headless: false`.
   - Viewports: desktop (1440×900), tablet (834×1112), mobile (390×844).
   - `trace: on-first-retry` and `video/screenshot` settings aligned to artifact storage.
3. Create a config module (e.g., `tools/audit/config.ts`) that reads env vars:
   - `MARKETING_BASE_URL`, `PLATFORM_BASE_URL`, `AUDIT_RUN_ID`, `AUDIT_ENV`, `CAPTURE_MODE`,
     `MAX_ROUTES`, `MAX_DEPTH`, `RATE_LIMIT_MS`, `ALLOW_DESTRUCTIVE`.
   - Provide safe defaults (staging-first, reduced-motion baseline enabled).
4. Create workspace folders and gitignore entries:
   - `artifacts/` for run outputs
   - `.auth/` for Playwright storageState
   - `docs/audit/` for living Markdown docs
5. Add package scripts (CLI contract):
   - `audit:marketing`, `audit:platform:bootstrap`, `audit:platform`, `audit:all`, `audit:report`
6. Add a shared logging format:
   - Every run prints `RUN_ID`, targets, and output paths.
   - Log a machine-readable summary JSON at `artifacts/<run-id>/run-summary.json`.

## Output
- A runnable project scaffold with stable CLI commands and directories.
- A clearly defined output contract for later collectors to write into.

## Handoff
Subphase 1b should implement marketing route discovery and captures using the config + output contract from this subphase (no new env vars, no new output conventions).

