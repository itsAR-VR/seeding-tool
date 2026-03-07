# Phase 7d - Rebuild pricing as a later-stage decision page

## Focus
Make pricing feel like the second stage of the funnel: shorter, more concrete, more comparative, and more commitment-oriented than the homepage. All work happens in `PricingContent.tsx` and `globals.css`.

## Inputs
- `docs/planning/phase-7/a/brief.md` (section order, pricing role, CTA rules)
- `docs/planning/phase-7/b/plan.md` (component locations, tokens, Shell API)
- `docs/planning/phase-7/c/plan.md` (homepage implementation — reference for visual consistency)
- Files to modify:
  - `apps/web/app/components/PricingContent.tsx` (client component with all pricing content)
  - `apps/web/app/globals.css` (pricing-specific styles)
- Files to reference (read-only):
  - `apps/web/app/components/Shell.tsx`, `CtaLink.tsx`, `analytics.ts`
  - `apps/web/app/components/HomeContent.tsx` (for visual consistency reference)
  - `apps/web/app/actions/submit-form.ts` (Server Action — reuse for pricing form)

## Work

### Step 1 — Redesign pricing hero
- Shorter and more decision-focused than the homepage hero
- No animated SVG scene — pricing hero should be text-forward with clear value framing
- Communicate: "You've seen the system. Now pick the path that fits."

### Step 2 — Rebuild plan comparison
- Replace the current repeated card-stack feel with clearer plan comparison
- Each tier card should communicate: who it's for, what's included, what makes it different, and the action to take
- Add fit guidance ("Best for teams doing X") rather than just feature lists
- Consider a comparison table or feature grid if 7a brief specifies one

### Step 3 — Separate pricing sections
- Proof strip (short, different from homepage proof — focused on implementation success)
- Rollout/onboarding strip (reduce implementation anxiety)
- FAQ (pricing-specific questions only, not duplicating homepage FAQ)
- Final conversion surface with real form (reuse Server Action from `apps/web/app/actions/submit-form.ts`)
- Add Calendly embed placeholder (same pattern as homepage — visible when `NEXT_PUBLIC_CALENDLY_URL` is set)
- **VERIFY**: zero instances of "request teardown", "book a teardown" in pricing copy. Use humanized CTA language from 7a brief

### Step 4 — Tune mobile behavior independently
- Pricing cards must stack cleanly on mobile with readable content
- Sticky CTA must not cover pricing card content or tier details
- Form section must be reachable and usable on mobile

### Step 5 — Update pricing CSS
- Add new pricing-specific styles to `globals.css`
- Remove or update old `.pricing-*`, `.tier-card`, `.rollout-strip`, `.compare-strip` styles as needed
- Verify pricing styles don't accidentally affect homepage sections (use specific selectors)
- Ensure reduced-motion media query covers any new transitions

### Step 6 — Verify build and both routes
- Run `npm run web:build`
- Check `/pricing` in dev mode at desktop (1440px) and mobile (390px)
- Also re-check `/` to confirm no regressions from shared CSS changes
- Confirm no console errors on either route

## Skills to invoke during this subphase
- `hormozi-offers` — Grand Slam Offer for tier framing
- `hormozi-pricing` — price presentation and anchoring
- `form-cro` — optimize the embedded form
- `page-cro` — pricing page conversion optimization
- `impeccable:clarify` — clear tier descriptions and UX copy

## Output
- Modified files:
  - `apps/web/app/components/PricingContent.tsx` (rebuilt pricing page with real form)
  - `apps/web/app/globals.css` (pricing styles updated)
- Pricing page renders as a distinct later-stage decision page
- Both `/` and `/pricing` build and render without regressions
- Zero banned CTA phrases in pricing copy
- Form uses shared Server Action from 7c

### Execution Result - 2026-03-05
- Rebuilt `PricingContent.tsx` into a shorter decision page with a text-forward hero, plan comparison, fit guidance, rollout timeline, implementation proof, focused FAQ, and shared real lead form.
- Reused the shared `LeadForm` and `submitLead` Server Action from 7c.
- Adjusted the shared shell so the mobile sticky CTA appears only after the user scrolls past the first viewport, which removed the early overlap on mobile pricing.
- Verified both routes again with `npm run web:build` and live browser screenshots after the pricing rewrite.

## Coordination Notes

**Integrated from Phase 7a brief:** pricing role as a later-stage decision page, shared CTA language, and real-form reuse.
**Files affected:** `apps/web/app/components/PricingContent.tsx`, `apps/web/app/components/Shell.tsx`, `apps/web/app/globals.css`
**Potential conflicts with:** final polish and Playwright assertions in 7e
**Integration notes:** pricing now uses the same structural shell as home but distinct content blocks and a separate decision-focused hero, so 7e can test both pages as different funnel stages rather than duplicate stacks.

## Handoff
Phase 7e applies the final copy-humanization pass across both routes, polishes interactions, and runs the Playwright QA gates to produce evidence of visual and behavioral stability.

## Validation (RED TEAM)
- `npm run web:build` passes
- `/pricing` has a visually distinct hero from `/` (no animated SVG hero on pricing)
- Pricing tier cards display correctly in a 3-column grid on desktop and single-column on mobile
- Pricing form uses the shared Server Action from `apps/web/app/actions/submit-form.ts`
- No pricing-specific CSS selectors match homepage elements (check for overly broad selectors)
- Homepage (`/`) is visually unchanged after pricing CSS updates
- Zero instances of "request teardown", "book a teardown" in `PricingContent.tsx`

## Resolved Decisions
- Pricing keeps 3 tiers (Starter, Growth, Enterprise) — confirmed.
- Pricing form is REAL (uses Server Action) — not decorative. Locked by user decision.
