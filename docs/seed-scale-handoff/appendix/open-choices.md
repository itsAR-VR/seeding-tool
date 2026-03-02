# Open Choices (Developer Discretion Areas)

This document marks technical choices intentionally left to implementation discretion, while preserving fixed business behavior.

## Guardrail

Behavior is fixed. Implementation can vary.

- Must preserve:
  - approval gate,
  - outreach and follow-up logic,
  - AI-assisted address capture,
  - Shopify order creation + status sync,
  - mention tracking + reminders + intervention path.
- Can vary:
  - internal architecture patterns,
  - config strategy,
  - deployment and testing stack.

## Choice set A: Configuration architecture

### Decision to make

Where brand config lives and how nodes resolve it.

### Recommended options

1. Airtable config table + cached fetch node pattern
2. n8n env vars + per-brand credentials
3. Hybrid (critical secrets in env, content/product mapping in Airtable)

### Success criteria

- no hardcoded brand literals in workflow logic nodes,
- one-pass brand onboarding checklist,
- config validation before workflow execution.

## Choice set B: Multi-brand isolation model

### Decision to make

Single shared workflows with config-driven branching, or cloned workflows per brand.

### Recommended options

1. Shared workflow + `brand_id` parameterization (preferred for maintainability)
2. One workflow set per brand (faster short-term, higher drift risk)

### Success criteria

- low cross-brand bleed risk,
- clear rollback path,
- easy troubleshooting by brand.

## Choice set C: Deployment and promotion discipline

### Decision to make

How workflow changes are promoted across environments.

### Recommended options

1. Export JSON -> git versioning -> import pipeline by environment
2. n8n API-driven promotion scripts with checksums

### Success criteria

- diffable change history,
- deterministic promotion,
- rollback in under 15 minutes.

## Choice set D: Reliability model

### Decision to make

How duplicate events, retries, and partial failures are handled.

### Recommended options

1. idempotency key per influencer lifecycle step,
2. write-once guards in Airtable updates,
3. replay-safe webhook handlers.

### Success criteria

- no duplicate orders,
- no repeated follow-up spam loops,
- safe rerun after node failure.

## Choice set E: Testing strategy

### Decision to make

What minimum test harness protects behavior parity.

### Recommended options

1. fixture-based workflow export lint + static validation,
2. staging replay tests using sample records and synthetic webhook events,
3. parity checklist execution per release.

### Success criteria

- detects regressions before production activation,
- validates all 10 lifecycle steps,
- includes failure-path and recovery tests.

## Choice set F: Observability and operations

### Decision to make

How to detect and triage incidents.

### Recommended options

1. standardized error node payload schema + Slack/Discord routing,
2. daily KPI health summary from Airtable stage counts,
3. runbook-backed severity routing and owner assignment.

### Success criteria

- incidents visible within minutes,
- clear owner per alert,
- repeatable manual recovery procedures.

## Suggested decision sequence

1. Configuration architecture
2. Multi-brand isolation model
3. Deployment and promotion discipline
4. Reliability model
5. Testing strategy
6. Observability and operations

This sequence prevents rework by deciding data/control boundaries before tooling details.
