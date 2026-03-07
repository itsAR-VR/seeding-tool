# Phase 8d Product Surfaces and Funnel State Machines

Last updated: 2026-03-06
Owner: Phase 8 execution
Depends on:
- `docs/planning/phase-8/a/architecture.md`
- `docs/planning/phase-8/b/schema.md`
- `docs/planning/phase-8/c/integrations.md`

## 1. Product Principles

### What the UI must optimize for
- speed to first live campaign
- fast exception handling
- high confidence on risky actions
- visibility over “what is stuck”
- brand-scoped execution without cross-brand bleed

### What the UI must not become
- a generic CRM
- a hidden automation box with no traceability
- a dashboard full of vanity metrics but no next actions
- a fully autonomous AI sender in v1

### Shell Decision
- marketing and platform shells are different products
- do not reuse the Phase 7 marketing `Shell` for the app
- platform shell is a sidebar-driven operational workspace with a brand switcher, task counts, and fast access to queue-like surfaces

## 2. Platform Information Architecture

| Route | Purpose | Primary entities | Primary actions |
|---|---|---|---|
| `(platform)/dashboard` | operator command center | `Campaign`, `CampaignCreator`, `ReminderSchedule`, `InterventionCase`, `MentionAsset` | review workload, jump to queues |
| `(platform)/onboarding/[step]` | self-serve setup wizard | `Organization`, `Client`, `Brand`, `BrandOnboarding`, `BrandSettings`, `BrandConnection`, `BrandProduct`, `DiscoverySeed`, `Campaign` | activate account, connect providers, create first campaign |
| `(platform)/campaigns` | campaign index | `Campaign` | create, pause, archive |
| `(platform)/campaigns/[id]` | campaign control room | `Campaign`, `CampaignCreator`, `CampaignProduct`, `CreatorSearchJob` | review creators, launch search, inspect funnel counts |
| `(platform)/campaigns/new` | new campaign wizard | `Campaign`, `CampaignProduct` | create campaign |
| `(platform)/creators` | global creator database | `Creator`, `CreatorProfile`, `CampaignCreator` | inspect history, filter by status/brand |
| `(platform)/creators/search` | live search + shortlist | `CreatorSearchJob`, `CreatorSearchResult`, `DiscoverySeed` | run search, shortlist, reject, import |
| `(platform)/creators/[id]` | creator detail | `Creator`, `CreatorProfile`, `CampaignCreator`, `MentionAsset`, `ConversationThread` | inspect all past interactions |
| `(platform)/inbox` | thread queue | `ConversationThread`, `Message`, `AIArtifact`, `AIDraft` | triage, filter, respond |
| `(platform)/inbox/[threadId]` | thread detail | `Message`, `AIDraft`, `ShippingAddressSnapshot` | confirm address, send/revise draft |
| `(platform)/orders` | gifting execution board | `ShopifyOrder`, `FulfillmentEvent`, `CampaignCreator` | inspect order failures, delivery state |
| `(platform)/mentions` | earned-content board | `MentionAsset`, `CampaignCreator` | verify posted content, inspect orphans |
| `(platform)/interventions` | exception queue | `InterventionCase` | assign, resolve, reopen |
| `(platform)/settings` | organization and brand setup | `Organization`, `Client`, `Brand`, `BrandSettings`, `BrandConnection`, `EmailAlias`, `Subscription` | manage billing, providers, templates, aliases, team |

## 3. Onboarding Wizard

Route family: `(platform)/onboarding/[step]`

### UX rules
- wizard is resumable
- each step commits immediately
- users can leave and return without losing state
- the launch step is blocked until all required integrations/config pass validation

