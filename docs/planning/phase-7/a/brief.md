# Phase 7a Brief - Marketing redesign decisions

## Route roles

### Homepage
- Job: stop the visitor, make the product feel inevitable, explain what changes operationally, and move the right people toward a live conversation or pricing.
- Tone: controlled, kinetic, premium, and specific.
- Primary action: `Book a live walkthrough`
- Secondary action: `See how the system runs`

### Pricing
- Job: help a qualified visitor choose a path, reduce rollout anxiety, and commit.
- Tone: shorter, more concrete, more comparative, less theatrical than the homepage.
- Primary action: `Talk through my rollout`
- Secondary action: `Compare the paths`

## Section order and content map

### Homepage
1. Hero
   - Keep: core seeding-OS positioning and one supporting CTA.
   - Rewrite: headline, subhead, CTA copy, micro-proof, and hero visual.
   - Remove: trust chips and any copy that sounds like a generic audit pitch.
2. Proof rail
   - Keep: brand logos.
   - Rewrite: introduce a concise proof line and one compact outcome strip.
3. Friction strip
   - Keep: the idea that manual seeding breaks in predictable ways.
   - Rewrite: make it shorter and sharper.
   - Remove: numbered card treatment.
4. Operational narrative
   - Replace `workflowRows` with a paced narrative rail:
     - Find the right creators
     - Run outreach and capture details
     - Track product, posts, and misses
   - Remove all per-step CTAs.
5. AI section
   - New section focused on what the system actually does:
     - scores candidates
     - drafts or classifies replies
     - flags missing details
     - detects mentions and exceptions
6. Evidence wall
   - Keep: testimonial and proof intent.
   - Rewrite: use fewer, more specific proof blocks with one comparison angle.
   - Remove: dense comparison table unless it becomes a tighter proof module.
7. Pricing bridge
   - Keep: pricing signal and next-step framing.
   - Rewrite: hand off to `/pricing` with one clear reason to continue.
8. Final form and scheduling block
   - Keep: lead capture.
   - Rewrite: real form, better CTA language, optional Calendly link or embed.
   - Remove: decorative-only form behavior.

### Pricing
1. Decision hero
   - Keep: three-tier structure.
   - Rewrite: hero copy and CTA language.
2. Plan comparison
   - Keep: Starter, Growth, Enterprise.
   - Rewrite: add fit language and clearer plan separation.
3. Fit matrix
   - New section showing who each plan is for, not just what it includes.
4. Launch timeline
   - Keep: staged rollout idea.
   - Rewrite: make it calmer and more concrete.
5. Implementation proof strip
   - New short section focused on launch confidence, not homepage-style social proof.
6. Pricing FAQ
   - Keep: plan-specific objections only.
   - Remove: homepage objections and repeated trust language.
7. Form and scheduling block
   - Reuse the real form and optional Calendly link/embed.

## CTA hierarchy and replacements

### Rules
- One primary CTA per section.
- No more than two CTAs above the fold.
- No CTA inside explanatory rows, cards, or timelines.
- The global nav CTA and mobile sticky CTA should match the page's primary action.
- Ban these strings everywhere:
  - `request teardown`
  - `book a teardown`
  - `workflow teardown`
  - `map this phase`
  - `AI-powered`
  - `intelligent automation`

### Approved CTA copy options
- `Book a live walkthrough`
- `See how the system runs`
- `Talk through my rollout`
- `Show me the workflow`
- `See the pricing path`

## Narrative posture
- Top-line frame: this is a seeding operating system, not another generic influencer database.
- AI must be explained as operational leverage, not mystique.
- Copy should sound like a sharp operator talking to another operator.
- Prefer short sentences, plain verbs, concrete outcomes, and mild edge over polished corporate language.
- Avoid rule-of-three puffery, vague claims, and generic “optimize/streamline/innovate” vocabulary.

