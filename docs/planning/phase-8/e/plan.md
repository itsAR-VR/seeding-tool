# Phase 8e — Define migration, QA, observability, rollout gates, and `finalplan.md` synthesis

## Focus
Turn the prior subphases into a safe execution runway: migration from n8n/Airtable, test and replay gates, observability and incident handling, brand-by-brand rollout, and synthesis into the final canonical plan artifact.

## Inputs
- `docs/planning/phase-8/plan.md` (root plan with RED TEAM findings)
- `docs/planning/phase-8/a/architecture.md` (architecture lock)
- `docs/planning/phase-8/b/schema.md` (canonical schema)
- `docs/planning/phase-8/c/integrations.md` (integration contracts)
- `docs/planning/phase-8/d/product-surfaces.md` (product surfaces and state machines)
- `docs/seed-scale-handoff/appendix/behavior-parity-checklist.md` (10-section verification checklist)
- `docs/seed-scale-handoff/README.md` (handoff overview with production-readiness gap analysis)

## Work

### 1. Define migration strategy from Airtable/n8n into the new platform

#### Phase M1: Data export and import
- Export current Airtable People table to CSV/JSON
- Export current Airtable Mentions table to CSV/JSON
- Write a one-time migration script that:
  - Creates Organization, Client, Brand records for the pilot brand
  - Imports People records as Creator + CampaignCreator records with correct lifecycle status mapping:
    - `Waiting Approval` -> `pending_review`
    - `Approved` -> `approved`
    - `Shopify` (order created) -> `order_created`
    - `Delivered` -> `delivered`
    - `Intervention Flag` -> `intervention_required`
    - `Declined` -> `declined`
  - Imports Mentions records as Mention records
  - Imports email threads as Conversation + Message records (Gmail API fetch for thread history)
  - Maps hardcoded brand config values to BrandConfig entity

#### Phase M2: Pilot brand selection
- First brand to migrate: the current "Kalm" brand (existing data, known behavior)
- Pilot criteria: brand with most complete data, active campaigns, and known intervention cases

#### Phase M3: Side-by-side validation
- Run both systems (n8n + new platform) in parallel for 1-2 weeks
- New platform in "shadow mode": receives the same triggers but does NOT send real emails or create real orders
- Compare: does the new platform produce the same state transitions as n8n for the same events?
- Parity report: for each behavior parity checklist item (A-J), document match/mismatch

#### Phase M4: Cutover sequencing
1. Disable n8n outreach workflows for pilot brand
2. Enable new platform outreach for pilot brand
3. Monitor for 48 hours
4. If clean: disable n8n order creation for pilot brand, enable new platform
5. Monitor for 48 hours
6. If clean: disable all n8n workflows for pilot brand, new platform takes over fully
7. Repeat for subsequent brands

#### Phase M5: Legacy freeze and retention
- After all brands migrated: freeze n8n workflows (disable, do not delete)
- Retain Airtable data for 90 days as rollback safety net
- Archive n8n workflow exports in `docs/n8n-audit-2026-03-01/` (already done)

### 2. Define the release contract

#### Unit tests
- Entity CRUD operations (create, read, update with status transitions)
- Status enum validation (only valid transitions allowed)
- Dedupe key enforcement (duplicate insert returns existing record)
- Brand config resolution (correct values for correct brand)
- AI classification mocking (structured output parsing, error handling)

#### Integration tests
- Stripe webhook -> subscription status update -> plan gating check
- Shopify webhook -> fulfillment status update -> CampaignCreator status transition
- Gmail OAuth flow -> token storage -> email send -> message record creation
- Creator search -> job queue -> result normalization -> Creator record creation

#### Playwright end-to-end flows
- Onboarding wizard: signup -> org creation -> plan selection -> brand setup -> first campaign
- Campaign lifecycle: create campaign -> approve creator -> send outreach -> receive reply -> create order
- Inbox: view thread -> review AI draft -> edit -> send -> verify message record
- Intervention: flag item -> view in queue -> resolve -> verify status update
- Creator search: submit search -> view results -> approve creator -> verify in campaign