| Step | UI goal | Writes / reads |
|---|---|---|
| `account` | sign up or sign in | Supabase Auth user, `User` profile row |
| `organization` | create org and website context | `Organization` |
| `plan` | choose subscription | Stripe Checkout, pending `Subscription` state |
| `client` | create first client or confirm direct-brand mode | `Client` |
| `brand` | create first operational brand | `Brand`, `BrandOnboarding` |
| `shopify` | connect store | `BrandConnection(provider=SHOPIFY)`, `ProviderCredential` |
| `gmail` | connect first alias | `ProviderCredential`, `EmailAlias`, optional `BrandConnection(provider=GMAIL)` |
| `meta` | connect mentions/search account if available | `BrandConnection(provider=INSTAGRAM_GRAPH|META_MARKETPLACE)` |
| `voice` | define brand voice and approval-safe messaging rules | `BrandSettings`, `OutreachTemplate` |
| `products` | map seeding products/variants | `BrandProduct` |
| `seed-creators` | submit niche examples | `DiscoverySeed` |
| `campaign` | create first campaign and select products/alias | `Campaign`, `CampaignProduct` |
| `launch-review` | verify all readiness checks | reads all above, updates `BrandOnboarding.status` |

### Launch-readiness gate
Launch is enabled only when:
- subscription is active or trialing
- at least one brand exists
- Shopify connection verified
- at least one active email alias exists
- brand settings + templates exist
- at least one active brand product exists
- first campaign exists

## 4. Primary Operational Surfaces

## Dashboard

### Purpose
One place to answer:
- what needs review now
- what is failing now
- what will stall today if nobody acts

### Required modules
- active campaigns
- waiting approval count
- approved-without-email count
- inbox threads needing reply
- address confirmations pending
- order failures
- delivered but not posted
- open interventions
- paused email aliases
- recent mentions

### Default actions
- `Review creators`
- `Open inbox`
- `Resolve interventions`
- `Launch search`

## Campaign Control Room

Route: `(platform)/campaigns/[id]`

### Sections
- campaign summary header
- products / alias / cadence summary
- funnel distribution
  - pending review
  - ready for outreach
  - waiting for reply
  - waiting for address
  - ready for order
  - delivered
  - posted
  - intervention required
- creator table with saved filters
- creator search panel entry
- campaign notes / audit timeline

### Table actions
- approve
- decline
- bulk approve
- send to inbox / view thread
- mark manual correction complete
- export campaign report

## Creator Search

Route: `(platform)/creators/search`

### Search form
- niche tags / keywords
- audience size range
- location filters
- seed creator handles
- exclude handles already contacted or already in campaign

### Result cards
- creator identity
- follower count
- average views / fit evidence
- why matched
- badges:
  - already in DB
  - already in this campaign
  - missing email
  - imported from previous search

### Actions
- shortlist
- approve to campaign
- reject
- save for later
- open existing creator profile

### Streaming / states
- job pending
- worker running
- partial results available
- blocked by CAPTCHA
- completed
- failed

The UI must feel “live”, but search is still asynchronous and queue-backed.

## Creator Profile

Route: `(platform)/creators/[id]`

### Tabs
- overview
- profiles and metrics
- campaigns
- inbox history
- mentions history
- opt-out / consent status
- notes and internal timeline

### Purpose
Make it possible to answer:
- who this creator is
- how they were discovered
- whether they posted before
- whether they opted out
- whether they are worth re-using

## Inbox

Route family:
- `(platform)/inbox`
- `(platform)/inbox/[threadId]`

### List panel
- grouped by filters:
  - waiting for reply
  - needs human answer
  - address detected
  - decline
  - intervention
  - all
- each row shows:
  - creator
  - campaign
  - last message preview
  - AI recommendation badge
  - time since last inbound
  - alias used

### Thread detail
- full chronology
- inbound/outbound clearly separated
- AI artifacts panel:
  - classification
  - confidence
  - extracted address preview
  - next-best-action
- draft panel:
  - suggested reply
  - edit
  - discard
  - send
- fulfillment panel:
  - current lifecycle state
  - active shipping snapshot
  - order status if present

### v1 AI rule
AI can:
- classify
- extract
- suggest
- draft

AI cannot:
- send automatically
- create order automatically without a confirmed address event
- resolve commercial exceptions silently

## Orders Board

Route: `(platform)/orders`

### Views
- ready to order
- created
- fulfilled
- delivered
- failed

