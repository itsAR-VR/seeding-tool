# Phase 3e — “Fusion” site blueprint + implementation backlog (integrated with roadmap)

## Focus
Produce the final, decision-complete blueprint for building our marketing site: page IA, templates, component/motion usage, and a prioritized backlog that integrates with the project’s existing plan/roadmap.

## Inputs
- Outputs from Phase 3d (typography tokens, motion primitives, component catalog).
- Business requirement: not SaaS; funnel and content should resemble a TKS-like admissions/program model.
- Existing roadmap/plans in `docs/planning/` (Phase 2 and any other planning docs that exist).

## Work
1. Define the target marketing IA (site map) for our product:
   - Home, About, Program, Admissions/Apply, Outcomes/Alumni, Financial Aid (if applicable), FAQ, Blog/Resources, Contact.
2. For each page, select:
   - a template structure (inspired by TKS funnel order)
   - component instances from the catalog (Refunnel-level polish where appropriate)
   - motion primitives to apply (with reduced-motion variants)
3. Produce the build backlog:
   - Break into milestones (foundation → core pages → polish/motion → parity tests).
   - For each milestone, define acceptance criteria in observable UI terms (screenshots/videos, scroll behaviors).
4. Define parity tests (Playwright):
   - At minimum: “layout sanity” per page on 3 viewports and a “motion smoke test” for key interactions.
5. Deliver a “side-by-side animation board”:
   - A doc that pairs a TKS reference clip and Refunnel reference clip with the intended fused implementation notes per section.

## Output
- `docs/audit/competitors/fusion-blueprint.md` (IA + templates + component/motion mapping)
- `docs/audit/competitors/implementation-backlog.md` (milestones + acceptance criteria + parity tests)

## Handoff
This subphase closes Phase 3 and hands off to implementation work: building the site in Next.js + Tailwind + GSAP using the blueprint and parity tests as the source of truth.

