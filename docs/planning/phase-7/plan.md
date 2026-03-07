# Phase 7 - Kinetic creator-collage redesign for the marketing funnel

## Original User Request (verbatim)
Okay, go ahead and review the phase plans. I think the website right now looks all right, but I want you, because you are a new, better, smarter, more intelligent model. You are an expert designer. You have thousands of years of design experience that you've been trained on, and you need to utilize all that information and your training, which is high-quality data focused on intelligent UI and UX design.

You need to call on the skills that we have. Use the find local skills skill along with the find skills skill in order to create a new plan for yourself using the /phase-plan skill, which you will utilize in order to refine the website even further. Make the animated SVG that's present there much better. Use all of the playwright skills, maybe even the game dev skill, in order to reiterate, test, look at it, and make sure the website is not only visually appealing but that the content is well structured and well architected. You can completely redesign the website. I think it looks kind of garbage right now, so I want you to completely go ahead and go crazy on it. Call subagents when you need to, and get this to a beautiful SaaS website similar to refunnel.com and aha.inc but better.

## Purpose
Replace the current marketing presentation in `apps/web` with a more distinctive, premium SaaS experience across the homepage, pricing page, and shared shell. Preserve the product's core seeding-operations positioning while making the motion system stronger, the AI story more concrete, and the copy more human.

## Context
- The current homepage and pricing page are functionally stable, but browser review and design critique found repeated section-card patterns, diluted CTA hierarchy, a homepage hero that reads like a flowchart, and a pricing page that feels too similar to the homepage.
- The user chose a kinetic creator-collage direction, kept the positioning as a seeding operating system, asked for AI to be explained tastefully, and explicitly asked for a humanized copy pass.
- This is a new direction rather than a `phase-6` iteration. `phase-6` remains the CRO and QA baseline for the current funnel, but `phase-7` becomes the canonical redesign track for visual system, page architecture, and motion.
- Live review covered the current local site plus `refunnel.com` and `aha.inc`. Those sites are directional references only. Their layouts, assets, or proprietary visual motifs must not be copied.
- The worktree is already dirty across audit docs, screenshots, and historical planning files. This phase should stay confined to the marketing frontend and the new planning docs.

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 6 | Active baseline | Files: `apps/web/app/page.tsx`, `apps/web/app/pricing/page.tsx`, `apps/web/app/globals.css` | Use as the source of funnel learnings and QA expectations only. `phase-7` supersedes the visual system for homepage and pricing. |
| Phase 5 | Complete with dirty artifacts in worktree | Audit docs and capture outputs used as research inputs | Do not modify audit runners or regenerate unrelated audit docs as part of this phase. |
| Phase 3 | Complete reference phase | Domain: competitor teardown and motion research | Use only as reference for composition and pacing. Do not reproduce competitor structures or assets. |

## Repo Reality Check (RED TEAM)

- What exists today:
  - `apps/web/app/page.tsx` (637 lines, `"use client"`, monolithic homepage with inline hero SVG, nav, footer, data, tracking)
  - `apps/web/app/pricing/page.tsx` (325 lines, `"use client"`, monolithic pricing page duplicating nav, footer, mobile CTA, tracking)
  - `apps/web/app/globals.css` (1608 lines, single flat CSS file, all styles for both pages + animations + responsive)
  - `apps/web/app/layout.tsx` (20 lines, root layout with Manrope + Space Grotesk fonts, single shared Metadata export)
  - `apps/web/next.config.ts` (7 lines, `reactStrictMode: true` only)
  - `apps/web/public/` — `favicon.ico` + 9 brand logos in `public/logos/`
  - Zero shared component files — no `components/` directory exists
  - Zero Playwright test files — `playwright.config.ts` exists at repo root but has `headless: false` and no test directory
  - Root `package.json` has `web:build` script (`cd apps/web && npm run build`) and `@playwright/test` as devDep
  - `apps/web/package.json` has `build` → `next build`, deps: Next 15, React 19
