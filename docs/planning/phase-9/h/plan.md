# Phase 9h — Implement QA/replay harnesses, observability, migration tooling, and rollout gates

## Focus
Harden the built platform so it can be trusted for a pilot-brand cutover: replay fixtures, end-to-end tests, structured logging/alerts, migration scripts, and explicit rollout/rollback tooling.

## Inputs
- `docs/planning/phase-9/plan.md`
- `docs/planning/phase-9/a/plan.md`
- `docs/planning/phase-9/b/plan.md`
- `docs/planning/phase-9/c/plan.md`
- `docs/planning/phase-9/d/plan.md`
- `docs/planning/phase-9/e/plan.md`
- `docs/planning/phase-9/f/plan.md`
- `docs/planning/phase-9/g/plan.md`
- `docs/planning/phase-8/finalplan.md`
- `docs/planning/phase-8/review.md`
- `docs/planning/phase-8/e/rollout.md`
- `docs/seed-scale-handoff/appendix/behavior-parity-checklist.md`

## Skills Available for This Subphase
- `find-local-skills` output: unavailable on this machine (missing local index); fallback to manual skill selection.
- `find-skills` output: unavailable on this machine; fallback to confirmed local skills only.
- Planned invocations:
  - `playwright-testing`
  - `qa-test-planner`
  - `phase-gaps`
  - `code-review`
  - `backend-development`
  - `javascript-typescript`

## Work

### 1. Implement provider replay fixtures and contract tests
- store representative payload fixtures for:
  - Stripe
  - Shopify
  - Gmail
  - Instagram/mentions
  - creator-search callback batches
- add replay tests proving:
  - duplicate events do not duplicate state
  - malformed events fail safely
  - low-confidence AI paths do not auto-advance

### 2. Implement Playwright E2E coverage
- onboarding from signup to first campaign
- creator approval to outreach
- inbox reply to address confirm
- order flow to delivery/reminder
- mention ingest / suppression
- unsubscribe suppression
- creator search happy path and failure path

### 3. Add structured observability
- structured logs with tenant/entity/job context
- basic error tracking / alert routing
- queue and intervention dashboards or admin views
- health checks for stage counts and stuck work

### 4. Add migration tooling
- pilot-brand import scripts
- fixture-based shadow/replay workflow
- mapping helpers from legacy Airtable states to new platform states
- explicit pilot-run instructions

### 5. Implement rollout gates and rollback tools
- encode proceed / rollback criteria from Phase 8
- add ops checklists and incident-response notes
- make it possible to disable subsystems per brand when a gate fails

### 6. Final hardening review
- run `phase-gaps`-style red-team pass over the implemented surfaces
- run code review on the riskiest subsystems:
  - auth
  - provider handlers
  - order creation
  - worker callback path
- document residual risk and blocked rollout items explicitly

### 7. Validation
- `npm run web:build` (from repo root)
- `cd apps/web && npx prisma validate`
- `cd apps/web && npm run lint`
- targeted replay tests pass
- targeted Playwright E2E pass
- parity checklist A-J: each section has at least one passing test

## Validation (RED TEAM)
- Replay tests must cover EVERY provider webhook type (Stripe, Shopify, Gmail, Instagram)
- Playwright E2E must run against a real local dev environment, not mocked pages
- Migration import scripts must handle all legacy Airtable status values from `behavior-parity-checklist.md`
- Rollout gates must have explicit "disable subsystem for brand X" switches, not just documentation
- Existing Playwright config (`playwright.config.ts` at repo root) should be extended, not replaced

## Output
- The repo has concrete test, replay, observability, migration, and rollout mechanisms that make a pilot-brand launch defensible.
- Phase 9 is implementation-complete enough to move into final review / launch-readiness assessment.

## Handoff
This subphase closes the implementation planning track. After completion, the next step is execution via the Phase 9 subphases in order, followed by a dedicated review phase that validates the actual shipped code against the Phase 8 and Phase 9 contracts.

## Assumptions / Open Questions (RED TEAM)
- Observability uses structured JSON logs + Sentry free tier, not a full APM like Datadog.
  - Why it matters: affects cost and debugging capability.
  - Current default: structured logs + Sentry.
- Pilot brand is Kalm (current brand with most complete data).
  - Why it matters: migration scripts are specific to Kalm's data shape.
  - Current default: Kalm as pilot, others follow brand-by-brand.
