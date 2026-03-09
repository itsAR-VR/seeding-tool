# Phase Plan — aha.inc Landing Page Redesign

## Original User Request (verbatim)

> Design direction from AGENTS.md — canonical spec for this phase (committed 2026-03-09):
>
> **Aesthetic Direction**
> Light mode first. Warm neutral base, restrained accent color, and very selective motion.
> The interface should feel more like an operator's briefing surface than a startup marketing
> collage. References should be taken from premium editorial SaaS pages, not toy-like product
> diagrams. Anti-references: generic flowchart heroes, too many pills and badges, intrusive
> sticky CTAs, and motion that reads as decoration instead of signal.
>
> **Design Principles**
> 1. Relevance beats cleverness in the first viewport.
> 2. One dominant action at a time; everything else supports it.
> 3. Motion must clarify state or pacing, never just fill space.
> 4. Fewer, stronger visual ideas beat many small decorative ones.
> 5. Mobile should feel calmer than desktop, not more crowded.

> **⚠️ SPEC CONFLICT (surfaced by RED TEAM 2026-03-09):**
> The Design Direction section below (frosted glass, dark navy) was the original V1 brief
> and has been superseded by AGENTS.md. The canonical direction is LIGHT MODE with warm
> neutral base as above. The hero-media-dock implementation on `feature/hero-media-dock`
> correctly follows AGENTS.md, not the V1 dark brief below. See `red-team.md` for full analysis.

> **Owner:** AR (assigned via Podhi, 2026-03-02)
> **Status:** In Progress
> **Reference:** Phase 1 audit baseline (seeding-tool Playwright harness), Phase 6 soak/QA
> **Stack:** Next.js + Tailwind v4, GSAP, Lenis smooth scroll
> **Design direction:** Frosted glass, dark refined, Z2A-inspired motion

---

## Current State (from Phase 1 audit + live fetch)

**Site:** aha.inc — "Your 24/7 AI Employee for Influencer Marketing"
**Stack confirmed:** Next.js/Tailwind v4.1.4, fonts: Geist, Inter, Plus Jakarta Sans, Poppins, DM Sans (5+ fonts = problem)
**Content structure:**
1. Hero — headline + stats (5M+ creators, 140+ countries)
2. Feature grid — AI matching, invitations, pricing, contracts, monitoring, payments, analytics
3. Social proof — "leading AI-native teams"
4. Guarantee section — escrow, contracts, verified traffic

**Design problems identified:**
- Font sprawl (5+ typefaces = visual noise, slow load)
- Feature sections feel like a bulleted product spec, not a story
- No clear visual hierarchy between primary + secondary features
- Animations minimal/absent (only a header fade-in keyframe noted)
- Card structure is generic — icon + heading + bullets (AI slop pattern)
- No cohesive dark/glass aesthetic — likely light mode with flat sections
- Section pacing is flat — no rhythm, no visual breath

---

## Design Direction

**Tone:** Dark, refined, high-trust. Not cyberpunk. Quiet luxury meets AI precision.

**Concept:** The platform runs 24/7 in the background so you don't have to. Design should feel like watching a well-oiled machine from a control room: dark background, frosted glass panels surfacing data, subtle motion that implies things are always in motion.

**Palette:**
- Background: deep navy `oklch(10% 0.03 260)` — near-black with a blue undertone
- Glass panels: `oklch(18% 0.04 260 / 0.6)` + `backdrop-filter: blur(20px)` + subtle border `1px solid oklch(100% 0 0 / 0.08)`
- Accent: cool electric blue `oklch(65% 0.22 255)` — used sparingly for CTAs and active states
- Text: `oklch(92% 0.01 260)` (off-white, warm-tinted)
- Secondary text: `oklch(65% 0.02 260)`

**Typography (cut from 5 to 2):**
- Display: Plus Jakarta Sans (600–800 weight) — kept from current stack, strong geometric presence
- Body: Inter — reliable, clean, web-native (already loaded)
- All other fonts: removed

**Glass effect spec:**
```css
.glass-panel {
  background: oklch(18% 0.04 260 / 0.55);
  backdrop-filter: blur(20px) saturate(120%);
  -webkit-backdrop-filter: blur(20px) saturate(120%);
  border: 1px solid oklch(100% 0 0 / 0.08);
  border-radius: 16px;
}
```

**Motion philosophy:**
- One orchestrated hero entrance (staggered: nav → headline → subhead → stats → CTA)
- Scroll-driven reveals: elements slide up + fade in as they enter viewport (IntersectionObserver or GSAP ScrollTrigger)
- Feature cards: stagger on section entry, 80ms between each card
- Hover: cards lift slightly (`transform: translateY(-4px)`) with a faint glow border brightening
- Background: slow-moving gradient mesh (CSS only, `@keyframes mesh-shift`) — no canvas, no GPU kill
- No bounce, no elastic — `ease-out-quart` throughout
- Respect `prefers-reduced-motion`

---

## Phase 1 — Audit Baseline Capture

