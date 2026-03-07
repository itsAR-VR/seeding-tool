# Phase 1 — Landing-page-first GTM + planning stack reindex

## Original User Request (verbatim)
Okay, so my brother  created a bunch of plans, and he filled out this GitHub repo that we're working in with a lot of details around the seeding tool.

Now, what I want to do is build a landing page for it. I want you to go ahead and take a look at all my skills that I have available, including the Hormozi skills, the impeccable design skills, and any other CRO skills—things like that, things for making the design better. Including skills for review and testing of the landing page (we want to start with local env before going to vercel or anything) and want to iterate multiple times to have the CRO we want, the structure thats ideal, the right copy and language and everything. Include the skills to call within the phase plan itself including the evaluation loop described with skills for that and everything else too (with playwright or whatever is best to make sure the platform works and looks at the level we want it)

I want you to take all of that and put it into a new plan. And make it phase-1 answap all other phases up a number. All the stuff that we have right now is the backend and architecture design of the actual app itself, right? But we also want to have a landing page that's associated with that, and that to be obviously the first thing we make. From there, we're building up a flow through all the other stuff, all the other details for what we're going to use.

We're using Supabase with a Prisma ORM, and we're deploying it with Next.js on Vercel. So we need to essentially create that landing page using the structure and all the details that we already have within the planning docs.

Right, and yeah, that's what is needing to be done now.


$phase-plan

## Purpose
Make landing page delivery the first execution phase, physically shift existing phases up one number, and ship a local-first Next.js landing page implementation aligned to CRO, Hormozi offer framing, and motion/design quality requirements.

## Context
Existing planning was architecture/audit focused. This phase reorders execution so GTM starts with a single high-converting landing page.

Locked decisions:
- Primary CTA: `Book demo`
- Single-page homepage scope in this phase
- No public pricing table on homepage
- Separate pricing page deferred to next phase
- Pricing framing: lowest tier starts at `$999/month`; upper tiers are `Contact us`
- Free social listening included across tiers
- Booking destination contract: `NEXT_PUBLIC_BOOKING_URL`
- Repo layout: `apps/web` for Next.js app
- Physical phase reindex required

## Concurrent Phases
| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 2 | Historical | Old phase-1 content | Reindexed from previous numbering |
| Phase 3 | Historical | Old phase-2 content | Reindexed from previous numbering |
| Phase 4 | Historical | Old phase-3 content | Reindexed from previous numbering |
| Phase 5 | Historical | Old phase-4 content | Reindexed from previous numbering |

## Objectives
- [x] Physically renumber old phases (`1..4` -> `2..5`)
- [x] Create new canonical `docs/planning/phase-1/`
- [x] Scaffold `apps/web` Next.js landing app
- [x] Implement one-page demo-first landing experience and copy
- [x] Encode offer and pricing-positioning constraints in content
- [x] Document evaluation loop and CRO backlog for next iteration

## Constraints
- Preserve old planning content while shifting numbering.
- Keep landing page local-first and deployment-agnostic.
- Do not expose full pricing matrix on homepage.
- Use only source-grounded claims and placeholders for proof where real assets are missing.

## Success Criteria
- [x] `docs/planning/phase-1/plan.md` exists with subphases `a..f`
- [x] Old phases now exist as `phase-2` to `phase-5`
- [x] Planning references updated to new numbering
- [x] `apps/web` contains runnable Next.js App Router scaffold
- [x] Homepage includes approved core copy line and problem-flow framing
- [x] Homepage CTA wiring uses `NEXT_PUBLIC_BOOKING_URL`
- [x] Local Playwright verification run with screenshots/log checks

## Subphase Index
- a — Reindex phases and rewrite planning references
- b — Landing-page strategy, IA, and offer architecture
- c — Conversion copy system + proof map + objection map
- d — Next.js implementation scaffold in `apps/web`
- e — Motion/design quality + accessibility/responsive hardening
- f — Local evaluation loop + CRO experiment backlog + handoff

## Phase Summary
Implemented the full planning reindex and created a new canonical Phase 1. Added `apps/web` with a production-style one-page landing page focused on `Book demo` conversion, with Refunnel-inspired motion patterns, Hormozi-style offer framing, and constrained pricing messaging (`$999/mo` floor + contact-us tiers).

Artifacts:
- Planning: `docs/planning/phase-1/` (+ reindexed existing phases)
- Web app: `apps/web/`

Follow-up:
- Execute local Playwright QA pass against `apps/web` and capture evidence.
- Build deferred `/pricing` page in the next phase.

## Terminus Maximus Completion Pass — 2026-03-02
- Completed deep Refunnel/Aha-inspired landing page implementation in `apps/web/app/page.tsx` with conversion-first section flow.
- Implemented deferred pricing page in `apps/web/app/pricing/page.tsx`.
- Deferred Calendly specifically; CTA remains env-driven via `NEXT_PUBLIC_BOOKING_URL`.
- Ran local Playwright QA against `http://127.0.0.1:3001/` and `http://127.0.0.1:3001/pricing` with no console errors.
- Fixed post-redesign visibility bug by adjusting reveal behavior in `apps/web/app/globals.css` so below-fold content is visible without scroll intersection.
- Evidence screenshots captured: `landing-after-fix.png`, `pricing-after-redesign.png`.
- Status: Complete.