### Row data
- creator
- campaign
- brand
- selected product
- order id / admin link
- tracking state
- delivered date
- latest failure reason if any

### Actions
- retry order create
- open creator thread
- open intervention
- jump to Shopify admin

## Mentions Board

Route: `(platform)/mentions`

### Views
- all mentions
- posts
- history/stories
- orphans
- storage failures

### Each row/card shows
- creator
- campaign if matched
- media URL / preview
- source type
- captured timestamp
- storage status
- whether reminder was suppressed because of this mention

## Interventions Queue

Route: `(platform)/interventions`

### Queue groups
- waiting assignment
- assigned to me
- high priority
- resolved recently

### Case detail fields
- type
- severity
- root entity
- why it opened
- provider evidence
- retry history
- recommended action
- owner

### Actions
- assign
- resolve
- dismiss
- reopen
- retry linked job
- open linked thread/order/creator

## Settings

### Organization
- org name
- billing
- plan entitlements
- team invites

### Brand
- voice + templates
- products
- integrations
- aliases
- seed creators
- launch readiness

## 5. Airtable View Replacement Map

| Airtable view | New UI equivalent |
|---|---|
| `Waiting Approval` | campaign control room creator review filter |
| `Approved` | campaign control room / creator table filtered to approved + active |
| `Shopify` | orders board |
| `Mentions` | mentions board |
| `Intervention Flag` | interventions queue |
| `Declined` | creator database filtered to declined-by-campaign state |

## 6. AI Copilot Rules

### Automatically created AI artifacts
- creator fit scoring when search results arrive
- reply classification when inbound message lands
- address extraction when relevant inbound text exists
- draft response when a clear next-best-action exists

### Human checkpoints
- approve or decline creator
- send any outbound email
- confirm or reject extracted address
- retry failed order
- resolve intervention

### Confidence thresholds
- `>= 90`: green suggestion, still human-confirmed
- `80-89`: normal suggestion, human review required
- `< 80`: auto-flag or highlight as low-confidence; no silent advancement

## 7. Funnel Decision Trees

These are the concrete branch structures the product must expose.

## Tree A: Onboarding Activation

```text
user creates account
└─ organization created?
   ├─ no -> stay in onboarding
   └─ yes
      └─ subscription active or trialing?
         ├─ no -> billing step blocks launch
         └─ yes
            └─ brand exists?
               ├─ no -> brand step blocks launch
               └─ yes
                  └─ Shopify connected?
                     ├─ no -> integration warning
                     └─ yes
                        └─ active email alias exists?
                           ├─ no -> cannot launch outreach
                           └─ yes
                              └─ templates + products + seed creators complete?
                                 ├─ no -> onboarding remains IN_PROGRESS
                                 └─ yes -> launch review ready
```

## Tree B: Discovery and Approval

```text
creator candidate enters system
└─ already exists in this campaign?
   ├─ yes -> show duplicate badge, no re-add
   └─ no
      └─ has email?
         ├─ no -> keep reviewable but surface in "approved without email"
         └─ yes -> ready for review

review action
├─ approve -> reviewStatus=APPROVED, lifecycleStatus=READY_FOR_OUTREACH
├─ decline -> reviewStatus=DECLINED, lifecycleStatus unchanged/terminal for this campaign
└─ save for later -> stays PENDING
```

## Tree C: Outreach Cadence

```text
reviewStatus=APPROVED
└─ valid contact path exists?
   ├─ no -> intervention or approved-without-email queue
   └─ yes
      └─ initial outreach sent?
         ├─ no -> enqueue initial outreach
         └─ yes
            └─ reply received?
               ├─ yes -> move to inbox reply handling
               └─ no
                  └─ followUpCount < maxFollowUps?
                     ├─ yes -> schedule next follow-up
                     └─ no -> lifecycleStatus=UNRESPONSIVE, open intervention if policy says manual recovery
```

## Tree D: Reply Handling

