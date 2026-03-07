# Phase 5f — Synthesize design system + motion library + blueprints + parity tests/backlog

## Focus
Turn the captured evidence into two “build-ready” outputs:
1) **Owned rebuild blueprint** (Aha 1:1 parity → custom code)
2) **Competitor fusion blueprint** (TKS-like funnel + Refunnel-level polish) using original assets

## Inputs
- Per-page docs and aggregated JSON from Phase 5c–4e.
- Business direction: e-commerce brands as customers, creators as seeding recipients.

## Work
1. Owned rebuild blueprint (Aha):
   - design tokens: typography scale, colors, spacing, radii, shadows
   - motion primitives derived from observed events (`fadeUp`, `hoverLift`, `scrollReveal`, `accordion`, etc.) with reduced-motion variants
   - component inventory and screen map for marketing + app
   - parity test plan (Playwright): route smoke tests + interaction tests + onboarding replay test
2. Competitor fusion spec (TKS + Refunnel):
   - typography token set (heading/body scale, tracking/leading)
   - motion library spec (GSAP-first primitives) grounded in captured clips/screens
   - component catalog (hero variants, stats chips, feature grids, FAQ accordion, case modules, CTAs)
   - translation notes: SaaS → funnel/admissions style structures
3. Implementation backlog:
   - milestones (foundation → pages → motion polish → parity tests)
   - acceptance criteria written in observable UI terms (screenshots/videos, scroll behaviors)

## Output
- Owned rebuild docs under `docs/audit/blueprints/owned/`:
  - `rebuild-blueprint.md` — design tokens, motion primitives, component inventory, screen map
  - `parity-tests.md` — Playwright test strategy for route smoke, interaction, and onboarding replay
- Competitor fusion docs under `docs/audit/blueprints/fusion/`:
  - `typography.md` — heading/body scale, tracking/leading tokens
  - `motion.md` — GSAP-first animation library spec with named primitives
  - `components.md` — hero variants, stats chips, feature grids, FAQ accordion, CTAs
  - `blueprint.md` — overall fusion site blueprint
  - `backlog.md` — implementation milestones with acceptance criteria

## Output (Actual)
- Added blueprint generator: `src/audit/report/blueprints.ts`
  - Produces owned blueprint + parity test docs
  - Produces fusion typography/motion/components/blueprint/backlog docs

## Verification
- [ ] `docs/audit/blueprints/owned/rebuild-blueprint.md` exists and references captured artifacts
- [ ] `docs/audit/blueprints/owned/parity-tests.md` defines ≥5 Playwright test cases
- [ ] `docs/audit/blueprints/fusion/` contains all 5 files listed above
- [ ] Each blueprint doc links to specific screenshots/videos as evidence
- [ ] `backlog.md` has milestones with observable UI acceptance criteria (not vague)

## Handoff
This closes Phase 5 and hands off to implementation: building the rebuilt product + marketing surfaces with parity tests.
