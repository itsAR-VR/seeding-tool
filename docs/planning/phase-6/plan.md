# Phase 6 — Skills-first CRO iteration loop (local-first QA)

## Purpose
Run fast, evidence-driven CRO iterations aligned to the original objective: improve conversion performance for the rebuilt marketing + platform journey while preserving the validated design/motion baseline from run `20260302-legacy`.

## Inputs
- Run artifacts: `artifacts/20260302-legacy/run-summary.json`
- Owned capture baseline: `artifacts/20260302-legacy/marketing/routes.json`, `artifacts/20260302-legacy/platform/routes.json`
- Competitor/fusion references: `artifacts/20260302-legacy/competitors/tks/routes.json`, `artifacts/20260302-legacy/competitors/refunnel/routes.json`
- Existing docs: `docs/audit/index.md`, `docs/audit/runbook.md`, `docs/audit/blueprints/owned/rebuild-blueprint.md`, `docs/audit/blueprints/fusion/blueprint.md`

## Explicit skill invocation order
1. `find-local-skills` — preflight and select only required skills for the current turn.
2. `page-cro` — diagnose highest-friction page sections and define hypotheses.
3. `copywriting` — produce variant messaging (headlines, body, CTA).
4. `form-cro` or `signup-flow-cro` — optimize the conversion step being targeted.
5. `impeccable-critique` — UX/clarity review before implementation lock.
6. `playwright-testing` — local regression + conversion-path verification (mandatory pre-deploy gate).
7. `ab-test-setup` — experiment definition, metric contract, and exposure logic.
8. `phase-gaps` — RED TEAM pass before starting next iteration.

## Iteration loop and gates (I1..In)
1. `Gate A — Hypothesis quality`
   - Required: one quantified hypothesis, one target metric, one kill condition.
   - Output: `docs/planning/phase-6/iterations/I{n}/hypothesis.md`
2. `Gate B — Variant spec readiness`
   - Required: control vs variant copy/layout spec with impacted routes.
   - Output: `docs/planning/phase-6/iterations/I{n}/variant-spec.md`
3. `Gate C — Local Playwright QA (required before Vercel)`
   - Required: local pass for critical flows (landing CTA, primary form/signup step, thank-you/success state).
   - Output: `docs/planning/phase-6/iterations/I{n}/playwright-local.md`
4. `Gate D — Deploy eligibility`
   - Rule: no Vercel deploy unless Gate C is passed and documented.
   - Output: `docs/planning/phase-6/iterations/I{n}/deploy-checklist.md`
5. `Gate E — Post-release evaluation`
   - Required: compare control vs variant with decision (`ship`, `iterate`, `rollback`).
   - Output: `docs/planning/phase-6/iterations/I{n}/evaluation.md`

## Artifacts required per iteration
| Artifact | Required path |
|---|---|
| Hypothesis brief | `docs/planning/phase-6/iterations/I{n}/hypothesis.md` |
| Variant specification | `docs/planning/phase-6/iterations/I{n}/variant-spec.md` |
| Local Playwright evidence | `docs/planning/phase-6/iterations/I{n}/playwright-local.md` |
| Deployment gate checklist | `docs/planning/phase-6/iterations/I{n}/deploy-checklist.md` |
| Outcome decision log | `docs/planning/phase-6/iterations/I{n}/evaluation.md` |

## Completion criteria
- At least 3 full iterations executed with all gates passed.
- Each iteration has a recorded decision and next action.
- No iteration is deployed without a documented local Playwright gate pass.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Rebuilt `apps/web/app/page.tsx` into a full 8-section CRO architecture with stronger value proposition, objection handling, comparison proof, and CTA path.
  - Rebuilt `apps/web/app/globals.css` with a differentiated visual system, stronger hierarchy, responsive structure, and purposeful motion.
  - Deferred platform-login dependency for this landing page optimization pass per user direction.
- Commands run:
  - `cat docs/refunnelteardown.md` — pass; extracted interaction, pacing, and structure patterns.
  - `cat docs/planning/phase-6/plan.md` — pass; aligned output to skills-first CRO loop.
  - `cat apps/web/app/page.tsx` — pass; baseline captured.
  - `cat apps/web/app/globals.css` — pass; baseline captured.
  - `cat /Users/AR180/.codex/skills/{page-cro,copywriting,landing-page-architecture,hormozi,impeccable-critique,impeccable-polish}/SKILL.md` — pass; workflow constraints applied.
- Blockers:
  - None.
- Next concrete steps:
  - Run local startup and Playwright verification loop if requested.

## 10-Iteration Refinement Log (one-shot execution)
1. Reframed hero to lead with outcome + mechanism instead of generic feature language.
2. Rebuilt hero visual into a control-room panel to make value tangible in first viewport.
3. Tightened top navigation to decision-driving anchors (`architecture`, `value stack`, `proof`, `pricing`, `faq`).
4. Rewrote problem section into explicit operational failure modes (discovery chaos, execution drift, post uncertainty).
5. Replaced generic walkthrough with a 3-phase operating architecture (Source, Execute, Verify).
6. Added value-equation stack section (dream outcome, speed, effort reduction, confidence).
7. Replaced marquee testimonials with structured proof cards for readability and trust.
8. Added comparison matrix vs legacy and generic platforms to handle “why switch” objections.
9. Rebuilt FAQ around switching objections and added direct conversion bridge CTA.
10. Reworked visual language and motion system (color direction, typography rhythm, reveal/parallax discipline, responsive polish, reduced-motion compliance).