```text
new inbound message
└─ AI confidence >= threshold?
   ├─ no -> intervention / needs human review
   └─ yes
      └─ reply classification
         ├─ address provided
         │  └─ address structurally valid?
         │     ├─ no -> draft address clarification
         │     └─ yes -> create confirmed snapshot, lifecycleStatus=ADDRESS_CAPTURED
         ├─ positive but no address -> draft address request
         ├─ decline -> mark creator declined for this campaign
         ├─ question / objection -> draft human-review answer
         └─ commercial exception -> open intervention immediately
```

## Tree E: Order and Delivery

```text
lifecycleStatus=ADDRESS_CAPTURED
└─ human confirms address?
   ├─ no -> remain in inbox / address review
   └─ yes
      └─ order already exists?
         ├─ yes -> no-op
         └─ no -> create Shopify order
            └─ order create success?
               ├─ no -> intervention
               └─ yes -> lifecycleStatus=ORDER_CREATED
                  └─ fulfillment arrives?
                     ├─ fulfilled -> lifecycleStatus=FULFILLED
                     ├─ delivered -> lifecycleStatus=DELIVERED
                     └─ failure/return -> intervention
```

## Tree F: Post-Delivery, Posting, and Non-Post Outcome

```text
lifecycleStatus=DELIVERED
└─ reminder already scheduled?
   ├─ yes -> wait
   └─ no -> create post-delivery reminder

mention arrives
└─ linked creator found?
   ├─ no -> orphan mention queue
   └─ yes
      └─ campaign match found?
         ├─ yes -> update post/history counts, suppress reminders, lifecycleStatus=POSTED
         └─ no -> save mention to creator history only

no mention by reminder window
└─ reminder limit reached?
   ├─ no -> send next reminder
   └─ yes -> lifecycleStatus=COMPLETED, postCount may remain 0
```

## Tree G: Consent and Opt-out

```text
creator clicks unsubscribe
└─ token valid?
   ├─ no -> show expired/invalid state
   └─ yes -> set optedOutAt
      └─ suppress:
         - initial outreach
         - follow-ups
         - reminders
      └─ preserve:
         - historical threads
         - past order/mention records
```

## Tree H: Intervention Triage

```text
failure or ambiguity occurs
└─ can it self-retry safely?
   ├─ yes -> retry within policy
   └─ no -> open intervention
      └─ type
         ├─ no email
         ├─ no reply
         ├─ address ambiguous
         ├─ order failure
         ├─ delivery exception
         ├─ mention capture failure
         └─ commercial exception
      └─ owner resolves?
         ├─ yes -> linked job/state resumes safely
         └─ no -> case remains open and visible
```

## 8. Permission Matrix

| Capability | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| manage billing and subscription | yes | yes | no | no |
| invite and remove team | yes | yes | no | no |
| connect providers | yes | yes | no | no |
| edit brand settings/templates/products | yes | yes | no | no |
| create campaigns | yes | yes | yes | no |
| approve/decline creators | yes | yes | yes | no |
| run creator search | yes | yes | yes | no |
| send inbox messages | yes | yes | yes | no |
| confirm address / retry order | yes | yes | yes | no |
| resolve interventions | yes | yes | yes | no |
| view reports/dashboard | yes | yes | yes | yes |

## 9. Future Feature Flags

Not in v1, but the UI should allow future activation without redesign:
- `ai_auto_approve_threshold`
- `ai_auto_decline_threshold`
- `ai_auto_send_drafts`
- `paid_deals_enabled`
- `usage_rights_enabled`
- `creator_portal_enabled`

Every automated action must remain visibly auditable in `ActivityLog`.

## 10. Playwright-Oriented Acceptance Flows

When implementation begins, these are the primary end-to-end UI flows to verify:

1. Self-serve onboarding from signup to first campaign.
2. Creator search -> approve -> appears in campaign queue.
3. Inbox thread receives reply -> address extracted -> human confirms -> order created.
4. Delivery event -> reminder scheduled -> mention ingested -> reminder suppressed.
5. Failed order or low-confidence reply -> intervention queue entry appears.
6. Creator unsubscribe -> future sends suppressed.
