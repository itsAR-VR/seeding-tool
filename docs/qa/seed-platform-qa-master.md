# Seed Scale Platform QA — Master Synthesis Draft

Date: 2026-03-10  
Status: Draft synthesis from repo evidence, screenshots, and existing reports  
Scope: platform operator flow, not marketing pages

## Executive summary

Seed Scale looks **structurally real and demoable**, but it is **not yet clean enough to call operator-ready** for a serious pilot QA signoff.

The core shell exists and major surfaces render: dashboard, campaigns, creators, review, draft outreach, inbox, connections, and health. There is enough evidence to say the product is beyond mockup territory.

The real problems are not “page won’t load” problems. They are **operator-trust problems**:
- placeholder / dirty test data leaking into live-looking flows
- workflow guardrails missing around products + integrations
- review queue semantics not matching UI copy or observed behavior
- weak bulk-review ergonomics for 30+ creators/drafts
- credential UX that feels unsafe and unfinished
- automated QA coverage that looks greener than it really is

## Release stance

**Recommendation: do not treat this as external-pilot-ready yet.**

Current state is strong enough for:
- internal demos
- directed QA/fix cycles
- founder/operator walkthroughs

Current state is **not** strong enough for:
- trustworthy external operator onboarding
- confident claims of clean review workflow
- confident claims of production-grade send/setup guardrails

## Evidence used

### Existing reports
- `E2E-SMOKE-TEST-REPORT.md`
- `docs/pf-us/context/2026-03-09-platform-truth.md`
- `apps/web/README.md`
- `playwright.config.ts`
- `apps/web/e2e/*.spec.ts`
- `test-results/.last-run.json`

### Screenshot set reviewed
- `e2e-screenshots/01-dashboard.png`
- `e2e-screenshots/02-campaigns-list.png`
- `e2e-screenshots/05-new-campaign-created.png`
- `e2e-screenshots/09-search-complete.png`
- `e2e-screenshots/10-review-queue-empty.png`
- `e2e-screenshots/12-sleepkalm-campaign-30-creators.png`
- `e2e-screenshots/13-draft-outreach-page.jpg`
- `e2e-screenshots/14-drafts-generated.jpg`
- `e2e-screenshots/15-10-drafts-full.jpg`
- `e2e-screenshots/16-inbox-with-thread.png`
- `e2e-screenshots/17-inbox.png`
- `e2e-screenshots/18-connections-not-connected.png`

## What clearly passes

1. **App shell is real and navigable**
   - Existing smoke report shows successful login, dashboard, campaigns, creators, connections, mentions, and health rendering.

2. **Campaign creation / discovery / outreach surfaces exist end-to-end**
   - Screenshot evidence shows campaigns, discover creators, review queue, draft outreach, and inbox all present.

3. **Health/admin surface exists**
   - Smoke report confirms health invariants surface correctly.

4. **Connections surface exists for the key providers**
   - Gmail, Shopify, Instagram, and Unipile cards are present.

## Severity summary

| Severity | Count | Headline |
|---|---:|---|
| Critical | 1 | Data integrity / placeholder data leakage in creator flows |
| High | 5 | Guardrails, queue truth mismatch, unsafe credential UX, weak draft-review workflow |
| Medium | 6 | Metrics clarity, empty-state dead ends, QA coverage illusion, poor explainability, scale ergonomics |
| Low | 3 | Dates, icon consistency, polish-level affordance gaps |

## Prioritized findings

### Critical

#### 1) Test / placeholder data is leaking into operator-facing flows
**Evidence**
- `e2e-screenshots/12-sleepkalm-campaign-30-creators.png`
- `e2e-screenshots/13-draft-outreach-page.jpg`
- `e2e-screenshots/14-drafts-generated.jpg`
- `e2e-screenshots/15-10-drafts-full.jpg`

**What’s wrong**
- Large blocks of creators show the exact same follower count: `1,500,000`.
- Some creators have incomplete data like missing handles / missing follower values.
- The same campaign mixes obviously fake/stub-like creator records with more realistic ones.

**Why it matters**
This destroys operator trust fast. A seeding platform lives or dies on whether the user believes the creator rows are real and coherent.

**Fast fix**
- scrub seeded placeholder values from any demo/live QA dataset
- visually flag incomplete creator rows as incomplete, not normal
- prevent outreach-ready status when creator identity fields are obviously partial

---

### High