- What the plan assumes:
  - Shared components can be extracted — true but no directory exists yet
  - Per-route metadata can be set — requires server/client component split since pages are `"use client"`
  - Playwright verification can run — config exists but no test files and `headless: false` prevents CI use
  - Hero SVG replacement is scoped — true, current hero is ~100 lines of inline SVG JSX with 8+ CSS animation keyframes
- Verified touch points:
  - `NEXT_PUBLIC_BOOKING_URL` used in both page files — confirmed
  - Logo assets in `page.tsx` logoRail array — all 9 files verified in `public/logos/`
  - `npm run web:build` → `cd apps/web && npm run build` → `next build` — confirmed
  - Fonts: `Manrope` (body) + `Space_Grotesk` (display) via `next/font/google` in `layout.tsx` — confirmed

## RED TEAM Findings (Gaps / Weak Spots)

### Highest-risk failure modes
- **Shell extraction breaks both pages simultaneously** — Both pages duplicate the full shell (nav, footer, ambient layers, mobile CTA, skip link, noise layer). Extracting into shared components is the riskiest step because a mistake breaks _both_ routes. Mitigation: extract shell in 7b with immediate `npm run web:build` gate before 7c touches page content.
- **`"use client"` blocks per-route metadata** — Both pages are client components. Next.js App Router only allows `metadata` exports from server components. If 7b tries to add per-route metadata without splitting server/client, the build will fail. Mitigation: plan explicitly requires page-level server component wrappers that export metadata and render a client component for interactivity.
- **CSS monolith refactor causes cascade regressions** — 1608 lines of flat CSS with no namespacing means any selector rename during the redesign can accidentally affect unrelated sections. Mitigation: keep CSS flat (no module migration mid-redesign) but use a clear naming convention for new selectors and verify with Playwright screenshots.

### Missing or ambiguous requirements
- **No component directory specified** — Plan says "shared components" but doesn't say where they live. Fix: mandate `apps/web/app/components/` with specific file names per subphase.
- **No artifact format for 7a design brief** — Output says "decision-complete redesign brief" but doesn't say where it's written or what format. Fix: 7a outputs a markdown file at `docs/planning/phase-7/a/brief.md`.
- **Typography decision unclear** — 7b says "typography pair and scale" but the current site already has Manrope + Space Grotesk. Plan doesn't say whether to keep, replace, or augment. This is a design decision for 7a.
- **No OG/social meta** — Marketing site redesign should include Open Graph images and social sharing metadata. Not mentioned anywhere.

### Repo mismatches (fix the plan)
- **No `apps/web/components/` directory** — must be created in 7b.
- **No Playwright test files** — must be scaffolded in 7e (or earlier). Test directory: `tests/` at repo root (collocated with `playwright.config.ts`).
- **`playwright.config.ts` has `headless: false`** — must be set to `true` (or env-configurable) for automated QA gates.

### Performance / timeouts
- **Hero SVG animation budget** — Current hero has 8 keyframe animations. Plan says "limited set of motion families" but doesn't specify a maximum. Fix: cap at 3-4 animation families for the hero, with a total animation budget of <2s for initial choreography.
- **CSS file size** — 1608 lines will likely grow during redesign. No budget set. Fix: aim to keep `globals.css` under 2000 lines; if it exceeds, consider splitting into `globals.css` + `animations.css`.

### Security / permissions
- **Form submission now real** — Forms will post to `FORM_WEBHOOK_URL` via Server Action. Mitigation: validate and sanitize all form inputs server-side in the Server Action. Rate-limit or honeypot the form to prevent spam. Never expose `FORM_WEBHOOK_URL` to the client.

### Testing / validation
- **No Playwright test scaffold exists** — 7e references Playwright verification but there are no test files. Fix: 7e must create test files, not just "run" tests.
- **No screenshot baseline exists** — Plan says "stable screenshots" but there's no existing baseline to compare against. Fix: 7e must establish the initial baseline as part of its output.
- **Build verification missing from 7b/7c/7d** — Each subphase that changes code should end with `npm run web:build` passing. Currently only 7e mentions verification.