## Output
- Landing page implementation:
  - `apps/web/app/page.tsx`
  - `apps/web/app/globals.css`
- Phase tracking update:
  - `docs/planning/phase-6/plan.md`

## Handoff
- Phase 6 landing-page improvement pass is implemented in one shot.
- Optional next gate: local Playwright QA sweep before any deploy promotion.

## Progress This Turn (Terminus Maximus — Deep Pass 2)
- Work done:
  - Ran local startup + Playwright QA sweep across `/` and `/pricing`.
  - Fixed below-fold visibility regression caused by reveal defaults (blank long-page captures).
  - Executed a second 10-iteration CRO/design refinement pass, with major pricing-page rebuild and cross-page consistency fixes.
- Commands run:
  - Local QA orchestration (single-session): start server, run Playwright checks, stop server — pass.
  - QA result summary:
    - `/` → status `200`, `h1`: `Make seeding measurable, controllable, and scalable.`, `consoleErrors`: `0`
    - `/pricing` → status `200`, `h1`: `Choose the rollout path that matches your seeding operation.`, `consoleErrors`: `0`
  - Screenshot artifacts:
    - `/tmp/qa-landing-home.png`
    - `/tmp/qa-landing-pricing.png`
- Blockers:
  - None.
- Next concrete steps:
  - Optional: run one more visual-only pass after stakeholder feedback.

## 10-Iteration Refinement Log (Deep Pass 2)
1. Fixed reveal system baseline so below-the-fold content is visible without requiring intersection before scroll.
2. Standardized pricing page header/brand/CTA to match the redesigned landing narrative.
3. Rewrote pricing hero for outcome + rollout framing instead of static tier listing.
4. Expanded tier value bullets to reflect operational outcomes (fit scoring, post verification, rights state).
5. Added explicit recommended-tier badge to reduce plan-selection friction.
6. Introduced rollout timeline strip (Week 1 teardown → Week 2 launch → Week 3+ scale) to reduce implementation anxiety.
7. Strengthened comparison/guarantee strip copy to handle pricing and switching objections.
8. Upgraded pricing final CTA into form-based teardown request flow (not single link-only CTA).
9. Harmonized ambient visual system and footer messaging across pages for brand consistency.
10. Revalidated conversion-path quality via Playwright with zero console errors on key routes.

## Output (Deep Pass 2)
- Code:
  - `apps/web/app/page.tsx`
  - `apps/web/app/pricing/page.tsx`
  - `apps/web/app/globals.css`
- Phase evidence:
  - `docs/planning/phase-6/plan.md`

## QA Verification (Deep Pass 2 final)
- Local Playwright sweep rerun completed successfully after fixes.
- Routes:
  - `/` → `200`, `consoleErrors: 0`, screenshot: `/tmp/qa-landing-home-v2.png`
  - `/pricing` → `200`, `consoleErrors: 0`, screenshot: `/tmp/qa-landing-pricing-v2.png`
- Key regression resolved:
  - Below-the-fold blank/full-page capture issue removed by reveal-default visibility fix.

## Progress This Turn (Terminus Maximus — Deep Pass 3)
- Work done:
  - Executed broader QA loop again and resolved additional conversion hardening items.
  - Added trust/risk-reversal chips near hero CTA path.
  - Added mobile sticky CTA bars on both landing and pricing.
  - Added keyboard focus-visible button state for accessibility and interaction clarity.
  - Opened first FAQ item by default on landing and pricing to reduce initial friction.
- Commands run:
  - Broad QA in stable production mode (`build + start + playwright`) — pass.
  - Report artifact: `/tmp/qa-broad-v5-prod.json`.
- Blockers:
  - None.
- Next concrete steps:
  - Optional stakeholder review pass before deploy.

## 10-Iteration Refinement Log (Deep Pass 3)
1. Re-ran broad QA with desktop/mobile coverage and route-level metrics.
2. Isolated intermittent dev-server instability by shifting verification to production-mode QA.
3. Added trust chips under hero CTA to reinforce risk-reversal and price anchor.
4. Added sticky mobile CTA bar to improve conversion continuity on long mobile pages.
5. Added same mobile sticky CTA behavior to pricing for consistent funnel behavior.
6. Improved keyboard focus visibility on CTA buttons (`:focus-visible`) for accessibility polish.
7. Set first FAQ item open by default on landing to reduce interaction friction.
8. Set first FAQ item open by default on pricing to surface key objections immediately.
9. Revalidated styling and layout consistency across desktop and mobile screenshots.
10. Revalidated conversion-path integrity with zero console errors and no blank-risk pages.

## QA Verification (Deep Pass 3 final)
- Stable production QA (`build + start`) passed on all targeted routes and viewports.
- Results (`/tmp/qa-broad-v5-prod.json`):
  - `/` desktop: `200`, `consoleErrors: 0`, `ctaCount: 5`, `stickyVisible: false`
  - `/pricing` desktop: `200`, `consoleErrors: 0`, `ctaCount: 4`, `stickyVisible: false`
  - `/` mobile: `200`, `consoleErrors: 0`, `ctaCount: 5`, `stickyVisible: true`
  - `/pricing` mobile: `200`, `consoleErrors: 0`, `ctaCount: 4`, `stickyVisible: true`
- Screenshot artifacts:
  - `/tmp/qa-home-desktop-prod-v5.png`
  - `/tmp/qa-pricing-desktop-prod-v5.png`
  - `/tmp/qa-home-mobile-prod-v5.png`
  - `/tmp/qa-pricing-mobile-prod-v5.png`
