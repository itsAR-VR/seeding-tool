# Decision Log (Current-State, Inferred + Explicit)

This log captures decisions already embodied in the system so the new developer does not accidentally redesign core behavior during onboarding.

## Accepted decisions in current implementation

| ID | Decision | Status | Evidence | Impact |
|---|---|---|---|---|
| D-001 | Airtable is the operational state hub | Accepted | Airtable table usage in all AC flows and Airtable guide doc | Central source for approval, outreach status, Shopify status, mentions status |
| D-002 | Human approval remains a required gate | Accepted | Waiting Approval/Approved views and transcript walk-through | Protects brand quality; limits fully-automatic scaling |
| D-003 | Outreach channel is email-first | Accepted | AC2 + AC3/4 Gmail-driven flow | Simplifies automation, leaves DM as future/optional |
| D-004 | Follow-up sequence uses fixed staged cadence | Accepted | AC2 switch + follow-up count/date fields | Ensures consistent persistence and intervention timing |
| D-005 | Address collection is AI-assisted in thread context | Accepted | AC3/4 prompt + extraction + branch logic | Reduces manual handling but introduces parsing risk |
| D-006 | Shopify order creation is automated once address is valid | Accepted | AC3/4 Shopify nodes and Airtable update fields | Moves fulfillment handoff faster and consistently |
| D-007 | Fulfillment operation remains manual in Shopify | Accepted | Seed-Scale doc step 5 and transcript | Keeps warehouse process unchanged |
| D-008 | Post-delivery reminder and mention tracking are automated | Accepted | AC7/8/9 triggers and reminder/mentions nodes | Closes loop from shipped product to content outcome |
| D-009 | Intervention queue is explicit and human-owned | Accepted | Airtable Intervention Flag + follow-up limits | Keeps edge cases visible instead of silent failures |
| D-010 | Cost tracking is separate workflow, not inline in lifecycle | Accepted | AC Costs flow | Better separation for finance metrics but extra surface to maintain |

## Intentional constraints implied by business vision

| ID | Constraint | Status | Meaning |
|---|---|---|---|
| C-001 | Keep core seeding mechanics reusable | Accepted | Shopify ordering, fulfillment tracking, and content aggregation should remain common modules |
| C-002 | Keep brand expression swappable | Accepted | Influencer list logic, messaging voice, and product mapping must be configurable per brand |
| C-003 | Prefer practical automation over perfect automation | Accepted | Manual checkpoints remain where judgment is needed |

## Decisions still not resolved (must be formalized)

| ID | Open decision | Why unresolved matters |
|---|---|---|
| O-001 | Multi-brand config architecture | Without this, onboarding each brand repeats risky string edits |
| O-002 | Environment promotion workflow (dev/stage/prod) | Without this, testing and release risk stays high |
| O-003 | Idempotency contract and duplicate-event handling | Without this, retries/webhooks can duplicate actions |
| O-004 | Credential governance and secret rotation process | Without this, security risk grows with each export/share |
| O-005 | Observability SLIs/SLOs and paging ownership | Without this, failures stay reactive and manual |

## Usage notes for incoming developer

- Treat accepted decisions as behavioral constraints unless founder explicitly changes vision.
- Use open decisions as first-week architecture alignment agenda.
- Update this log whenever decisions change, not only when code changes.
