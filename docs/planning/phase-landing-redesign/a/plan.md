# Phase Landing-Redesign A — Hero Carousel-Dock Animation

## Focus

Build the scroll-progress-driven carousel-to-dock animation for the hero section. Six creator
content cards animate from a fanned carousel arrangement into a linear dock row as the user
scrolls past the hero. This is the primary motion statement for the landing page and the first
thing users see.

**Status (2026-03-09):** Implementation is COMPLETE on `feature/hero-media-dock`. Not yet merged
to `main`. This subphase plan documents the canonical spec and the merge/verification steps.

---

## Inputs

- **Canonical spec:** `AGENTS.md` design context (light mode, warm neutral, restrained motion)
- **Implementation:** `apps/web/app/(marketing)/components/HeroScene.tsx` (739 lines, on `feature/hero-media-dock`)
- **CSS module:** `apps/web/app/(marketing)/components/HeroScene.module.css` (793 lines, on `feature/hero-media-dock`)
- **Root plan:** `docs/planning/phase-landing-redesign/plan.md`

---

## Canonical Animation Spec

### Hero Media Items (6 cards)

| ID | Kind | Handle | Note |
|----|------|--------|------|
| `routine-pass` | Reel | @miatorres | Shelf routine breakdown |
| `unboxing-cut` | Reel | @noahchen | Launch-day unboxing cut |
| `story-mention` | Story | @julescarter | Quick follow-up mention |
| `creator-proof` | UGC | @avasingh | Before / after proof |
| `kitchen-demo` | Reel | @nadiakim | Kitchen demo sequence |
| `delivery-moment` | Post | @andrewsoto | Drop-off confirmation |

Each card has a per-item `accent` color (warm pastels) and renders as a `PosterCard` component
with kind badge, mock frame, caption, creator handle, and highlight overlay.

### Slot System

**Desktop carousel slots (6):** Cards arranged in a shallow arc — outer cards at low opacity
(0.06), center-right pair at full opacity/scale (1.0/1.02), intermediate at half opacity (0.52).
Rotations range from -10° to +10°.

**Mobile carousel slots (6):** Single-card-dominant layout centered at ~56% x. Outer slots clipped
to opacity 0 (off-screen).

**Desktop dock (4 slots):** Linear row at y=76%, uniform scale 0.43, no rotation. Cards
slots 1–4 (from carousel index) fill dock positions 0–3.

**Mobile dock (2 slots):** Two-slot row at y=74%, scale 0.5. Carousel slots 2 and 3 fill dock.

### Progress-Driven Interpolation

```
scroll → progress (0→1) → smoothstep easing → lerp(carouselSlot, dockSlot)
```

- **Progress trigger:** Scroll past 14% of viewport height from hero top
- **Progress end:** Determined dynamically by first slot's bounding rect relative to viewport
  (`endThreshold` = 0.62 mobile, 0.54 stacked, 0.46 desktop)
- **Easing:** `smoothstep(t) = t² × (3 - 2t)` (S-curve, no bounce)
- **Dock positions:** Measured from real DOM via `ResizeObserver` (`dockTargetRefs`), with static
  fallback slot constants for pre-measurement frames

### Auto-Rotation

When `progress < 0.04` and motion not reduced and not paused:
- Active card rotates every 4500ms
- Stops when user scrolls into dock transition range

### Breakpoints

| Query | Behavior |
|-------|----------|
| `max-width: 920px` | Mobile layout (2-slot dock, 1 dominant carousel card) |
| `max-width: 1100px` | Stacked layout flag (adjusts endThreshold) |
| `prefers-reduced-motion` | Cards hidden (`aria-hidden`), progress fixed at 0 |

### Background (CSS-only, no JS)

Three layered radial gradient divs:
1. `gradientBase` — warm cream-to-lavender `rgba(255, 248, 241, 0.96)` → `rgba(242, 238, 248, 0.94)` → `rgba(255, 233, 225, 0.92)`
2. `gradientWave` — blue-peach orb top-right, `opacity: calc(0.6 - progress × 0.18)`
3. `gradientBloom` — white-peach bloom bottom-center, `opacity: calc(0.85 - progress × 0.25)`

Gradients dim slightly as cards dock, giving a sense of "settling." No canvas. No GPU kill.

### Static Fallback (reduced-motion / non-JS)

`staticHeroItems` renders 2–4 visible-slot cards without any inline style animation.
Fully accessible at `opacity: 1`, no transform.

---

## Skills Available for This Subphase

- `coding-agent` — for any implementation fixes or additions during merge
- `browser-automation` — Playwright verification of hero section at 390px and 1440px
- `commit-work` — structured commit once merged to main

---

## Work

### Step 1 — Verify feature branch state

```bash
cd /home/podhi/.openclaw/workspace/seeding-tool
git log feature/hero-media-dock --oneline -5
git diff main...feature/hero-media-dock -- apps/web/app/\(marketing\)/components/HeroScene.tsx | wc -l
```

Expected: 739-line file on branch, confirmed to exist.

### Step 2 — Review globals.css delta for landing-relevant changes only

```bash
git diff main...feature/hero-media-dock -- apps/web/app/globals.css
```

Changes to audit before merge:
- `.hero-shell min-height` — added `clamp(44rem, 104vh, 58rem)`
- `.hero-grid grid-template-columns` — `0.95/1.05` → `0.9/1.1`
- `.hero-intro` — added `position: sticky; top: 7rem; align-self: start`
- `.hero-frost` — glass stripped (background transparent, no border/shadow)
- `.hero-stage-panel` — glass/border stripped for clean surface

Ensure none of these CSS changes collide with dirty-tree `(platform)/` files (they shouldn't — globals.css changes are in `/* Hero shell */` section only).

### Step 3 — Review next.config.mjs delta

Added Turbopack config with `root: __dirname`. This is safe — Turbopack is optional via `next dev --turbo`. Also adds `dev:webpack` script as a fast-path fallback.

### Step 4 — Merge to main

```bash
git checkout main
git merge feature/hero-media-dock --no-ff -m "feat(marketing): merge hero carousel-dock animation from feature/hero-media-dock"
```

**If conflicts on `globals.css`:** resolve by keeping the hero-shell section changes from the feature branch, preserving dirty-tree additions in other sections.

**If conflicts on `apps/web/package.json`:** both only add 1 line each — merge both additions.

### Step 5 — Browser verification (HARD RULE — see AGENTS.md)

```bash
cd apps/web && npm run dev
```

Then browser → `http://localhost:3000`:
1. Screenshot hero at 1440px desktop — verify cards fan out from carousel
2. Scroll slowly — verify cards dock into row (progress 0 → 1)
3. Screenshot post-dock state
4. Screenshot at 390px mobile — verify 2-slot dock, single dominant card
5. Check `prefers-reduced-motion: reduce` — verify cards hidden, page still readable

Success criteria:
- No dark/navy background (light mode warm cream confirmed)
- Cards animate smoothly without jank
- Mobile: 2 dock slots visible, text readable
- Reduced motion: no animation, `aria-hidden` cards confirmed

### Step 6 — Commit verification evidence

Attach screenshot paths in completion note. Commit if clean.

---

## Output

- Feature branch merged to main
- Browser screenshots confirming light-mode hero carousel-dock animation
- Any merge conflict resolution documented

---

## Handoff

Subphase b uses the merged codebase to verify and extend the remaining marketing sections
(friction cards, story steps, AI capabilities, evidence, logo rail) built in `HomeContent.tsx`.