## User Decisions (locked)

- [x] **Typography**: Keep Manrope (body) + Space Grotesk (display). Refine scale/weights only. No font change.
- [x] **Color palette**: Refine the current warm parchment palette. No major color direction shift.
- [x] **Forms**: REAL embedded forms. Not decorative. Create a Next.js Server Action (`apps/web/app/actions/submit-form.ts`) that posts to `FORM_WEBHOOK_URL` env var. Graceful degradation when env var is not set.
- [x] **Calendly**: Prepare a placeholder for Calendly embed. Use `NEXT_PUBLIC_CALENDLY_URL` env var. Show embed when set, hide when not.
- [x] **CTA copy**: Remove ALL "request teardown" language across both pages. Humanize using hormozi/humanizer/copywriting skills. Replace with clear, human language.
- [x] **Skills**: Explicitly invoke hormozi, humanizer, impeccable, copywriting, and frontend-design skills during execution. See Skill Invocation Map below.

## Skill Invocation Map

| Subphase | Skills to invoke |
|----------|-----------------|
| 7a | `find-local-skills`, `landing-page-architecture`, `hormozi-offers`, `hormozi-value-equation`, `hormozi-hooks`, `impeccable:critique`, `page-cro`, `copywriting` |
| 7b | `frontend-design`, `impeccable:normalize` |
| 7c | `frontend-design`, `impeccable:animate`, `impeccable:bolder`, `hormozi-hooks`, `copywriting`, `landing-page-architecture` |
| 7d | `hormozi-offers`, `hormozi-pricing`, `form-cro`, `page-cro`, `impeccable:clarify` |
| 7e | `humanizer`, `impeccable:polish`, `impeccable:critique`, `copywriting`, `form-cro`, `playwright-testing` |

## Form Implementation Strategy

1. Create `apps/web/app/actions/submit-form.ts` (Next.js Server Action):
   - Accepts: `name`, `email`, `brand/website`, optional fields
   - Posts to `FORM_WEBHOOK_URL` env var (Slack webhook, Zapier, Make, or any endpoint)
   - Returns success/error state to the client form component
   - If `FORM_WEBHOOK_URL` is not set: logs to console in dev, shows success UI anyway
2. Calendly embed:
   - If `NEXT_PUBLIC_CALENDLY_URL` is set, show an embedded Calendly widget or styled link
   - If not set, hide the Calendly section entirely
3. Remove all instances of "request teardown" — replace with humanized CTA copy

## Open Questions (resolved)

All open questions have been resolved by user input. See "User Decisions" above.

## Assumptions (Agent — remaining after user decisions)

- CSS stays as a single flat `globals.css` file (no CSS Modules or Tailwind migration). (confidence ~92%)
  - Mitigation: if componentized CSS is preferred, restructure in 7b using CSS Modules alongside the component extraction.

- Component extraction targets `apps/web/app/components/` as the shared directory. (confidence ~95%)
  - Mitigation: if a different convention is preferred (e.g., `apps/web/components/`), rename in 7b.

- The existing 9 brand logos in `public/logos/` are kept as-is. (confidence ~97%)
  - Mitigation: if logos should be updated/replaced, provide new assets before 7c execution.

- Playwright tests live in `tests/` at the repo root (next to `playwright.config.ts`). (confidence ~90%)
  - Mitigation: if tests should live inside `apps/web/`, update `playwright.config.ts` testDir accordingly.

- `FORM_WEBHOOK_URL` will be a server-only env var (not prefixed with `NEXT_PUBLIC_`). (confidence ~95%)
  - Mitigation: if the URL needs client-side access for some reason, add `NEXT_PUBLIC_` prefix and adjust security posture.

