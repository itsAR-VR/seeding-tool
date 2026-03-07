# Phase 8d — Specify operator product surfaces, inbox behavior, and funnel state machines

## Focus
Translate the backend architecture into the actual product experience: onboarding, live creator search, approval queue, inbox, orders, mentions, interventions, and analytics, with clear branch logic for every stage of the funnel.

## Inputs
- `docs/planning/phase-8/plan.md` (root plan with RED TEAM findings)
- `docs/planning/phase-8/a/architecture.md` (architecture lock — route groups, stack, build order)
- `docs/planning/phase-8/b/schema.md` (canonical schema — entities, status enums, brand config surface)
- `docs/planning/phase-8/c/integrations.md` (integration contracts — job types, idempotency keys, provider escalation paths)
- `docs/seed-scale-handoff/appendix/behavior-parity-checklist.md` (10-section verification checklist)
- `apps/web/app/page.tsx` (current marketing homepage — to understand existing product positioning)
- `apps/web/app/components/Shell.tsx` (Phase 7's shared shell — to avoid conflicts)

## Work

### 1. Define the self-serve onboarding wizard

Route: `(platform)/onboarding/[step]`

Steps (wizard-style, linear with back navigation):
1. **Create account** — Supabase Auth signup (email + password, or Google OAuth)
2. **Create organization** — name, website (auto-creates Stripe Customer)
3. **Select plan** — Stripe Checkout redirect for subscription
4. **Create first client** — name (optional for direct brands, required for agencies)
5. **Create first brand** — name, website, Shopify store URL
6. **Connect Shopify** — OAuth flow, store the access token in ProviderCredential
7. **Connect Gmail** — OAuth flow, store tokens in ProviderCredential
8. **Configure brand voice** — text area for brand persona/tone, product descriptions, messaging rules
9. **Map products** — select Shopify products to use for seeding, map variants
10. **Submit seed creators** — paste 3-5 Instagram handles of creators in their niche (used for similarity search)
11. **Create first campaign** — name, date range, product selection, outreach template preview
12. **Launch** — review summary, confirm, start campaign

Each step writes to the database immediately (not a single form submit). User can abandon and resume.

### 2. Define the platform route structure

All platform routes under `(platform)/` with auth middleware:

```
(platform)/
  layout.tsx              — platform shell (sidebar nav, brand switcher, user menu)
  dashboard/page.tsx      — overview metrics (active campaigns, pending actions, recent mentions)
  campaigns/
    page.tsx              — campaign list
    [id]/page.tsx         — campaign detail (creators, status distribution, metrics)
    new/page.tsx          — create campaign wizard
  creators/
    page.tsx              — creator database (all creators across campaigns)
    search/page.tsx       — live creator search (Meta browser worker)
    [id]/page.tsx         — creator profile (history, campaigns, mentions, conversations)
  inbox/
    page.tsx              — conversation list (all threads, filterable)
    [threadId]/page.tsx   — thread detail (messages, AI drafts, actions)
  orders/
    page.tsx              — order list (Shopify orders, fulfillment status)
  mentions/
    page.tsx              — mentions feed (detected posts/stories)
  interventions/
    page.tsx              — intervention queue (flagged items needing human action)
  settings/
    page.tsx              — organization settings
    billing/page.tsx      — Stripe Customer Portal link, plan details
    brands/page.tsx       — brand management
    brands/[id]/page.tsx  — brand config (voice, products, templates, credentials)
    brands/[id]/email/page.tsx — email alias management + deliverability dashboard
    team/page.tsx         — team members and roles
  onboarding/
    [step]/page.tsx       — onboarding wizard steps
```

### 3. Define the live creator-search experience and review queue

Route: `(platform)/creators/search`

- **Search form**: niche keywords, audience size range, location filter, seed creator handles (pre-filled from onboarding)
- **Search execution**: submits to job queue -> browser worker -> results stream back
- **Results display**: card grid with creator profile photo, handle, follower count, bio, fit score (0-100), evidence snippet
- **Actions per result**: Approve (adds to campaign), Reject (skip), Flag (review later)
- **Dedupe**: if creator already exists in DB, show existing record with "already in campaign X" badge
- **Fallback**: "Add manually" button -> form for handle, email, notes. "Import CSV" button -> bulk creator upload
- **Review queue**: approved creators appear in campaign detail with status `pending_review` until operator confirms

### 4. Define the conversation-first inbox

Route: `(platform)/inbox`

- **Thread list** (left panel):
  - Sorted by most recent message
  - Filters: all, needs reply, AI draft ready, waiting for address, intervention required
  - Each thread shows: creator name, last message preview, status badge, time since last message
  - Unread indicator for threads with new inbound messages

- **Thread detail** (right panel):
  - Full message history (inbound and outbound)
  - Each message shows: sender, timestamp, raw content
  - AI classification badge on inbound messages: `positive`, `address_provided`, `question`, `decline`, `unclear`
  - If AI generated a draft reply: show draft with "Send", "Edit", "Discard" buttons
  - If address was extracted: show parsed address with "Confirm & Create Order" button
  - Manual compose: text area for custom reply (with AI suggestion button)
  - Audit history: collapsible panel showing all AI actions, classifications, and draft generations for this thread

- **AI copilot behavior**:
  - On new inbound message: auto-classify, auto-generate draft if appropriate
  - Draft generation uses brand voice prompt + conversation context + message templates
  - AI NEVER sends automatically in v1 — all sends require human confirmation
  - Classification confidence shown: if <80%, flag for manual review

### 5. Define funnel state machines and decision trees

#### Discovery and Approval
```
[creator found] -> pending_review
  -> [operator approves] -> approved
  -> [operator rejects] -> declined (terminal)
  -> [operator flags] -> flagged_for_review -> pending_review (loop)
```

#### Outreach and Follow-ups
```
[approved] -> outreach_queued
  -> [email sent successfully] -> outreach_sent
    -> [reply received within window] -> replied (go to Reply Handling)
    -> [no reply after cadence_days] -> follow_up_1_queued
      -> [follow_up_1 sent] -> follow_up_1_sent
        -> [reply received] -> replied
        -> [no reply] -> follow_up_2_queued
          -> ... (up to max_follow_ups from BrandConfig)
            -> [max follow-ups reached, no reply] -> unresponsive
              -> [operator intervention] -> intervention_required
  -> [email send failed] -> outreach_failed -> intervention_required
```

#### Reply Handling and Address Capture
```
[replied] -> ai_classifying
  -> [address_provided] -> address_captured
    -> [operator confirms address] -> order_ready
  -> [positive_no_address] -> ai_drafting_address_request
    -> [draft sent, waiting reply] -> outreach_sent (re-enter follow-up loop)
  -> [question] -> ai_drafting_answer
    -> [draft ready] -> inbox (operator reviews and sends)
  -> [decline] -> declined (terminal)
  -> [unclear / low confidence] -> intervention_required
```

#### Order Creation and Fulfillment
```
[order_ready] -> order_creating
  -> [Shopify order created] -> order_created
    -> [fulfillment event: shipped] -> shipped
      -> [fulfillment event: delivered] -> delivered
        -> [schedule reminder] -> reminder_scheduled (go to Post-Delivery)
    -> [fulfillment event: failed] -> fulfillment_failed -> intervention_required
  -> [Shopify API error] -> order_failed -> intervention_required
```

#### Post-Delivery Reminders
```
[delivered] -> reminder_scheduled
  -> [reminder_delay_hours passed] -> reminder_sending
    -> [reminder sent] -> reminder_sent
      -> [mention detected] -> posted -> completed
      -> [no mention after reminder_stop_days] -> reminder_2_scheduled (loop up to 2 reminders)
        -> [still no mention] -> completed_no_post (terminal, not intervention — creator fulfilled their end)
```

#### Mentions Tracking
```
[mention webhook/poll received] -> mention_processing
  -> [new mention, creator identified] -> mention_created
    -> [link to CampaignCreator] -> posted (update status)
    -> [creator not in any campaign] -> orphan_mention (log, surface in mentions feed)
  -> [duplicate mention] -> skip (idempotent)
```

### 6. Define first-launch role permissions

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| Create/delete organization | x | | | |
| Manage billing | x | x | | |
| Invite team members | x | x | | |
| Create campaigns | x | x | x | |
| Approve/decline creators | x | x | x | |
| Send messages (inbox) | x | x | x | |
| Confirm orders | x | x | x | |
| Resolve interventions | x | x | x | |
| View dashboard/reports | x | x | x | x |
| Configure brand settings | x | x | | |
| Connect providers (Shopify, Gmail) | x | x | | |

### 7. Define feature-flag path for AI auto-approve/decline

NOT in v1 — future feature flag:
- `ai_auto_approve_threshold`: when set (e.g., 0.85), creators with fit score above threshold are auto-approved
- `ai_auto_decline_threshold`: when set (e.g., 0.3), creators below threshold are auto-declined
- `ai_auto_send_drafts`: when enabled, AI-generated drafts with confidence >90% are sent automatically
- All auto-actions logged with `automated: true` flag in ActivityLog for audit

### 8. Define email alias management and deliverability UI

Route: `(platform)/settings/brands/[id]/email`

- **Alias list**: table of connected Gmail accounts with columns: email address, status (warming up / active / paused / disabled), daily limit, today's sent count, bounce rate (7-day rolling), complaint rate (7-day rolling)
- **Connect alias**: "Connect Gmail Account" button -> OAuth flow -> creates EmailAlias + ProviderCredential
- **Warm-up indicator**: progress bar showing current daily limit vs target (warm-up complete when limit reaches platform cap of 1600/day)
- **Pause/resume**: operator can manually pause/resume any alias
- **Alerts**: inline warning if any alias has bounce rate >2% or complaint rate >0.1%
- **Round-robin config**: option to set a primary alias (used first) or equal distribution

### 9. Creator consent and opt-out

- Every outreach email includes an unsubscribe link (CAN-SPAM compliance)
- Unsubscribe link hits `apps/web/app/api/unsubscribe/[token]/route.ts` (public, no auth required)
- Clicking unsubscribe sets `opted_out = true` on Creator record
- All future outreach, follow-ups, and reminders are suppressed for opted-out creators
- Opt-out is visible in creator profile and intervention queue

## Output
- Completed artifact: `docs/planning/phase-8/d/product-surfaces.md`
- The artifact now locks:
  - the platform IA and route map
  - the resumable onboarding wizard with explicit entity writes per step
  - the campaign control room, creator search, inbox, orders, mentions, interventions, and settings surfaces
  - the Airtable-view replacement mapping into platform UI
  - AI copilot rules and confidence-based human checkpoints
  - eight concrete funnel decision trees covering onboarding, approval, outreach, reply handling, order flow, mentions/non-post behavior, consent, and intervention triage
  - a permissions matrix and future feature-flag path

## Coordination Notes

- Re-read before editing:
  - `docs/planning/phase-8/b/schema.md`
  - `docs/planning/phase-8/c/integrations.md`
  - `apps/web/app/layout.tsx`
  - `apps/web/app/components/Shell.tsx`
- Integrated current repo-boundary findings:
  - marketing shell stays marketing-only
  - platform shell is separate and sidebar-driven
  - anonymous marketing routes must remain public and testable while the platform grows beside them
- Adjusted state-machine wording to align with the schema:
  - delivery/post/reminder states use the 8b enum set instead of introducing new undocumented terminal states

## Validation Notes

- Every Airtable operational view now has a direct platform equivalent.
- Every major failure branch routes to an intervention or a clear terminal state.
- The opt-out path is explicit and public.
- v1 AI boundaries are explicit: AI drafts and classifies, but does not auto-send.

## Handoff
Subphase 8e should now turn the architecture into a release contract. It needs to use:

- the system/runtime lock from 8a
- the schema contract from 8b
- the provider/job contract from 8c
- the UI/state-machine contract from 8d

8e should verify that:
- every state transition is testable,
- every provider failure is observable,
- every migration step has rollback logic,
- and `finalplan.md` reads like an execution-ready build document rather than another brainstorming note.

## Validation (RED TEAM)
- Verify that every Airtable view from `behavior-parity-checklist.md` has a corresponding platform route or UI element.
- Verify that every branch in the state machines terminates (no infinite loops without stop conditions).
- Verify that the intervention path is reachable from every failure state.
- Verify that CAN-SPAM opt-out is included in outreach design.
- Verify that AI never sends automatically in v1 (all sends require human confirmation).
- Walk through the onboarding wizard and verify each step writes to a specific entity from the 8b schema.

## Skills Available for This Subphase
- `llm-application-dev`: available — for AI copilot behavior design
- `browser-automation`: available — for creator search UX
- `playwright-testing`: available — for testing state machine flows
- `frontend-design`: available — for product surface design
- Planned invocations: `llm-application-dev`, `frontend-design`, `playwright-testing`
- ZRG references (MUST READ before implementing):
  - Dashboard components: `ZRG-Dashboard/components/dashboard/` — production SaaS dashboard patterns
  - UI component library: `ZRG-Dashboard/components/ui/` — shadcn/ui + Radix primitives
  - Server actions: `ZRG-Dashboard/actions/` — type-safe `{ success, error }` pattern with auth
  - Auth pages: `ZRG-Dashboard/app/auth/` — login, signup, callback, verify, password reset flows

## Assumptions / Open Questions (RED TEAM)
- Sidebar navigation is the platform shell pattern (not top-nav). This is standard for SaaS dashboards.
  - Why it matters: affects layout component architecture and responsive behavior.
  - Current default: sidebar nav with collapsible mobile drawer.
- Dashboard metrics are read-only aggregations in v1 (no custom report builder).
  - Why it matters: simplifies v1 scope. Custom analytics is a future feature.
  - Current default: fixed dashboard with campaign counts, pending actions, recent mentions.
