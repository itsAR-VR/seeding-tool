# Seed Scale Handoff (Source of Truth)

Last updated: 2026-03-02  
Prepared for: incoming developer handoff  
Owner audience: non-technical founder + technical implementer

## 1) What this system is

Seed Scale is an influencer seeding automation platform that turns a manual gifting workflow into a mostly automated pipeline:

1. source influencers,
2. review and approve,
3. run email outreach + follow-up sequence,
4. collect shipping address from replies,
5. create Shopify orders,
6. track delivery,
7. trigger post-delivery reminder messages,
8. track mentions and update Airtable counters.

The core business value is leverage:

- one coordinator manages many more influencers,
- consistent follow-up cadence with lower human error,
- faster conversion from approval -> product sent -> content tracked,
- clearer operational visibility in Airtable.

## 2) Important verification boundary

This handoff is grounded in the current repo source of truth:

- n8n workflow exports in `docs/n8n-audit-2026-03-01/`
- source docs/transcript in `docs/seed-source-2026-03-01/`
- workflow inventory in `docs/n8n-audit-2026-03-01/workflow-node-audit.md`

All `[AC]` workflows were verified from exported JSON node-by-node for:

- workflow ID,
- active flag,
- node count,
- disabled nodes,
- triggers,
- key integrations.

If live n8n UI has changed since the export timestamp (`2026-03-01`), those deltas must be re-exported and diffed.

## 3) Current workflow inventory

### Active `[AC]` workflows

| Workflow | ID | Active | Nodes | Disabled |
|---|---|---:|---:|---:|
| `[AC] (1) Instagram Following [PROD]` | `klEpcDpBNWMOliSX` | Yes | 68 | 0 |
| `[AC] (2) Follow Up Seeding [PROD]` | `gt1mI7ckbbQuKuew` | Yes | 34 | 0 |
| `[AC] (3) (4) Answer Email & Get Address & Shopify [PROD]` | `xQu2HGg7lMhuqOsi` | Yes | 47 | 0 |
| `[AC] (7) (8) (9) Mentions [TESTING]` | `cTgOL46Fwj1o0iHu` | Yes | 52 | 0 |
| `[AC] Costs COGS + Tools - Seeding Orders` | `zjgm4l9fldEaHxav` | Yes | 6 | 0 |
| `[AC] Message System [Draft]` | `zCAQ4IjyvVc1cY1k` | Yes | 38 | 2 |

### Notes

- `[AC] Message System [Draft]` has two disabled schedule triggers and appears partially implemented.
- Mentions workflow is marked `[TESTING]` in naming even though it is `active=true`, so environment semantics are mixed and should be normalized.

## 4) High-level architecture

### Operational systems

- `Airtable` as operational CRM/state tracker (People + Mentions tables).
- `n8n` as automation/orchestration runtime.
- `Gmail` for outreach and reply handling.
- `Shopify` for product lookup + order creation + fulfillment signal.
- `Instagram/Meta + webhook paths` for mention and event handling.
- `Cloudinary` for media storage step in mentions flow.
- `OpenAI` for response/address extraction/classification in multiple flows.
- `Google Sheets` as control/staging in parts of workflow set.

### Business process split

Per your current operating model:

- brand-specific and likely swapped per brand:
  - influencer list/selection inputs,
  - outreach and reply messaging voice,
  - product selection and product IDs.
- reusable across brands:
  - Shopify order creation pattern,
  - fulfillment tracking pattern,
  - content aggregation/mentions tracking pattern.

## 5) Seed Scale master plan vs implemented behavior

Source plan reference: `docs/seed-source-2026-03-01/Seed-Scale.txt`

| Plan Step | Status | Implementation Mapping | Gap Summary |
|---|---|---|---|
| 1. Manual data input | Implemented (with evolution) | AC1 scraping + Airtable population + manual approval gate | Plan says manual sheet input; current flow uses automated scraping into Airtable before approval |
| 2. Automated outreach | Implemented | AC2 welcome + 5-step follow-up via Gmail | Hardcoded copy/subject still brand-coupled |
| 3. AI response handling | Implemented | AC3/4 Gmail trigger, address parsing, response logic | Behavior is present; quality and guardrails need production hardening |
| 4. Draft order creation | Implemented | AC3/4 Shopify product lookup + order create + Airtable update | Hardcoded product/store values present |
| 5. Manual fulfillment | External dependency | Shopify fulfillment operation is outside n8n | No platform issue, but clear ops SLA needed |
| 6. Delivery confirmation | Implemented (event-driven) | AC7/8/9 Shopify trigger + delivered status updates | Needs reliability checks and replay/idempotency patterns |
| 7. Post-delivery follow-up | Implemented | AC7/8/9 creates post-delivery reminder email | Message content and schedule should be centralized config |
| 8. Content tracking | Partially implemented | AC7/8/9 mentions/posts/history + Airtable counters + Cloudinary upload | Multi-post handling and richer content ingestion still limited |
| 9. Non-post follow-up | Implemented | AC7/8/9 schedule checks + reminder messaging after delay | Needs clear stop conditions and suppression rules |
| 10. Manual intervention flag | Implemented | AC2 logic around follow-up count and intervention path in Airtable views | Requires explicit runbook and ownership SLA |

## 6) Airtable operating model

Source reference: `docs/seed-source-2026-03-01/Airtable-Database-Guide.txt`

Primary table usage:

