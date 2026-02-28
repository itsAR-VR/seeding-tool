# Phase 4a — Scaffold project from scratch + config + output contract

## Focus
Create a new Node/TypeScript + Playwright harness from scratch that supports multiple sites/contexts while enforcing one output contract for artifacts and docs.

## Inputs
- Phase 4 root plan.
- Output conventions (to be created):
  - `artifacts/<run-id>/...`
  - `.auth/` for Playwright storage states
  - `docs/audit/` for living Markdown docs

## Precondition
**The repo is empty.** There is no existing code, package.json, or config. This phase must create everything from scratch.

## Work
1. Initialize the project from scratch:
   ```bash
   npm init -y
   npm install -D typescript @types/node tsx
   npm install -D playwright @playwright/test
   npx playwright install chromium
   npx tsc --init
   ```
   - Create `playwright.config.ts` with 3 viewports (desktop 1440×900, tablet 768×1024, mobile 390×844) and trace-on-retry
   - Create `tsconfig.json` with strict mode and ES2022 target
   - Create `src/` directory structure for runners and primitives
2. Define a single config schema (env-based) for all runs:
   - Base URLs: `AHA_MARKETING_BASE_URL`, `AHA_PLATFORM_BASE_URL`
   - Competitors: `COMPETITOR_SITES` (JSON list or comma-separated ids → base URLs)
   - Run controls: `RUN_ID`, `CAPTURE_MODE`, `MAX_ROUTES`, `MAX_DEPTH`, `RATE_LIMIT_MS`, `HEADLESS`
   - Safety flags: `ALLOW_DESTRUCTIVE`, `ALLOW_WRITES`, `BLOCK_TRACKERS`
3. Define the artifact output contract (stable paths):
   - Owned:
     - `artifacts/<run-id>/marketing/...`
     - `artifacts/<run-id>/platform/...`
   - Competitors:
     - `artifacts/<run-id>/competitors/<siteId>/...`
   - Shared:
     - `artifacts/<run-id>/run-summary.json`
4. Git hygiene:
   - Add `artifacts/` and `.auth/` to `.gitignore`.
   - Keep docs tracked (`docs/audit/**`, `docs/planning/**`).
5. Define CLI scripts (single contract):
   - `audit:marketing`, `audit:platform:bootstrap`, `audit:platform`, `audit:competitors`, `audit:report`, `audit:all`.

## Output
- Created scaffolded project with TypeScript + Playwright and a single config contract.
- Added initial runner entrypoints and utilities so scripts resolve cleanly.
- Established artifact/doc directories and gitignore hygiene.

## Verification
- [x] `npm install` completes without errors
- [x] `npx tsc --noEmit` compiles without errors
- [x] `npm run audit:marketing -- --help` exits cleanly with "not implemented"
- [x] `.gitignore` contains `artifacts/`, `.auth/`, and `node_modules/`
- [x] `artifacts/` and `.auth/` directories exist

## Handoff
Proceed to Phase 4b to implement shared capture primitives (baseline + motion + token/animation extraction + optional network capture) and replace runner placeholders with real logic.