**Status:** Available via seeding-tool harness (already built in Phase 4)

Tasks:
- [ ] Run `npm run audit:marketing` against aha.inc to capture current screenshots at desktop/tablet/mobile
- [ ] Extract current design tokens (`tokens.json`, `animations.json`)
- [ ] Screenshot all sections at full-page desktop (1440px) and mobile (390px)
- [ ] Document current Lighthouse scores (performance, CLS, LCP)

Artifacts: `artifacts/<run-id>/marketing/` + `docs/audit/pages/marketing/`

**Key Phase 1 learnings to carry forward:**
- Tailwind v4 is already configured — no migration needed
- Font loading: use `next/font` with `display: swap`, remove unused families from `_document`
- Existing animations are CSS-only keyframes — compatible with GSAP augmentation
- SPA routing via Next.js — scroll behavior needs Lenis integration at layout level

---

## Phase 2 — Design Token + Component Spec

Tasks:
- [ ] Define full design token set (colors, spacing, radius, shadow, blur, typography scale)
- [ ] Map current Tailwind config to new palette (override in `tailwind.config.ts`)
- [ ] Specify glass panel variants: `glass-sm`, `glass-md`, `glass-feature`, `glass-hero`
- [ ] Define animation token set: durations, easings, delays
- [ ] Define responsive breakpoints for glass degradation (mobile: reduce blur, simplify panels)
- [ ] Write component inventory: Navbar, HeroSection, StatBar, FeatureCard, FeatureSection, SocialProofReel, GuaranteeCard, Footer

Deliverable: `docs/planning/phase-landing-redesign/design-tokens.md` + updated `tailwind.config.ts`

---

## Phase 3 — Structural Rebuild

**Section order (improved narrative arc):**

```
Navbar (sticky, glassmorphic on scroll)
↓
Hero (headline + sub + CTA + animated stat counters)
↓
Problem Statement (compact, text-heavy, sets up the "old way vs new way")
↓
How It Works (horizontal process steps — 3 user steps, with Aha's work revealed on hover/scroll)
↓
Feature Depth (3 primary features, full-width alternating layout, glass cards)
↓
Feature Grid (6 secondary features, glass card grid, stagger reveal)
↓
Social Proof (logo reel + 2-3 case study cards)
↓
Guarantee Section (3 glass cards: escrow / contract / verified traffic)
↓
CTA Section (full-width, dark, with background glow)
↓
Footer
```

Tasks per section:
- [ ] **Navbar:** glass-on-scroll (transparent → glass on scroll), logo left, nav center, CTA button right
- [ ] **Hero:** full viewport height, animated gradient mesh background, staggered text entrance via GSAP timeline, stat counters (count-up on enter)
- [ ] **Problem statement:** two-column, "Before Aha / After Aha" with timeline visualization
- [ ] **How it works:** horizontal scroll snap on mobile, numbered step cards with glass style
- [ ] **Feature depth (3 primary):** alternating image/text layout, glass info panels, GSAP scroll-triggered reveals
- [ ] **Feature grid (6 secondary):** `grid-cols-2 lg:grid-cols-3`, glass cards, icon → heading → 2-line description only
- [ ] **Social proof:** auto-scrolling logo reel (CSS marquee), 2 quote cards in glass style
- [ ] **Guarantee:** 3-card row, each card is glass with colored accent border-top (blue / emerald / amber)
- [ ] **CTA:** radial glow centered, large headline, two buttons (primary + secondary)
- [ ] **Footer:** dark, minimal, logo + links + legal

---

## Phase 4 — Animation Layer

**Library choice:** GSAP (CDN or npm) + ScrollTrigger plugin

Tasks:
- [ ] Install GSAP: `npm install gsap` + configure SSR-safe import (`useEffect` / dynamic import)
- [ ] Implement Lenis smooth scroll at `_app.tsx` / layout level
- [ ] Hero entrance: GSAP timeline, `fromTo` on nav, h1, p, stats, CTA — staggered 80ms, `ease: 'power3.out'`, duration 0.9s
- [ ] ScrollTrigger reveals: `gsap.from(el, { y: 40, opacity: 0, duration: 0.6, ease: 'power2.out' })` per section entry
- [ ] Feature card stagger: `gsap.from('.feature-card', { y: 30, opacity: 0, stagger: 0.08 })` on section enter
- [ ] Stat counter animation: `gsap.to()` counting from 0 to target number on hero enter
- [ ] Background mesh: pure CSS `@keyframes` — no JS, no GPU kill
- [ ] Navbar glass: CSS transition on `backdrop-filter` + `background-color` triggered by scroll class toggle
- [ ] Card hover: CSS only (`transform: translateY(-4px)`, `transition: 0.2s ease-out`) — no GSAP needed for hover
- [ ] Reduced motion: wrap all GSAP inits in `if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)`

---

## Phase 5 — Visual Polish + Frosted Glass