#### 2) Review queue truth is inconsistent with both UI flow and product-truth docs
**Evidence**
- `e2e-screenshots/09-search-complete.png`
- `e2e-screenshots/10-review-queue-empty.png`
- `docs/pf-us/context/2026-03-09-platform-truth.md`

**What’s wrong**
- Discover flow reports creators added to queue.
- Review Queue screenshot shows empty state.
- Product-truth doc explicitly says current persistence logic auto-writes `CampaignCreator.reviewStatus` to `approved` / `declined` instead of a pure pending-review queue.

**Why it matters**
This is not just copy drift. It means the operator mental model is wrong. “Discover → review” is one of the core product loops.

**Fast fix**
- pick one truth: real pending review queue vs auto-approval lane
- align persistence logic, page counts, and UI copy in the same pass
- add explicit status totals: pending, approved by AI, declined by AI, human-reviewed

---

#### 3) Workflow guardrails are too weak around required setup
**Evidence**
- `e2e-screenshots/12-sleepkalm-campaign-30-creators.png`
- `e2e-screenshots/18-connections-not-connected.png`
- `e2e-screenshots/05-new-campaign-created.png`

**What’s wrong**
- Campaign shows 30 approved / ready creators while product section is still empty.
- Connections page shows Gmail, Shopify, Instagram, and Unipile all disconnected.
- Yet the operator can still get deep into creator/outreach workflow.

**Why it matters**
This creates dead-end work. The app lets the operator invest time in flow stages that are not actually actionable yet.

**Fast fix**
- add hard blockers or setup checklist before Draft Outreach / Send
- require product attached before creator outreach becomes enabled
- require relevant provider connection before send actions appear active

---

#### 4) Credential UX feels unsafe and unfinished
**Evidence**
- `e2e-screenshots/18-connections-not-connected.png`

**What’s wrong**
- Shopify and Unipile cards visibly expose raw token-entry fields.
- No visible test connection result, last verified timestamp, or safe masking treatment.

**Why it matters**
This will get side-eye immediately in any B2B workflow, even before a security review.

**Fast fix**
- mask secret/token fields
- add explicit test-connection feedback
- store and show connection state like: connected, failed validation, last checked

---

#### 5) Draft review workflow is too clumsy for operator scale
**Evidence**
- `e2e-screenshots/13-draft-outreach-page.jpg`
- `e2e-screenshots/14-drafts-generated.jpg`
- `e2e-screenshots/15-10-drafts-full.jpg`

**What’s wrong**
- 30 drafts appear as a giant stacked text wall.
- No clear inline edit affordance is visible.
- No obvious bulk approve / reject / send actions.
- Messages are overly long for outreach and likely require operator cleanup.

**Why it matters**
Even if the underlying generation is “working,” the operator burden is too high.

**Fast fix**
- collapse drafts into rows/cards with preview + expand
- add inline edit before send
- add bulk approve / reject / send
- enforce shorter default copy generation

---

#### 6) Search-result explainability is weak enough to feel broken
**Evidence**
- `e2e-screenshots/09-search-complete.png`
- `docs/pf-us/context/2026-03-09-platform-truth.md`

**What’s wrong**
- Broad search criteria produce only one analyzed result with minimal explanation.
- Product-truth doc confirms the current system is dataset-first + AI scoring, not broad live-web discovery.

**Why it matters**
Without context, the operator will assume search is failing rather than constrained.

**Fast fix**
- show why results were limited: dataset coverage, filters too tight, keyword miss, etc.
- surface source explanation directly in UI: “searching local Collabstr dataset”

---

### Medium

#### 7) Dashboard metrics and labels are not operator-clear
**Evidence**
- `e2e-screenshots/01-dashboard.png`
- `e2e-screenshots/12-sleepkalm-campaign-30-creators.png`

**What’s wrong**
- Stats like `Address` are ambiguous.
- Dashboard rollups imply odd math like creators across 0 active campaigns.
- Some subtitles read like internal shorthand, not operator language.

**Fast fix**
- rename ambiguous metrics
- add tooltips / helper copy
- reconcile dashboard rollups with campaign-level counts

---

#### 8) Empty states strand the operator instead of moving them forward
**Evidence**
- `e2e-screenshots/02-campaigns-list.png`
- `e2e-screenshots/10-review-queue-empty.png`
- `e2e-screenshots/17-inbox.png`

**What’s wrong**
- Sparse pages don’t offer the next obvious action.
- Review Queue empty state especially should route straight back to discovery/import.

**Fast fix**
- every empty state gets one primary CTA and one secondary CTA

---

