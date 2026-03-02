# Behavior Parity Checklist

Use this checklist before and after any refactor, migration, or brand-parameterization work.

## A) Intake and approval

- [ ] New influencer records reach `Waiting Approval` with expected base fields populated.
- [ ] Approve action moves records into `Approved` lifecycle without manual data repair.
- [ ] Decline action prevents all outreach automations from triggering.
- [ ] Records with missing email are visible in `Approved Without Email`/equivalent handling path.

## B) Outreach and follow-up sequence

- [ ] Welcome message sends once for newly approved records with valid email.
- [ ] `First Follow Up Date` and `Follow-up Date` fields update correctly.
- [ ] Follow-up sequence respects 3-day cadence and count incrementing.
- [ ] Sequence stops when influencer replies.
- [ ] After max follow-up threshold, record appears in intervention workflow/view.

## C) Reply handling and address capture

- [ ] Inbound reply triggers AI reply handling path.
- [ ] If no valid shipping address is detected, system asks for address again.
- [ ] If valid address is detected, system confirms receipt and proceeds to Shopify path.
- [ ] `Response Count Address` and related Airtable fields reflect message-state transitions.

## D) Shopify order creation and sync

- [ ] Correct product/variant mapping is used for target brand config.
- [ ] Order is created once (no duplicate creation on retries/replays).
- [ ] `Order Shopify ID`, `Order Placed Date`, and `Shopify Order` link are written correctly.
- [ ] `Shopify` Airtable view shows newly created orders without manual intervention.

## E) Fulfillment and delivery pipeline

- [ ] Fulfillment-created/delivery signal updates `Delivered Date`.
- [ ] Post-delivery reminder waits expected delay before sending.
- [ ] Reminder does not send for records already marked as having posted.

## F) Mentions tracking

- [ ] Tagged post events increment `Post` counters for correct influencer.
- [ ] Story/history events increment `History` counters for correct influencer.
- [ ] Mention rows are created in `Mentions` table with URL/content metadata.
- [ ] Cloudinary/media upload path succeeds or degrades gracefully with alerting.

## G) Non-post reminder loop

- [ ] For delivered-but-not-posted influencers, reminder path triggers after configured delay.
- [ ] Reminder path stops after post/history appears.
- [ ] Reminder path does not repeatedly hit already completed influencers.

## H) Intervention and manual recovery

- [ ] Influencers requiring manual intervention are clearly surfaced.
- [ ] Manual data corrections (email/address/status) resume automation without duplicate side effects.
- [ ] Recovery steps are documented and executable by operations staff.

## I) Security and config controls

- [ ] No plaintext secrets remain in code nodes or exported artifacts.
- [ ] Brand-specific literals are resolved from config, not hardcoded per node.
- [ ] Credentials are scoped per environment and rotated when needed.

## J) Operational reliability

- [ ] Error nodes emit actionable context (influencer id, workflow id, stage, reason).
- [ ] Alerts route to owned channel with defined response SLA.
- [ ] Daily stage-count sanity check detects stuck records.

## Release gate

Do not promote changes unless all relevant checklist items are marked complete for the affected lifecycle stages.