- `People` table is the lifecycle backbone:
  - waiting approval,
  - approved,
  - follow-up state,
  - Shopify order state,
  - intervention state,
  - declined state.
- `Mentions` table captures each detected post/story artifact.

Critical views used operationally:

- `Waiting Approval`
- `Approved`
- `Shopify`
- `Mentions`
- `Intervention Flag`
- `Declined`

## 7) Hardcoded configuration surface (current state)

The current system contains multiple brand-coupled values embedded in node parameters and code blocks, including:

- Shopify store slug (`kalmwellness`) and admin URL patterns.
- product and variant IDs (for example product `9739836227901`, variant `49935214379325`).
- branded email subject line (`Kalm - Partnership!`).
- branded product URL (`clubkalm.com/.../kalm-mouth-tape-refill`).
- Airtable base/table IDs tightly referenced in many nodes.
- provider endpoints and header values in draft message workflow.
- IG tokenized constants in mentions logic.

See full map in `docs/seed-scale-handoff/appendix/source-truth-map.md`.

## 8) Direct answer: "How quickly can we change hardcoded product IDs, store slug, and similar values?"

If changing only literals and keeping current architecture:

- **same-day (2-4 hours)** for a careful sweep + spot checks.

If also doing safe centralization (recommended) with a config table and node refactor:

- **1-2 days** including smoke tests on outreach -> order -> delivery -> mentions.

If converting to a robust multi-brand ready template with clear environment separation and rollback:

- **3-5 days** depending on test coverage and migration rigor.

Why this estimate is not "instant":

- values are repeated in multiple workflows and node types,
- some values are inside code nodes, not only top-level params,
- lifecycle correctness requires end-to-end validation across Airtable + Gmail + Shopify + mentions.

## 9) Production-readiness gap analysis

### P0 (must resolve before scale-up)

1. Configuration centralization missing  
   - Hardcoded brand values scattered across workflows.
2. Secret hygiene risk  
   - Exported workflow JSON contains sensitive-looking token/header patterns in code/params.
3. Environment semantics unclear  
   - `[TESTING]` workflow names with active production-like behavior can cause mistakes.
4. No formal idempotency contract across lifecycle events  
   - duplicate webhook/retry scenarios can create double updates/messages/orders.

### P1 (high priority)

1. Missing runbook-quality operational ownership  
   - intervention handling and exception playbooks are not centralized in one operator guide.
2. Limited automated validation  
   - no explicit integration test harness for key lifecycle stages.
3. Observability is fragmented  
   - Discord/Slack/error nodes exist, but no structured SLO dashboard and alert routing standard.

### P2 (important, can follow after stabilization)

1. Mentions/content model depth  
   - multi-post and richer content handling still constrained.
2. Draft message-system workflow maturity  
   - draft pipeline should either be promoted or archived to reduce ambiguity.

## 10) Recommended implementation plan for incoming developer

### Phase A: Stabilize and parameterize

- Move brand values into one config surface (Airtable config table or n8n global/env-backed strategy).
- Replace literal references in AC2, AC3/4, AC7/8/9, and COGS flow.
- Add strict naming convention: `[ENV]-[BRAND]-[FLOW]-[PURPOSE]`.

### Phase B: Reliability hardening

- Add idempotency keys per lifecycle action.
- Add explicit guard conditions for repeat emails/order writes.
- Add standardized error categories and escalation routes.

### Phase C: Production operations

- Write operator runbook for intervention queue, retries, and data repair.
- Implement daily health checks and KPI snapshots (pipeline counts by stage).
- Define SLAs for manual checkpoints (approval, intervention, fulfillment exceptions).

## 11) Skills guidance for AI-assisted development

Use these skills intentionally, in order:

1. `requirements-clarity`  
   - lock scope and simplify before refactor.
2. `phase-plan`  
   - convert this handoff into an execution phase folder.
3. `phase-gaps`  
   - red-team plan assumptions before changing live automations.
4. `code-review`  
   - run structured checks after each workflow refactor/export.
5. `qa-test-planner`  
   - generate regression matrix for outreach/order/mentions lifecycle.
6. `playwright-skill` (or live-env equivalent)  
   - validate UI-level operator flows and any web-based control surfaces.
7. `session-handoff`  
   - maintain continuity across long context-heavy implementation sessions.
8. `code-documentation` + `writing-clearly-and-concisely`  
   - keep docs current, short, and operational.

## 12) What is intentionally left to developer discretion

The incoming developer should choose implementation details for:

- config backend pattern (Airtable config table vs env vs hybrid),
- CI/CD and deployment mechanism for n8n workflow promotion,
- exact idempotency strategy,
- observability stack depth,
- testing framework style (export-diff tests, staging replay tests, etc.).

Vision and behavior should stay fixed; technical expression is flexible if parity is preserved.

## 13) First-48-hour onboarding checklist

1. Read this file and all appendices once end-to-end.
2. Re-export current n8n workflows and diff against `docs/n8n-audit-2026-03-01/`.
3. Confirm Airtable schema and required fields still match automation formulas.
4. Build a single "brand-config inventory" sheet from current hardcoded references.
5. Propose parameterization patch + test plan before touching live logic.

## 14) Linked appendices

- Decisions: `docs/seed-scale-handoff/appendix/decision-log.md`
- Open choices: `docs/seed-scale-handoff/appendix/open-choices.md`
- Source map: `docs/seed-scale-handoff/appendix/source-truth-map.md`
- Parity checklist: `docs/seed-scale-handoff/appendix/behavior-parity-checklist.md`
