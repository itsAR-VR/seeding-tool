# Phase 7c - Rebuild the homepage and replace the hero SVG

## Focus
Turn the homepage into the flagship route for the redesign, with a new hero, stronger pacing, and clearer conversion hierarchy. All work happens in `HomeContent.tsx` and `globals.css` — the shared shell from 7b is already in place.

## Inputs
- `docs/planning/phase-7/a/brief.md` (section order, hero concept, CTA rules, content survival map)
- `docs/planning/phase-7/b/plan.md` (component locations and token system)
- Files to modify:
  - `apps/web/app/components/HomeContent.tsx` (client component with all homepage content)
  - `apps/web/app/globals.css` (styles and animations)
- Files to reference (read-only):
  - `apps/web/app/components/Shell.tsx` (shared shell API)
  - `apps/web/app/components/CtaLink.tsx` (shared CTA API)
  - `apps/web/app/components/analytics.ts` (tracking API)
  - `apps/web/public/logos/` (9 brand logos — preserve all references)

## Work

### Step 1 — Replace homepage section structure
- Implement the approved section sequence from the 7a brief
- Remove repeated section-card patterns where they flatten the experience
- Each section should have a distinct visual grammar (not the same border-radius card repeated)

### Step 2 — Build the new hero SVG
- Create `apps/web/app/components/HeroScene.tsx` (`"use client"`):
  - Original inline SVG collage scene (creator-focused, not flowchart/dashboard)
  - Cap at 3-4 animation families (e.g., float, fade-in stagger, subtle parallax, pulse)
  - Total initial choreography budget: < 2 seconds
  - Accessible: `role="img"` with descriptive `aria-label`
  - Reduced-motion fallback: static composition with no animation
- Replace the current `HeroAnimation` function (currently inline in the page) with import from `HeroScene.tsx`
- Delete the old hero SVG code from `HomeContent.tsx`

### Step 3 — Simplify CTA hierarchy and replace banned copy
- One dominant action above the fold (primary CTA) — use humanized language from 7a brief (NOT "request teardown")
- One support CTA where it clarifies next steps (e.g., "See how it works")
- Remove per-section CTAs that add noise (e.g., "Map this phase" on each workflow row)
- All CTAs use the shared `CtaLink` component
- **VERIFY**: zero instances of "request teardown", "book a teardown", "workflow teardown", "map this phase" in `HomeContent.tsx`

### Step 4 — Introduce a concrete AI explanation section
- Show what the system actually does operationally
- Describe AI as: ranking, detection, prioritization, exception handling
- Avoid: "AI-powered", "intelligent automation", generic hype
- Keep it short — 3-4 concrete operational capabilities with tangible outcomes

### Step 5 — Rebuild proof and bridge sections
- Proof section should feel authored, not templated
- Bridge section should support the homepage-to-pricing handoff
- Consider whether comparison table stays, evolves, or is removed (per 7a brief decision)

### Step 6 — Implement real form submission
- Create `apps/web/app/actions/submit-form.ts` (Next.js Server Action):
  - Accepts form data: `name` (required), `email` (required), `brand` (optional), `teamSize` (optional)
  - Posts to `FORM_WEBHOOK_URL` env var via `fetch()`
  - Returns `{ success: boolean, error?: string }` to the client
  - If `FORM_WEBHOOK_URL` is not set: log to console, return success (dev/preview behavior)
  - Validate + sanitize all inputs server-side
- Replace the decorative `onSubmit` handler in `HomeContent.tsx` form with the Server Action
- Add form success/error UI states (success message, error message with retry)
- Add Calendly embed placeholder:
  - If `NEXT_PUBLIC_CALENDLY_URL` is set, show an embedded Calendly link/widget near the form
  - If not set, hide the Calendly section entirely (user will add URL later)

### Step 7 — Update homepage CSS
- Add new section styles to `globals.css`
- Update or remove old section styles that are no longer used
- Add hero animation keyframes (capped at 3-4 new animation families)
- Verify reduced-motion media query covers all new animations
- Keep existing pricing-related styles untouched (they'll be updated in 7d)

### Step 8 — Verify build
- Run `npm run web:build`
- Visually check `/` route in dev mode at desktop (1440px) and mobile (390px) viewports
- Confirm no console errors
- Confirm reduced-motion behavior (animations suppressed)
- Confirm form submission works (or gracefully degrades without `FORM_WEBHOOK_URL`)

## Skills to invoke during this subphase
- `frontend-design` — distinctive homepage UI
- `impeccable:animate` — purposeful hero motion
- `impeccable:bolder` — push beyond safe/boring
- `hormozi-hooks` — hero headline hooks
- `copywriting` — section headlines and body
- `landing-page-architecture` — section pacing and hierarchy

## Output
- New files:
  - `apps/web/app/components/HeroScene.tsx`
  - `apps/web/app/actions/submit-form.ts`
- Modified files:
  - `apps/web/app/components/HomeContent.tsx` (rebuilt section structure, imports HeroScene, real form)
  - `apps/web/app/globals.css` (new homepage styles, new hero animations, removed obsolete styles)
- Homepage renders with new visual system, new hero, simplified CTA hierarchy, real form
- Build passes
- Zero banned CTA phrases in homepage copy

### Execution Result - 2026-03-05
- Created `apps/web/app/components/HeroScene.tsx`, `apps/web/app/components/LeadForm.tsx`, and `apps/web/app/actions/submit-form.ts`.
- Rebuilt `HomeContent.tsx` around the new section sequence from the brief: hero, proof rail, pain strip, workflow story, AI section, evidence wall, pricing bridge, and real lead capture.
- Removed the old inline flowchart hero and all banned CTA language from the homepage implementation.
- Verified the homepage with `npm run web:build` and browser screenshots after the rewrite.

## Coordination Notes

**Integrated from Phase 7a brief:** hero-motion constraints, CTA replacements, AI-copy posture, and real form requirements.
**Files affected:** `apps/web/app/components/HomeContent.tsx`, `apps/web/app/components/HeroScene.tsx`, `apps/web/app/components/LeadForm.tsx`, `apps/web/app/actions/submit-form.ts`, `apps/web/app/globals.css`
**Potential conflicts with:** upcoming pricing rewrite in `PricingContent.tsx` and any uncommitted CSS work elsewhere in `apps/web`
**Integration notes:** left pricing content untouched in this subphase but updated shared shell visuals so the homepage and pricing will continue to share the same structural frame.

## Handoff
Phase 7d reuses the shared shell and new token system to rebuild pricing as a different, later-stage decision experience. 7d should not reopen homepage design decisions but should ensure pricing has its own visual personality within the shared system.

## Validation (RED TEAM)
- `npm run web:build` passes
- `apps/web/app/components/HeroScene.tsx` exists and is imported by `HomeContent.tsx`
- `apps/web/app/actions/submit-form.ts` exists and is used by the form
- Old `HeroAnimation` function no longer exists inline
- Homepage has no more than 2 CTA buttons above the fold
- All new `@keyframes` in globals.css are covered by the `prefers-reduced-motion` media query
- Logo references in `HomeContent.tsx` match files in `apps/web/public/logos/`
- Zero instances of "request teardown", "book a teardown", "workflow teardown", "map this phase" in `HomeContent.tsx`
- Form submits data (or gracefully degrades without `FORM_WEBHOOK_URL`)
