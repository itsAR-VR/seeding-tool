# Phase 2f — Produce rebuild blueprint + parity test strategy (Next.js + Tailwind)

## Focus
Convert the audit outputs into a decision-complete implementation blueprint for a Next.js + Tailwind reimplementation that achieves UI parity and functional parity (with your new e-commerce seeding backend), and define Playwright parity tests for ongoing validation.

## Inputs
- Marketing + platform page docs and flow docs (Phase 2e).
- Token + animation inventories (Phase 2b/1c).
- Network/API mapping (Phase 2c/1d) to infer the required workflow “shape”.

## Work
1. Design system blueprint:
   - Define core tokens:
     - typography scale (heading/body/button)
     - color palette (semantic mapping: background/text/primary/accent/border)
     - spacing/radius/shadow primitives
   - Define motion system:
     - standard durations/easings
     - reusable keyframes (e.g., header fade-in) and interaction transitions
2. Component inventory:
   - Marketing components: header, hero sections, feature blocks, carousels, FAQs/accordions, footer, CTA patterns.
   - Platform components: nav shell, tables/lists, forms, modals, wizards/steppers, toasts, empty states.
3. Screen map:
   - For each platform route, map:
     - state (loading/empty/error/filled)
     - primary actions (create/edit/submit)
     - required data dependencies (from API map)
4. Functional parity plan:
   - Define backend contracts needed for your e-commerce seeding niche:
     - replace influencer-specific concepts with seeding workflows (campaigns, creators, outreach, approvals, tracking)
   - Keep UI flow shapes consistent with audited flows where beneficial (onboarding, campaign creation, reporting).
5. Parity testing strategy:
   - Define Playwright “parity tests” that:
     - navigate each rebuilt route
     - perform key interactions
     - compare layout with tolerant assertions (not pixel-perfect initially)
   - Tighten to visual diffs later once UI stabilizes.

## Output
- A rebuild blueprint document (implementation guide) referencing:
  - token definitions
  - component list
  - screen map and flow map
  - parity test plan

## Handoff
This completes Phase 2. The next phase (implementation) should:
- generate the audit harness code, run it against staging, and start implementing the Next.js rebuild with parity tests.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Verified owned and fusion blueprint outputs exist on disk and are linked from audit index.
  - Verified parity-test strategy document exists and is integrated into blueprint set.
  - Updated Phase 2 root status to map this subphase as complete with direct evidence links.
- Commands run:
  - `find docs/audit/blueprints -maxdepth 3 -type f | sort` — pass; owned + fusion blueprint files present.
  - `cat docs/audit/index.md` — pass; blueprint links present under canonical run.
- Blockers:
  - None for blueprint/parity strategy deliverables.
- Next concrete steps:
  - Carry these blueprint outputs into Phase 3+ implementation sequencing.

## Output (Execution Status — 2026-03-02)
- Complete.
- Evidence:
  - `docs/audit/blueprints/owned/rebuild-blueprint.md`
  - `docs/audit/blueprints/owned/parity-tests.md`
  - `docs/audit/blueprints/fusion/blueprint.md`
  - `docs/audit/blueprints/fusion/backlog.md`

## Handoff (Execution Status — 2026-03-02)
- Phase 2 blueprint/parity outputs are ready for direct use by implementation phases.