#### Replay fixtures for AI and provider events
- Save sample payloads from each provider (Stripe, Shopify, Gmail, Instagram)
- Create replay test suite that feeds saved payloads through webhook handlers
- Verify idempotency: replay same event twice, verify no duplicate state changes
- Verify AI parsing: save sample email replies, verify classification + address extraction

#### Parity checklist signoff
- Map each of the 10 behavior parity sections (A-J) from `behavior-parity-checklist.md` to specific test cases:

| Parity Section | Test coverage |
|---------------|--------------|
| A: Intake and approval | Onboarding E2E + campaign creator approval unit tests |
| B: Outreach and follow-up | Outreach job integration test + follow-up cadence unit test |
| C: Reply handling and address capture | AI classification integration test + address extraction unit test |
| D: Shopify order creation and sync | Shopify webhook integration test + order dedupe unit test |
| E: Fulfillment and delivery | Fulfillment webhook integration test + reminder scheduling unit test |
| F: Mentions tracking | Mentions webhook integration test + counter increment unit test |
| G: Non-post reminder loop | Reminder job integration test + stop condition unit test |
| H: Intervention and manual recovery | Intervention flag unit test + resume-from-intervention E2E |
| I: Security and config controls | Brand config resolution test + no-hardcoded-values lint check |
| J: Operational reliability | Error handling integration test + alert routing verification |

### 3. Define observability

#### Structured logs
- All log entries include: `timestamp`, `level`, `service`, `brand_id`, `campaign_id`, `creator_id`, `job_type`, `message`
- Log levels: `debug` (dev only), `info` (state transitions), `warn` (retries, degraded paths), `error` (failures)
- Provider API calls logged with: endpoint, status code, latency, request ID

#### Job metrics
- Job queue depth by type (how many pending)
- Job completion rate by type (success vs failure per hour)
- Job latency p50/p95 by type
- Dead-letter queue size

#### Provider health
- API response time p50/p95 per provider
- Error rate per provider (4xx, 5xx)
- Token refresh success/failure rate
- Rate limit proximity (current usage vs limit)

#### Alert routing
- Critical (page immediately): Shopify order creation failure, Gmail token refresh failure, all jobs in dead-letter for >1 hour
- Warning (notify within 1 hour): job failure rate >10% for any type, provider error rate >5%, intervention queue >10 items
- Info (daily digest): campaign progress metrics, mention counts, creator funnel conversion rates

#### Intervention SLA ownership
- Intervention items must have an assigned owner within 4 hours
- Unresolved interventions >24 hours escalate to organization owner
- SLA tracked in dashboard metrics

### 4. Define rollout gates for the riskiest subsystems

| Subsystem | Gate criteria | Rollback trigger |
|-----------|--------------|------------------|
| Creator search (browser worker) | 10 successful searches without CAPTCHA block | >3 CAPTCHA blocks in 1 hour |
| Inbox AI drafting | 50 drafts generated with >80% operator acceptance rate | <50% acceptance rate over 20 drafts |
| Shopify order creation | 5 successful orders with correct product mapping | Any duplicate order created |
| Mentions tracking | 10 mentions correctly attributed to creators | >20% attribution failures |
| Self-serve activation | 3 successful onboardings end-to-end | Onboarding drop-off >50% at any step |
| Outreach engine | 20 emails sent with correct brand voice | Any email sent to wrong creator or with wrong brand |
| Email deliverability | New alias completes warm-up to 200/day with <2% bounce rate | Bounce rate >5% or complaint rate >0.3% on any alias |

Each gate has a "proceed" and "rollback" path. Rollback means: disable the subsystem for the affected brand, revert to manual process, file incident report.

### 5. Synthesize subphases a-d into `finalplan.md`

The synthesis artifact at `docs/planning/phase-8/finalplan.md` must contain:

1. **Executive summary** — what the platform does, what it replaces, who it serves
2. **Architecture overview** — from 8a: stack, deployment, route groups, provider map
3. **Data model** — from 8b: entity summary, key relationships, status enums, brand config
4. **Integration contracts** — from 8c: provider map, job types, webhook flow, idempotency matrix
5. **Product surfaces** — from 8d: route structure, onboarding flow, inbox, state machines, permissions
6. **Migration plan** — from 8e: data import, side-by-side, cutover, legacy freeze
7. **QA contract** — from 8e: test types, parity mapping, replay fixtures
8. **Observability** — from 8e: logs, metrics, alerts, SLAs
9. **Rollout gates** — from 8e: subsystem gates, proceed/rollback criteria
10. **Build order** — from 8a: numbered implementation sequence with dependencies
11. **Resolved questions** — from root plan: all locked decisions with rationale
12. **Skill invocation guide** — which skills to invoke at each build step
13. **ZRG reference map** — which ZRG Dashboard files to read before implementing each subsystem

Format: single Markdown file, structured for an execution agent to read top-to-bottom and begin implementation.

## Output
- Completed artifact: `docs/planning/phase-8/e/rollout.md`
- Completed artifact: `docs/planning/phase-8/finalplan.md`
- The rollout artifact now locks:
  - data import and pilot-brand migration strategy
  - replay shadow / controlled live pilot sequencing
  - parity-based QA contract
  - structured logging, metrics, alerting, and SLA requirements
  - subsystem-specific proceed / rollback gates
- The synthesis artifact now locks:
  - executive summary and scope boundaries
  - resolved technical decisions
  - architecture, schema, integration, and UI contracts
  - migration path
  - QA and observability contract
  - execution build order
  - skill invocation guide
  - ZRG reference map

## Coordination Notes

- Re-read before editing:
  - `docs/planning/phase-8/a/architecture.md`
  - `docs/planning/phase-8/b/schema.md`
  - `docs/planning/phase-8/c/integrations.md`
  - `docs/planning/phase-8/d/product-surfaces.md`
  - `docs/seed-scale-handoff/appendix/behavior-parity-checklist.md`
- Integrated urgency-aware rollout guidance:
  - ideal longer shadow mode remains documented
  - compressed 48-72h replay path is explicitly included for the pilot if timeline pressure requires it

## Validation Notes

- `finalplan.md` is now self-contained and does not require the reader to inspect subphase plans first.
- All parity checklist sections A-J are mapped into the QA/release contract.
- Rollout gates include explicit rollback triggers, not just “watch carefully”.
- The first implementation step is stated explicitly at the end of `finalplan.md`.

## Handoff
This closes the planning track for Phase 8. Execution should now follow `docs/planning/phase-8/finalplan.md` in order, starting with app bootstrap, auth, tenancy, and billing. No further architecture planning is required before implementation begins unless a provider-specific blocker appears.

## Validation (RED TEAM)
- Verify that every parity checklist section (A-J) has at least one test case mapped.
- Verify that the migration script handles all current Airtable status values (not just the happy path).
- Verify that rollout gates have explicit rollback triggers (not just "if it fails").
- Verify that `finalplan.md` is self-contained — an execution agent should NOT need to read 8a-8e plans separately.
- Verify that the build order in `finalplan.md` matches the dependency graph (no step depends on an unbuilt step).

## Skills Available for This Subphase
- `phase-gaps`: available — for final RED TEAM pass on synthesis artifact
- `playwright-testing`: available — for E2E test plan design
- `gepetto`: available — for detailed implementation plan in finalplan.md
- `qa-test-planner`: available — for test matrix generation
- Planned invocations: `phase-gaps`, `playwright-testing`, `gepetto`, `qa-test-planner`
- ZRG references:
  - E2E tests: `ZRG-Dashboard/e2e/` — production Playwright E2E patterns
  - Test orchestration: `ZRG-Dashboard/scripts/test-orchestrator.ts` — test runner patterns
  - AI replay tests: `ZRG-Dashboard/.artifacts/ai-replay/` — fixture-based AI replay testing

## Assumptions / Open Questions (RED TEAM)
- Side-by-side validation period is 1-2 weeks. If the team wants faster cutover, shadow mode can be shortened but risk increases.
  - Why it matters: longer shadow mode = more confidence, but delays launch.
  - Current default: 1-2 weeks shadow mode per brand.
- Observability stack is log-based (structured JSON logs + simple dashboard). If the team wants a full APM (Datadog, Sentry), the instrumentation strategy changes.
  - Why it matters: APM adds cost and complexity but provides better debugging.
  - Current default: structured logs + Vercel Analytics + Sentry for error tracking (free tier).