#### 9) Platform QA automation is weaker than the green status suggests
**Evidence**
- `playwright.config.ts`
- `apps/web/e2e/campaigns.spec.ts`
- `apps/web/e2e/creators.spec.ts`
- `apps/web/e2e/inbox.spec.ts`
- `apps/web/e2e/onboarding.spec.ts`
- `apps/web/e2e/production-cutover.spec.ts`
- `test-results/.last-run.json`

**What’s wrong**
- Most platform E2E specs are skip-gated behind env vars and live auth requirements.
- Root Playwright config still defaults to `./tests`, which is mostly marketing/visual coverage.
- `.last-run.json` says passed, but that is not strong evidence that full platform flows were exercised.

**Why it matters**
This can create false confidence during release prep.

**Fast fix**
- add a seeded local auth/session fixture for platform tests
- ensure one real platform smoke project runs in CI or in the local QA loop by default
- emit which project/specs actually ran in QA artifacts

---

#### 10) Long-page scale ergonomics are not there yet
**Evidence**
- `e2e-screenshots/12-sleepkalm-campaign-30-creators.png`
- `e2e-screenshots/13-draft-outreach-page.jpg`
- `e2e-screenshots/15-10-drafts-full.jpg`

**What’s wrong**
- creator and outreach surfaces are already too tall at 30 items
- no visible pagination, virtualization, or compact review mode

**Fast fix**
- compact table mode
- pagination or row virtualization
- sticky review toolbar for bulk actions

---

#### 11) Multi-brand / workspace truth still looks risky
**Evidence**
- `docs/pf-us/context/2026-03-09-platform-truth.md`

**What’s wrong**
- Repo truth doc explicitly calls out first-brand assumptions in current route handling.

**Why it matters**
This becomes a nasty QA source of ghost behavior when testing separate brand/workspace contexts.

**Fast fix**
- either ship a real brand switcher
- or hard-scope test/demo environments to one brand until multi-brand routing is safe

---

#### 12) Campaign navigation and task hierarchy need cleanup
**Evidence**
- `e2e-screenshots/05-new-campaign-created.png`
- `E2E-SMOKE-TEST-REPORT.md`

**What’s wrong**
- Mentions route exists but smoke report notes it is not linked from campaign detail.
- Core actions on campaign detail have equal visual weight, so next-step hierarchy is unclear.

**Fast fix**
- add complete campaign subnav
- visibly mark recommended next action based on campaign state

---

### Low

#### 13) Dates and minor formatting still read like raw app output
**Evidence**
- multiple screenshots

**Fast fix**
- use human-readable localized dates consistently

#### 14) Icon / visual language is inconsistent
**Evidence**
- dashboard and empty states

**Fast fix**
- replace emoji-style placeholders with the app icon system

#### 15) Some CTA affordances read too lightly
**Evidence**
- campaigns list, connections page

**Fast fix**
- increase button clarity and active/disabled state treatment

## Fast fix plan

### Phase 1: trust repair
1. Remove / clearly flag dirty placeholder creator data.
2. Fix review-queue truth mismatch.
3. Add blockers for missing products + missing send integrations.

### Phase 2: operator workflow repair
4. Redesign Draft Outreach into compact, editable, bulk-review flow.
5. Add empty-state CTAs and clearer metric labels.
6. Add connection validation feedback and masked secret inputs.

### Phase 3: QA reliability repair
7. Make one real platform smoke suite runnable without manual ritual.
8. Emit proof of what actually ran in each QA pass.
9. Re-run localhost browser QA after fixes and replace screenshot set.

## Suggested acceptance bar for next QA pass

Do not call the next pass clean unless all of the following are true:
- no placeholder creator metrics remain in reviewed campaign data
- discover → review counts match exactly
- Draft Outreach supports inline edit + bulk actions
- send/setup blockers are explicit when products or integrations are missing
- connection secrets are masked and testable
- at least one non-skipped platform smoke flow runs and produces fresh evidence

## Open blockers / confidence limits

- This draft does **not** yet fold in fresh lane-1/2/3 written findings because none were present under `docs/qa/` at synthesis time.
- Some screenshot contradictions may come from different moments/campaigns, but they still indicate a trust problem and need live confirmation.
- This synthesis intentionally avoided fresh heavy browser traversal and is based on repo evidence plus screenshot review.

## Bottom line

The platform is real enough that the next fix cycle should be surgical, not existential.

But right now the product still has too many places where the operator can think, very reasonably, “wait, do I trust this thing?”

That is the QA target now: not more surface area, just fewer trust leaks.