## Hero concept
- Composition: a collage of creator tiles, shipment and inbox cues, post-confirmation states, and one central orchestration surface.
- Emotional target: "this looks like the control room behind a messy process."
- Allowed motifs:
  - cropped creator frames
  - message fragments
  - package and post markers
  - signal trails and scoring pulses
  - one central orchestration panel
- Allowed motion families:
  - slow drift/parallax
  - directional trace movement
  - small state flips or pulses
  - staggered entrance choreography
- Motion budget:
  - 3-4 animation families max
  - initial choreography under 2 seconds
- Reduced-motion fallback:
  - static composition
  - no opacity-hidden content waiting on animation
- Banned motifs:
  - flowchart arrows
  - mini dashboard bar charts
  - dashed connector paths
  - glassmorphism-heavy cards
  - generic gradient-orb decoration

## Component extraction plan
- `apps/web/app/components/analytics.ts`
  - shared event tracking
  - shared booking and Calendly env lookup
- `apps/web/app/components/CtaLink.tsx`
  - shared CTA anchor with tracking
- `apps/web/app/components/MobileCta.tsx`
  - shared mobile sticky CTA with page-specific copy
- `apps/web/app/components/Shell.tsx`
  - skip link, background treatment, nav, footer, mobile CTA slot
- `apps/web/app/components/LeadForm.tsx`
  - shared client form for homepage and pricing
- `apps/web/app/components/FaqList.tsx`
  - shared FAQ primitive
- `apps/web/app/components/HomeContent.tsx`
  - homepage client content
- `apps/web/app/components/PricingContent.tsx`
  - pricing client content
- `apps/web/app/components/HeroScene.tsx`
  - homepage SVG scene

## Metadata architecture
- `apps/web/app/page.tsx`
  - server component wrapper
  - exports homepage-specific metadata
  - renders `<HomeContent />`
- `apps/web/app/pricing/page.tsx`
  - server component wrapper
  - exports pricing-specific metadata
  - renders `<PricingContent />`
- `apps/web/app/layout.tsx`
  - keeps root fonts and metadata base
  - no longer owns the final page title/description for both routes
- Metadata defaults:
  - Homepage title: `Seeding OS | Run Seeding Like a System`
  - Pricing title: `Pricing | Seeding OS`
  - Both routes get explicit description and Open Graph title/description
  - OG image can stay unset in this phase if no final asset is produced

## Typography and color
- Typography stays on Manrope for body and Space Grotesk for display.
- Refine scale and weight rather than changing families.
- Keep the warm parchment base.
- Tighten the accent system:
  - one deep primary blue
  - one rust/coral accent
  - one green signal accent
- Remove the split personality between paper editorial surfaces and frosted dashboard chrome.

## Form and scheduling strategy
- Implement a real Server Action at `apps/web/app/actions/submit-form.ts`.
- Fields:
  - name
  - email
  - brand or website
  - optional team or campaign volume field depending on route
- Submission target:
  - `FORM_WEBHOOK_URL`
- Graceful degradation:
  - if the env var is missing, log in development and return a success state so the UI still works in preview
- Scheduling:
  - `NEXT_PUBLIC_CALENDLY_URL` enables a secondary scheduling module or styled link
  - if missing, hide the scheduling block entirely

## Skill takeaways applied
- `landing-page-architecture`: each section has one job and the pages now have distinct route roles.
- `page-cro`: homepage prioritizes clarity and proof; pricing reduces plan-choice anxiety.
- `copywriting`: CTA copy is value-led instead of generic.
- `hormozi-hooks`: hero and CTA language should call out the operator pain directly.
- `hormozi-offers` and `hormozi-value-equation`: pricing and proof should raise perceived certainty and lower rollout anxiety.
- `impeccable-critique`: avoid AI-slop patterns, repeated cards, and generic SaaS hero tropes.

## Coordination notes
- This brief merges the concurrent expansion of `phase-7` now present in the repo with the original `phase-7` root plan created in this session.
- The concurrent plan added stricter form, CTA, and metadata requirements; this brief adopts them as the active execution contract for subphases `b` through `e`.
