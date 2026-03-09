# Phase 11 — Landing Page Animation Layer: GSAP + SVG Workflow Visualizations

## Original User Request (verbatim)

Replace static card sections with animated GSAP + SVG workflow visualizations.
Transform these sections:
  1. Pain Cards Section → `PainChaosAnimation.tsx`
  2. Workflow Story Section → `WorkflowPipelineAnimation.tsx` with ScrollTrigger pin/scrub
  3. AI Capabilities Section → `AINetworkAnimation.tsx`
  4. Evidence Cards Section → `EvidenceRevealAnimation.tsx`
Proposed structure:
  apps/web/app/(marketing)/components/animations/
    - PainChaosAnimation.tsx
    - WorkflowPipelineAnimation.tsx
    - AINetworkAnimation.tsx
    - EvidenceRevealAnimation.tsx
  plus updates to `HomeContent.tsx` and `globals.css`
Dependencies:
  - `gsap`
  - `@gsap/react`
Must support reduced motion, responsive behavior, and meaningful animation storytelling rather than generic fade-slide-up reveals.

## Purpose

Replace the four static card sections of the Seeding OS marketing homepage with GSAP-driven SVG workflow visualizations that tell the product story through motion — not just fade-slide-up reveals. Each animation must be narratively meaningful, accessible (reduced motion), and responsive.

## Context

- **Repo:** `/home/podhi/.openclaw/workspace/seeding-tool`
- **Target file:** `apps/web/app/(marketing)/components/HomeContent.tsx` — the marketing homepage component
- **Stack:** Next.js 16, Tailwind v4, `"use client"` component, currently uses CSS IntersectionObserver-based `data-reveal` reveals
- **Existing CSS:** `globals.css` at `apps/web/app/globals.css` (2469 lines) — already has `.pain-strip`, `.workflow-story`, `.intelligence-section`, `.evidence-wall` sections with CSS-only animations
- **Dev server:** Running at `http://localhost:3000` — must verify all changes here, NOT Vercel
- **Browser verify:** All verification via `localhost:3000` screenshots before declaring completion
- **GSAP not yet installed** — `gsap` and `@gsap/react` must be added to `apps/web/package.json`
- **GitHub:** `mmoahid/seeding-tool` — switch to `gh auth switch --user mmoahid` before push

### Existing Section Mapping

| Section | CSS class | HomeContent.tsx element | Transform target |
|---|---|---|---|
| Pain Cards | `.pain-strip` / `.pain-grid` / `.pain-card` | `<section className="pain-strip">` | `PainChaosAnimation.tsx` |
| Workflow Story | `.workflow-story` / `.story-rail` / `.story-card` | `<section className="workflow-story">` | `WorkflowPipelineAnimation.tsx` |
| AI Capabilities | `.intelligence-section` / `.intelligence-grid` | `<section className="intelligence-section">` | `AINetworkAnimation.tsx` |
| Evidence Cards | `.evidence-wall` / `.evidence-grid` / `.evidence-card` | `<section className="evidence-wall">` | `EvidenceRevealAnimation.tsx` |

### Animation Storytelling Intent

- **PainChaosAnimation:** Visualizes the "chaos before Seeding OS" — scattered creator cards, overlapping spreadsheet rows, chaotic emoji storm. On scroll, chaos resolves into order.
- **WorkflowPipelineAnimation:** Pinned scroll section showing the Find → Reach → Collect pipeline. Each scroll step advances the pipeline animation (creator card flows in → outreach fires → post appears).
- **AINetworkAnimation:** Neural-net-style SVG showing AI nodes processing creator data. Pulsing signals flow through the network on scroll entry.
- **EvidenceRevealAnimation:** Quote cards that physically "build" — typewriter-style text, then author metadata populates, staggered with a subtle fade-in of a background proof card.

## Skills Available for Implementation

**Local skills (confirmed available):**
- `frontend-design` — aesthetic + layout direction
- `impeccable-animate` — GSAP animation patterns and timing
- `impeccable-bolder` — typography/visual boldness improvements
- `landing-page-architecture` — section structure and hierarchy
- `page-cro` — CRO-aware section design
- `karpathy-guidelines` — minimal surgical changes, verify before/after

**Global (find-skills):**
- `coding-agent` — implementation via Claude Code / Codex

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|---|---|---|---|
| phase-10 | Complete | Platform features (separate) | None — no overlap |
| phase-landing-redesign | Stale/partial | Same marketing component files | Phase 11 extends the redesign direction. Preserves existing CSS classes, only adds animation layer on top. |

## Objectives

* [ ] Install `gsap` and `@gsap/react` into `apps/web/package.json`
* [ ] Create `apps/web/app/(marketing)/components/animations/` directory with 4 animation components
* [ ] Implement `PainChaosAnimation.tsx` — chaos → order SVG narrative
* [ ] Implement `WorkflowPipelineAnimation.tsx` — ScrollTrigger pin/scrub pipeline
* [ ] Implement `AINetworkAnimation.tsx` — network pulse on scroll entry
* [ ] Implement `EvidenceRevealAnimation.tsx` — typewriter + stagger quote reveal
* [ ] Update `HomeContent.tsx` to import and use all 4 animation components
* [ ] Add animation CSS to `globals.css` (GSAP-specific overrides, reduced motion fallbacks)
* [ ] Browser verification at `localhost:3000` — screenshot all 4 sections
* [ ] Confirm reduced motion fallback works (CSS `prefers-reduced-motion: reduce`)

## Constraints

1. **No SSR breakage** — all GSAP calls must be inside `useEffect` or wrapped with `useGSAP` from `@gsap/react`
2. **Reduced motion:** Wrap all GSAP timelines in `if (!reducedMotion)` — static fallback must match current CSS-only state
3. **Responsive:** All SVG viewBox-based, scale via CSS width: 100% / max-width
4. **Preserve existing CSS:** Do not remove `.pain-strip`, `.workflow-story`, `.intelligence-section`, `.evidence-wall` classes — animations extend, not replace them
5. **Keep section text content:** `frictionCards`, `storySteps`, `aiCapabilities`, `evidenceCards` data arrays stay in `HomeContent.tsx`; animation components render alongside or replace the grid, not the section heading/copy
6. **WorkflowPipelineAnimation only** gets ScrollTrigger pin/scrub — other sections use IntersectionObserver-triggered GSAP timelines (simpler, no Lenis conflict)
7. **No Lenis** for this phase — dev server doesn't have Lenis installed; ScrollTrigger native scroller

## Success Criteria

- [ ] `localhost:3000` screenshot shows all 4 animated sections render without blank white box
- [ ] Each section has visible, meaningful SVG animation (not just fade-slide)
- [ ] WorkflowPipelineAnimation scrubs correctly on scroll (pin + progress)
- [ ] No TypeScript build errors (`pnpm build` clean or `pnpm lint` clean)
- [ ] Reduced motion: setting `prefers-reduced-motion: reduce` in DevTools shows static fallback for all sections
- [ ] Mobile (375px): no horizontal overflow, SVGs scale correctly

## Subphase Index

* a — GSAP install + animations directory scaffold
* b — PainChaosAnimation + AINetworkAnimation (scroll-entry triggered)
* c — WorkflowPipelineAnimation (ScrollTrigger pin/scrub)
* d — EvidenceRevealAnimation + HomeContent.tsx wiring + browser verification

## RED TEAM Findings (Gaps / Weak Spots)

See phase-gaps pass below (added after initial plan creation).

## Phase Summary (running)

- 2026-03-09 — Phase 11 plan created. GSAP install + 4 animation components + HomeContent wiring planned.
