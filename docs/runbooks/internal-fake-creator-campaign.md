# Internal fake creator campaign runbook

Purpose: prove the seeding lifecycle without sending real outreach, creating live Shopify orders, exposing secrets, or requiring a Refunnel subscription.

Use this with an internal/demo brand and clearly fake creator records only. Every external step below stays approval-gated until Kamila connects the real accounts and approves a real run.

## Lifecycle proof path

| Step | Status in this runbook | Proof to capture | External connection needed later |
| --- | --- | --- | --- |
| 1. Sourced | Simulated or internal fixture | Fake creators exist in the campaign discovery/review list with source noted as internal fixture. | Apify/Crawlee/creator-search worker for real discovery. |
| 2. Approved | Internal app action | Creator moves from pending review to approved/ready. | None beyond app/database. |
| 3. Contacted / drafted | Draft only | Outreach draft exists and is reviewable; nothing is sent. | Gmail OAuth or approved sending channel before live send. |
| 4. Replied | Simulated | Internal reply fixture or manual test note moves lifecycle to replied. | Gmail inbox sync or connected reply channel for real replies. |
| 5. Address captured | Simulated | Shipping address snapshot exists as fake data and is marked internal/demo. | Real creator reply parsing plus human approval before use. |
| 6. Order prepared | Simulated, no live order | Order-prepared placeholder/checklist confirms product, variant, address, and approval gate. | Shopify connection, product mapping, and Kamila approval before creating any real order. |
| 7. Shipment tracking | Simulated | Tracking placeholder/status event exists and is clearly fake. | Carrier/Track17 plus Shopify fulfillment webhooks for real shipment proof. |
| 8. Content tracking | Placeholder | Mention/content slot exists with expected URL/date/status fields. | Instagram/Meta webhook or manual mention capture for real content detection. |
| 9. Usage rights | Optional placeholder | Rights status is tracked as `not_requested`, `requested`, `granted`, or `declined`; do not require it for gifting-only seeding. | Refunnel replacement or manual rights workflow if/when paid-ad rights matter. |

## Safe staging rehearsal

1. Run `cd apps/web && npm run staging:preflight`.
2. Confirm the report prints only variable names and `present` / `missing`, never values.
3. Use an internal campaign name like `Kalm Internal Seeding Rehearsal`.
4. Add 3-5 fake creators with obviously fake handles and emails.
5. Approve one creator, defer one, and decline one.
6. Generate outreach as a draft only.
7. Simulate a reply and address using fake data.
8. Prepare the order checklist only; do not click or call any live order creation action.
9. Simulate shipment and content placeholders.
10. Export or screenshot the final lifecycle states for signoff.

## Launch gates before a real Kalm run

- Kamila provides/approves staging credentials through a secure mechanism; no credentials go in chat, files, or commits.
- Shopify test/dev store connection is verified before any real Kalm store action.
- Gmail sending remains draft-only until Kamila approves the exact send behavior.
- Product/variant mapping is reviewed before order creation.
- Shipment proof comes from carrier acceptance/movement, not just an order or label.
- Paid-ad usage rights stay optional unless Kamila decides the campaign requires them.
