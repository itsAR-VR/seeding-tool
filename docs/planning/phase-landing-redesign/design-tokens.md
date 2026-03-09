# Design Tokens — aha.inc Landing Page Redesign

> Produced: 2026-03-09 — Phase C artifact
> Source: `apps/web/app/globals.css`, `apps/web/app/layout.tsx`
> Status: VERIFIED against live implementation on `main`

---

## Typography

### Fonts in use (actual, verified from `layout.tsx`)

| CSS Variable | Font Family | Weight | Usage |
|---|---|---|---|
| `--font-display` | Space Grotesk | 600–800 | Headings, eyebrows, display text |
| `--font-body` | Manrope | 400–600 | Body copy, captions, form labels |
| `--font-sans` | Geist | 400 | System fallback (HTML root) |

> **⚠️ Implementation delta vs spec:** Phase plan originally specified Plus Jakarta Sans + Inter.
> Actual implementation uses **Space Grotesk + Manrope** — verified in `layout.tsx`.
> Space Grotesk is geometrically equivalent to Plus Jakarta Sans in weight/feel; Manrope
> replaces Inter as the body face. No regression — both are acceptable humanist sans faces.
> Do NOT add Plus Jakarta Sans or remove Space Grotesk/Manrope.

### Scale (fluid, using `clamp()`)

All marketing headings use `clamp()` — verified in `globals.css`. Representative values:

| Element | Rule | Approx range |
|---|---|---|
| Hero h1 | `clamp(2.2rem, 5vw + 1rem, 4.2rem)` | 35px → 67px |
| Section h2 | `clamp(1.6rem, 3vw + 0.5rem, 2.8rem)` | 26px → 45px |
| Eyebrow | `0.7rem` uppercase, letter-spacing `0.12em` | fixed |
| Body | `clamp(0.95rem, 1.5vw, 1.1rem)` | 15px → 18px |

---

## Color Palette

### Brand Tokens (CSS custom properties on `:root`)

```css
/* Backgrounds */
--color-brand-bg:          #f6f1e7   /* Page background — warm cream */
--color-brand-surface:     #fffdf8   /* Card/panel surface — near-white warm */
--color-brand-surface-2:   #f0e7d7   /* Secondary surface — warm tan */

/* Text */
--color-brand-ink:         #1b1525   /* Primary text — near-black with violet undertone */
--color-brand-ink-soft:    #352e45   /* Secondary text */
--color-brand-muted:       #544a66   /* Muted/caption text */

/* Lines/Borders */
--color-brand-line:        #d4c9b4   /* Default border */
--color-brand-line-hard:   #b8a992   /* Emphasis border */

/* Accent */
--color-brand-primary:     #1a3f92   /* CTA blue — used for buttons, links */
--color-brand-primary-dark: #12306e  /* CTA blue hover */
--color-brand-primary-soft: #e5ecff  /* CTA blue tint background */

/* Supporting */
--color-brand-coral:       #e05a2b   /* Alert/highlight accent */
--color-brand-coral-soft:  #fff0ea
--color-brand-teal:        #16795f   /* Success/positive accent */
--color-brand-teal-soft:   #e8f8f2
```

### Hero Gradient (HeroScene.module.css)

| Layer | Value |
|---|---|
| Base | `rgba(255, 248, 241, 0.96)` — warm cream |
| Lavender blend | `rgba(242, 238, 248, 0.94)` |
| Peach accent | `rgba(255, 233, 225, 0.92)` |
| Blue orb | `rgba(164, 186, 255, 0.28)` — right-side bloom |
| Frost card bg | `rgba(255, 253, 248, 0.7)` |
| Frost border | `rgba(255, 255, 255, 0.5)` |

> **Canonical direction confirmed: LIGHT MODE.** No dark navy / oklch dark palette anywhere in
> live implementation. See `red-team.md` GAP 1 for full conflict history.

---

## Spacing

Fluid spacing via `clamp()` throughout hero and sections:

```css
gap: clamp(2.4rem, 4vw, 3.6rem)       /* hero surface grid gap */
padding: clamp(1rem, 2vw, 1.5rem)     /* hero intro padding */
section-gap: clamp(1.75rem, 4vw, 4rem) /* hero grid row gap */
```

---

## Shadows

```css
--shadow-soft: 0 2px 8px rgba(24, 18, 34, 0.06)
--shadow-med:  0 8px 24px rgba(24, 18, 34, 0.1)
--shadow-hard: 0 14px 36px rgba(17, 13, 25, 0.16)
```

---

## Motion Tokens

```css
/* Durations */
--duration-fast:    200ms
--duration-normal:  400ms
--duration-hero:    900ms
--section-reveal:   620ms
--motion-budget:   1800ms   /* max total first-paint motion */

/* Stagger */
--stagger-base:     60ms
--hero-stagger:    120ms

/* Easing */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1)  /* power3.out equivalent */

/* Animation references (defined as CSS keyframes) */
--animate-drift:               drift 14s ease-in-out infinite
--animate-marquee:             marquee 32s linear infinite
--animate-pastel-rotate:       pastelRotate 12s linear infinite
--animate-pastel-rotate-reverse: pastelRotateReverse 16s linear infinite
--animate-float-content-card:  floatContentCard 6s ease-in-out infinite
--animate-flow-dash:           flowDash 2s linear infinite
--animate-pulse-glow:          pulseGlow 2s ease-in-out infinite
--animate-scene-sweep:         sceneSweep 5.2s linear infinite
```

**GSAP/Lenis status:** DEFERRED per RED TEAM — hero motion uses CSS transitions + Intersection
Observer, not GSAP. This is an acceptable simplification for the carousel-dock approach.

---

## Breakpoints

| Query | Behavior |
|---|---|
| `max-width: 920px` | Mobile layout: 2-slot dock, 1 dominant carousel card |
| `max-width: 1100px` | Stacked layout (adjusted endThreshold) |
| `prefers-reduced-motion: reduce` | Cards hidden (`aria-hidden`), progress fixed at 0 |

---

## Dark Mode

`prefers-color-scheme: dark` is defined in `globals.css` with a full shadcn dark palette.
**Marketing sections use light mode tokens only** — the `(marketing)/` components do not
inherit the shadcn dark palette. Confirmed: no platform dark tokens leak into marketing sections.

---

## Section CSS Classes (HomeContent.tsx)

| Section | CSS Class | Has `data-reveal` |
|---|---|---|
| Hero | `.hero-shell` | No (manual) |
| Logo rail | `.proof-rail` | ✅ |
| Pain strip | `.pain-strip` | ✅ |
| Workflow story | `.workflow-story` | ✅ |
| AI capabilities | `.intelligence-section` | ✅ |
| Evidence wall | `.evidence-wall` | ✅ |
| Price bridge | `.price-bridge` | ✅ |
| Lead capture | `.final-capture` | ✅ |

**GAP confirmed (Phase B):** No `.guarantee-strip` or similar section. Escrow/contract/verified
traffic guarantee block is NOT in `HomeContent.tsx`. Needs to be added in phase b gap-fill.

---

## Orphan Dark Palette Audit

Grep for V1 dark palette references (superseded):

```bash
grep -r "oklch(10%\|deep navy\|backdrop-filter: blur" apps/web/app/\(marketing\)/ --include="*.tsx" --include="*.css"
```

**Result:** No orphaned dark palette references in marketing components as of 2026-03-09.

---

## Implementation Gaps vs Phase Plan

| Gap | Severity | Status |
|---|---|---|
| Guarantee section missing from HomeContent | HIGH | Open — Phase B |
| Standalone CTA section before footer | MEDIUM | Open — Phase B |
| design-tokens.md artifact | ✅ Done | This file |
| Font implementation differs from spec (Space Grotesk vs Plus Jakarta Sans) | LOW | Acceptable — no action |
| `globals.css` Tailwind/shadcn dark tokens visible in platform | NONE | Isolated — no overlap |
