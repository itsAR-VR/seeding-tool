# Phase Landing-Redesign C — Design System + CSS Token Pass

## Focus

Ensure the design system (colors, spacing, typography, motion) is consistent across all marketing
section components. Audits `globals.css`, Tailwind config, and component CSS modules against the
AGENTS.md canonical spec. Produces a `design-tokens.md` artifact and resolves any inconsistencies.

**Status (2026-03-09):** Partial — `globals.css` hero changes landed via feature branch. Full
token audit and documentation not done. This subphase creates the token doc and fills gaps.

---

## Inputs

- `apps/web/app/globals.css` (merged from feature branch in subphase a)
- `apps/web/app/(marketing)/components/HeroScene.module.css` (from feature branch)
- `apps/web/tailwind.config.ts` (if exists) or `postcss.config.mjs`
- AGENTS.md design context

---

## Canonical Design Tokens (from AGENTS.md + implementation)

### Color (LIGHT MODE — canonical)

| Token | Value | Usage |
|-------|-------|-------|
| Background base | warm cream `rgba(255, 248, 241, 0.96)` | Page background, hero surface |
| Background mid | lavender `rgba(242, 238, 248, 0.94)` | Hero gradient blend |
| Background warm | peach `rgba(255, 233, 225, 0.92)` | Hero gradient accent |
| Wave gradient | blue-peach orb `rgba(164, 186, 255, 0.28)` | Hero right-side bloom |
| Frost surface | `rgba(255, 253, 248, 0.7)` | Card/panel backgrounds (pre-dock) |
| Frost border | `rgba(255, 255, 255, 0.5)` | Card borders |
| Text primary | inherit from Tailwind | Body + headings |
| Accent | warm pastel set | Per-card accent colors (see HeroMedia items) |

> **⚠️ DO NOT USE:** The dark navy palette from the V1 plan (`oklch(10% 0.03 260)`) is superseded.
> This has been red-teamed. Canonical = light mode.

### Typography

| Token | Value |
|-------|-------|
| Display font | Plus Jakarta Sans 600–800 |
| Body font | Inter |
| Fonts removed | Geist, Poppins, DM Sans |
| Scale | `clamp()` fluid sizing throughout |

### Spacing

All component spacing uses `clamp()` for fluid responsiveness:
- Gap: `clamp(2.4rem, 4vw, 3.6rem)` (hero surface)
- Padding: `clamp(1rem, 2vw, 1.5rem)` (hero intro)
- Section gap: `clamp(1.75rem, 4vw, 4rem)` (hero grid)

### Motion Tokens

| Token | Value | When |
|-------|-------|------|
| Easing | `smoothstep` (S-curve) | Carousel progress interpolation |
| Carousel interval | 4500ms | Auto-advance (no scroll) |
| Progress trigger | 14% viewport from top | Scroll progress start |
| Card lerp | linear per-frame | Carousel → dock transition |
| Reduced motion | No animation | `prefers-reduced-motion: reduce` |

No GSAP. No Lenis. Pure CSS + requestAnimationFrame. The V1 plan specified GSAP + ScrollTrigger —
this is superseded by the implementation which uses a custom RAF loop. See `red-team.md` GAP 2.

### Breakpoints

| Breakpoint | Rule | Behavior |
|------------|------|----------|
| Mobile | `max-width: 920px` | 2-slot dock, single dominant card |
| Stacked | `max-width: 1100px` | Adjusted progress endThreshold |
| Desktop | `>1100px` | 4-slot dock, 2 lead cards |

---

## Skills Available for This Subphase

- `coding-agent` — for any Tailwind config or globals.css edits
- `code-documentation` — for generating `design-tokens.md` artifact

---

## Work

### Step 1 — Audit Tailwind config

```bash
cat apps/web/tailwind.config.ts 2>/dev/null || cat apps/web/tailwind.config.js 2>/dev/null
```

Verify:
- Plus Jakarta Sans + Inter are loaded via `next/font` (check `app/layout.tsx`)
- No Geist, Poppins, or DM Sans in font config
- CSS variables for hero gradients defined if needed

### Step 2 — Audit `globals.css` for orphaned dark-mode sections

```bash
grep -n "oklch\|dark\|navy\|frosted" apps/web/app/globals.css | head -20
```

Remove or replace any leftover dark palette references. Ensure `.glass-panel` (if defined)
uses the light frost surface tokens, not the dark oklch values from the V1 plan.

### Step 3 — Verify `next/font` loading

```bash
grep -n "font\|jakarta\|inter\|geist" apps/web/app/layout.tsx | head -20
```

Ensure only Plus Jakarta Sans + Inter are loaded. Remove unused font families.

### Step 4 — Write `design-tokens.md` artifact

Create `docs/planning/phase-landing-redesign/design-tokens.md` with the canonical token table
from this plan. This replaces the task from Phase 2 in the root plan.md.

### Step 5 — Verify Turbopack config

```bash
cat apps/web/next.config.mjs | grep -A 5 "turbopack"
```

Confirms `turbopack.root = __dirname` is set (needed for CSS module resolution in Next.js 15+).
If missing: apply from feature branch diff.

---

## Output

- `docs/planning/phase-landing-redesign/design-tokens.md` written to disk
- No dark oklch palette references in globals.css
- Font loading verified (2 fonts only)
- Turbopack config confirmed

---

## Handoff

Subphase d is the QA gate. All prior work must pass browser verification before merging to main
and delivering the AR sign-off screenshot deck.