Tasks:
- [ ] Apply `glass-panel` class consistently across all card components
- [ ] Verify backdrop-filter renders in Safari (test with `-webkit-backdrop-filter` fallback)
- [ ] Add subtle grain texture overlay via SVG filter (1-2% opacity — adds depth without weight)
- [ ] Implement section dividers as gradient fades, not hard lines
- [ ] Hero background: layered — base color + radial gradient orb (top-left, electric blue, low opacity) + mesh animation
- [ ] Typography pass: verify all sizes are fluid (`clamp()`), check line-height + letter-spacing for display text
- [ ] Dark mode is the default — no light mode toggle needed
- [ ] Add `loading="lazy"` + `decoding="async"` to all images
- [ ] Check contrast ratios on glass panels (text must meet WCAG AA against blurred background)

---

## Phase 6 — Soak + QA (Verification Gate)

**This is the hard close gate. Nothing ships without Phase 6 passing.**

Tasks:
- [ ] Run `npm run audit:marketing` post-rebuild → compare before/after screenshots
- [ ] Run Playwright smoke tests: nav renders, hero visible, all 10 sections present, CTA links work
- [ ] Mobile check: 390px viewport — glass degrades gracefully, no overflow, touch targets ≥48px
- [ ] Lighthouse audit: target LCP <2.5s, CLS <0.1, Performance >80
- [ ] Cross-browser: Chrome, Safari (glass), Firefox (glass fallback)
- [ ] Reduced motion: verify all GSAP animations skip when `prefers-reduced-motion: reduce`
- [ ] Visual regression diff against baseline screenshots from Phase 1
- [ ] AR sign-off: screenshot deck of all sections at desktop + mobile, delivered to AR before merge

**Success criteria (non-negotiable):**
- Screenshot confirms frosted glass renders correctly in Chrome + Safari
- No section is invisible at 390px
- All animations run without jank (frame rate stays >55fps on mid-tier device)
- Phase 1 baseline comparison shows clear visual improvement on every section

---

## Skill Routing Log

```json
{
  "primary": "frontend-design",
  "supporting": ["coding-agent", "canvas-design"],
  "routingDecision": "Design-heavy landing page rebuild. frontend-design governs aesthetic + motion direction. coding-agent handles implementation via Codex. canvas-design for before/after visual comparison."
}
```

---

## Execution Notes

- **Repo path:** `/home/podhi/.openclaw/workspace/seeding-tool`
- **Live site:** `https://aha.inc` (Next.js/Tailwind v4, not open source — rebuild from live DOM)
- **Z2A reference:** `/home/podhi/.openclaw/workspace/Z2A` — use for glass + GSAP pattern reference
- **GitHub:** `mmoahid/seeding-tool` (Mo's account — use `gh auth switch --user mmoahid` before push)
- **Report back to:** AR (this was assigned by AR, not Mo)

---

## Skills Available for Implementation

_Discovered 2026-03-09 via installed skill scan._

| Skill | Location | Role |
|-------|----------|------|
| `coding-agent` | `~/.npm-global/lib/node_modules/openclaw/skills/coding-agent/SKILL.md` | Codex/Claude Code lane for implementation |
| `canvas-design` | `~/.openclaw/skills/canvas-design/SKILL.md` | Visual before/after comparison |
| `browser-automation` | `~/.openclaw/skills/browser-automation/SKILL.md` | Playwright QA harness |
| `phase-gaps` | `~/.openclaw/skills/phase-gaps/SKILL.md` | RED TEAM analysis of this plan |
| `commit-work` | `~/.openclaw/skills/commit-work/SKILL.md` | Structured commits after each subphase |

No required skills are missing. GSAP is a npm package (no skill needed). Lenis is deferred per RED TEAM — not needed for the carousel-dock approach actually implemented.

---

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 10 (Seeding Rollout) | Untracked/in-progress | `apps/web/app/globals.css`, root `package.json` | Landing page touches `globals.css`; platform work in `(platform)/` is safe. Merge landing changes after platform CSS pass. |
| Phase 11 (unknown, feature branch) | On `feature/hero-media-dock` | Multiple doc files | Sub-phases a–c co-located on branch; merge landing before platform phase-11 |
| `feat/email-enrichment` (branch) | Stale | `lib/outreach/`, `lib/unipile/`, `(platform)/` | No overlap with `(marketing)/` files — independent |

**Active dirty-tree conflict (MEDIUM):**
Root `package.json` modified in dirty tree (platform work) while `apps/web/package.json` also modified in feature branch. These are different files in the monorepo — no direct conflict. Verify `npm install` runs clean after merge.

---

## Subphase Index

* a — Hero Carousel-Dock Animation (scroll-progress carousel → dock, `HeroScene.tsx`)
* b — Marketing Sections Rebuild (friction cards, story steps, AI capabilities, evidence, logo rail)
* c — Design System + CSS Token Pass (globals.css updates, Turbopack config, responsive tokens)
* d — QA Gate (browser verification loop, Playwright smoke, mobile 390px, merge to main)