## Objectives
* [x] Lock a decision-complete redesign architecture for the homepage, pricing page, and shared shell.
* [x] Replace the current hero motion system with an original SVG-driven creator collage.
* [x] Differentiate homepage and pricing as separate funnel stages with clearer CTA hierarchy.
* [x] Rewrite core messaging to sound more human while explaining AI concretely.
* [x] Define build and Playwright gates that prove the redesign is visually and behaviorally stable.

## Constraints
- Scope is limited to the marketing surface in `apps/web`: `app/page.tsx`, `app/pricing/page.tsx`, `app/globals.css`, `app/layout.tsx`, plus new shared components in `app/components/`.
- Keep `NEXT_PUBLIC_BOOKING_URL` as a fallback CTA target. Add real form submission via a Next.js Server Action posting to `FORM_WEBHOOK_URL`. Add Calendly embed placeholder via `NEXT_PUBLIC_CALENDLY_URL`. No other backend changes or new route requirements.
- No copying competitor assets, code, layouts, or branded visual language from `refunnel.com` or `aha.inc`.
- Motion must stay purposeful and disciplined. Cap the hero at 3-4 motion families, provide a reduced-motion fallback, and avoid generic SaaS dashboard-flowchart tropes.
- Mobile CTA treatment must not cover hero content, pricing cards, or primary reading paths.
- Copy must go through a humanization pass after structural rewrites. AI should be described as ranking, detection, prioritization, and exception handling, not generic "AI-powered" hype. ALL instances of "request teardown", "book a teardown", "workflow teardown", and "map this phase" CTA language MUST be replaced with clear, human language.
- Respect the existing dirty worktree. Do not revert or reformat unrelated audit, planning, or screenshot files.
- Every subphase that changes code must pass `npm run web:build` before handing off.

## Success Criteria
- [x] Homepage, pricing page, and shared shell use a new visual system and no longer rely on the current repeated card-grid grammar.
- [x] The homepage hero uses a new original SVG scene that feels premium and memorable rather than explanatory or diagrammatic.
- [x] Pricing feels like a later-stage decision page, not a restyled version of the homepage.
- [x] CTA hierarchy is simplified, route metadata is route-specific, and the AI story is concrete and human.
- [x] Zero instances of "request teardown", "AI-powered", or "intelligent automation" in any marketing copy.
- [x] Forms submit real data via Server Action to `FORM_WEBHOOK_URL` (graceful degradation when unset).
- [x] Calendly embed appears when `NEXT_PUBLIC_CALENDLY_URL` is set, hidden when not.
- [x] `npm run web:build` passes after every subphase.
- [x] Playwright verification passes on `/` and `/pricing` for desktop and mobile with zero console errors, stable screenshots, and acceptable reduced-motion behavior.

## Subphase Index
* a - Lock redesign architecture, narrative, and motion direction (produces brief artifact)
* b - Extract shared shell, rebuild tokens/typography/motion foundation, split server/client components
* c - Rebuild the homepage and replace the hero SVG
* d - Rebuild pricing as a later-stage decision page
* e - Humanize copy, polish interactions, and verify with Playwright

## Phase Summary
- Executed all five subphases of the marketing redesign track.
- Created the decision brief at `docs/planning/phase-7/a/brief.md` and used it to drive the shell extraction, homepage rewrite, pricing rewrite, and QA gate.
- Reworked the marketing app surface in `apps/web` into shared components, route-specific metadata wrappers, a new homepage hero scene, and a shared real lead form backed by a Server Action.
- Added Playwright regression coverage and captured screenshot artifacts:
  - `tests/screenshots/home-desktop.png`
  - `tests/screenshots/home-mobile.png`
  - `tests/screenshots/pricing-desktop.png`
  - `tests/screenshots/pricing-mobile.png`
- Final validation:
  - `npm run web:build` - pass
  - `npx playwright test tests/marketing-redesign.spec.ts` - 9 passed, 1 skipped
