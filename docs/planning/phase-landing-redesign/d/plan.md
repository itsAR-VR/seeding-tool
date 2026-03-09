# Phase Landing-Redesign D — QA Gate (Browser Verification + Sign-off)

## Focus

The hard close gate. Nothing ships to production or is presented to AR without this passing.
Runs the full browser verification loop per AGENTS.md: change → deploy → screenshot → inspect
→ fix → repeat. Ends with an AR sign-off screenshot deck.

**Status (2026-03-09):** NOT started. Blocked on subphases a–c.

---

## Inputs

- Merged and token-verified codebase (from subphases a, b, c)
- `docs/planning/phase-landing-redesign/design-tokens.md` (from subphase c)
- Baseline screenshots (`current-home-full.png`, `current-home-viewport.png`, etc. in repo root)

---

## Skills Available for This Subphase

- `browser-automation` — Playwright full-page screenshots at multiple viewports
- `canvas-design` — before/after visual comparison image
- `coding-agent` — fix any regressions found

---

## Work

### Step 1 — Dev server baseline

```bash
cd /home/podhi/.openclaw/workspace/seeding-tool/apps/web
npm run dev
```

Confirm server starts at `http://localhost:3000` without errors.

### Step 2 — Desktop full-page screenshot (1440px)

Capture full-page screenshot of `http://localhost:3000`:
- Hero at viewport (carousel fan state)
- Hero at 30% scroll (mid-transition)
- Hero at 60% scroll (docked state)
- Each marketing section below hero (friction, story, AI, evidence, CTA, footer)

Save to `docs/planning/phase-landing-redesign/qa-screenshots/desktop-YYYYMMDD/`.

### Step 3 — Mobile screenshot (390px)

Capture at `width: 390px`:
- Hero (mobile dock, 2 slots)
- Each section stacked vertically
- Lead form at mobile width

Save to `docs/planning/phase-landing-redesign/qa-screenshots/mobile-YYYYMMDD/`.

### Step 4 — Reduced-motion check

Add `prefers-reduced-motion: reduce` to browser preferences:
- Hero: cards should be hidden (`aria-hidden`), text readable
- Story steps: no animation, static content
- Verify page is fully usable without motion

### Step 5 — Visual regression comparison

Compare against baseline screenshots in repo root:
- `current-home-full.png` (before)
- New screenshot (after)

Confirm: clear visual improvement on hero, section hierarchy, typography. No regressions.

### Step 6 — Common failure mode checklist (per AGENTS.md)

Per AGENTS.md Browser Verification Loop section, verify none of these:
- [ ] Sections below fold invisible (opacity: 0, IntersectionObserver not firing)
- [ ] Animation overlays leaving dark/grey boxes on load
- [ ] Cards rendering with visible borders inside gradient backgrounds that look weird
- [ ] Hero content jumping or flashing on load
- [ ] Mobile layout breaking (375px viewport)

### Step 7 — Lighthouse audit

Run via Chrome DevTools or `lighthouse` CLI:

```bash
npx lighthouse http://localhost:3000 --output json --output-path /tmp/lh-report.json
```

Targets:
- LCP < 2.5s
- CLS < 0.1
- Performance > 80

Document actual scores in completion note.

### Step 8 — Cross-browser spot check

1. Chrome: full animation, glass frost surfaces visible
2. Firefox: `backdrop-filter` graceful fallback (opaque background)
3. Safari (if available): `-webkit-backdrop-filter` rendering

### Step 9 — AR sign-off screenshot deck

Compile screenshot deck for AR:
- Desktop hero (carousel + dock states)
- Desktop section scroll
- Mobile hero
- Mobile sections
- Lighthouse scores

Format: annotated screenshots in `docs/planning/phase-landing-redesign/qa-screenshots/ar-deck/`.
Deliver via Telegram to AR for sign-off.

---

## Success Criteria (Non-Negotiable)

- [ ] Light mode warm cream background confirmed in Chrome screenshot
- [ ] Hero carousel fan visible at top, dock visible after scroll
- [ ] No dark navy / oklch dark palette anywhere
- [ ] Mobile: 390px — 2 dock slots, readable text, no overflow
- [ ] Reduced motion: page fully readable without animation
- [ ] Lighthouse LCP < 2.5s
- [ ] AR has seen the screenshot deck and confirmed sign-off

---

## Output

- QA screenshot deck (desktop + mobile, all states)
- Lighthouse score report
- AR sign-off (or list of fixes required before sign-off)
- Completion note filed in `docs/planning/phase-landing-redesign/d/completion.md`

---

## Handoff

After AR sign-off: merge to main (if not already done), push to `mmoahid/seeding-tool` with
`gh auth switch --user mmoahid`, and trigger deploy.

Final commit message: `feat(marketing): aha.inc landing page redesign — hero carousel-dock animation, operator editorial aesthetic`
