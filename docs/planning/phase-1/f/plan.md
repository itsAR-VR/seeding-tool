# Phase 1f — Produce rebuild blueprint + parity test strategy (Next.js + Tailwind)

## Focus
Convert the audit outputs into a decision-complete implementation blueprint for a Next.js + Tailwind reimplementation that achieves UI parity and functional parity (with your new e-commerce seeding backend), and define Playwright parity tests for ongoing validation.

## Inputs
- Marketing + platform page docs and flow docs (Phase 1e).
- Token + animation inventories (Phase 1b/1c).
- Network/API mapping (Phase 1c/1d) to infer the required workflow “shape”.

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
This completes Phase 1. The next phase (implementation) should:
- generate the audit harness code, run it against staging, and start implementing the Next.js rebuild with parity tests.

