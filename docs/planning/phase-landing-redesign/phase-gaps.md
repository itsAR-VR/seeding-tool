# phase-gaps.md — Landing Page Integration Plan
> Generated 2026-03-09 by podhi-orchestrator controller run
> Source: `main-branch-audit.md` + red-team.md synthesis
> AR requirement: update planning artifacts with 5-category breakdown, concrete evidence, integration plan

---

## Current State Summary

- **What shipped to `main`:** Phase 10 + Phase 11 subphase-a = HeroScene.tsx carousel-dock animation, CSS revamp, Turbopack config. Commit `c8c09c9`.
- **What's NOT live on domain:** Everything. Vercel hasn't deployed this main branch build yet.
- **Critical regression on `main`:** `data-reveal` + IntersectionObserver = all below-fold sections invisible on initial render/screenshot. Must fix before any prod deploy.
- **Phase 12 status:** Plan exists with `[x]` checkboxes. Code does NOT exist. Plan is aspirational/incorrect.

---

## Gap Registry

### GAP-LP-01: data-reveal invisible sections (CRITICAL, blocks prod)

**Evidence:** `tests/screenshots/home-desktop.png` confirms pain-strip, workflow-story, intelligence-section, evidence-wall sections all invisible (blank space between hero and footer).

**Root cause:** `data-reveal` CSS pattern starts sections at `opacity: 0; transform: translateY(24px)`. `HomeContent.tsx` adds `is-visible` class via IntersectionObserver. Without scroll, IntersectionObserver never fires → sections stay invisible.

**Fix options (ordered by risk):**
1. **LOW RISK (recommended):** Add `data-reveal-immediate` to sections that are in the initial viewport + set a short timeout fallback that adds `is-visible` to all unrevealed elements after 100ms (covers Playwright + slow scroll cases).
2. **MEDIUM RISK:** Replace IntersectionObserver with scroll-aware check that also fires on DOMContentLoaded if element is already in viewport.
3. **HIGH RISK:** Remove data-reveal entirely and replace with CSS-only transitions (breaks Phase 11 animation intent).

**Recommended fix:** Option 1 — timeout fallback. Add to `HomeContent.tsx` useEffect:
```ts
// After IntersectionObserver setup:
const fallback = setTimeout(() => {
  document.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
}, 150);
return () => { clearTimeout(fallback); observer.disconnect(); };
```

**Priority:** CRITICAL. Fix in next Codex run before any other Phase 11/12 work.

---

### GAP-LP-02: Phase 12 structural split (HIGH, AR spec)

**Evidence:** `docs/planning/phase-12/plan.md` success criteria has `[x]` checkboxes but no `HeroCarousel.tsx`, `DashboardShowcase.tsx`, or structural change in codebase. Current `HeroScene.tsx` combines both.

**AR spec (verbatim from plan.md):**
> Two full-scale Reels shown independently, then the dashboard below the hero. As you scroll, Reels get pulled down into the dashboard.

**Current state:** HeroScene.tsx has carousel + dashboard chrome in one 739-line component. Not wrong, but not the split AR described.

**Integration plan:**
1. Phase 12a: Refactor HeroScene.tsx → `HeroCarousel.tsx` (standalone) + `DashboardShowcase.tsx`
2. Phase 12b: Implement scroll handoff — reel cards animate out of carousel and into DashboardShowcase.mentions area
3. Phase 12c: Update `HomeContent.tsx` to compose new split sections in order: HeroCarousel → DashboardShowcase → proof-rail → rest
4. Phase 12c: Update `tests/hero-media-stage.spec.ts` to cover new section order

**Low-risk integration check:** Read current HeroScene.tsx lines 1-100 to identify component boundary. Separation should be clean — carousel state (`currentSlot`, scroll progress) stays in HeroCarousel; dashboard data rows are static in DashboardShowcase.

**Estimated scope:** Medium (350-400 LOC refactor, 100 LOC new spec).

---

### GAP-LP-03: Phase 11 GSAP animations not built (HIGH)

**Evidence:** Phase 11a/b/c/d planning docs exist but:
- No `animations/` directory in `apps/web/app/(marketing)/components/`
- `gsap` NOT in `apps/web/package.json`
- No `PainChaosAnimation.tsx`, `WorkflowPipelineAnimation.tsx`, `AINetworkAnimation.tsx`, `EvidenceRevealAnimation.tsx`

**Current state of sections:**
- `pain-strip` → static CSS pain-card grid (CSS-only)
- `workflow-story` → static CSS story-rail + story-card
- `intelligence-section` → static CSS intelligence-grid
- `evidence-wall` → static CSS evidence-card grid

All use `data-reveal` → affected by GAP-LP-01.

**Integration plan for Phase 11:**
- **Prerequisite:** GAP-LP-01 must be fixed first (sections need to be visible)
- **Phase 11a:** `cd apps/web && npm install gsap @gsap/react` + scaffold 4 stub components
- **Phase 11b:** Implement PainChaosAnimation + AINetworkAnimation (stateless scroll reveals)
- **Phase 11c:** Implement WorkflowPipelineAnimation (pinned ScrollTrigger scrub)
- **Phase 11d:** Implement EvidenceRevealAnimation + final integration in HomeContent.tsx

**Dependency order:** GAP-LP-01 fix → Phase 11a → 11b → 11c → 11d → Phase 12

---

### GAP-LP-04: Phase 12 [x] checkboxes are false (IGNORE/REVOKE)

**Status:** DO NOT TREAT AS DONE. The `docs/planning/phase-12/plan.md` success criteria has `[x]` items that were written speculatively. No code supports them.

**Action:** Added `STATUS: NOT IMPLEMENTED — checkboxes incorrect` note to phase-12 plan below.

---

### GAP-LP-05: Mobile verification gap (HIGH, before prod)

**Evidence:** `tests/screenshots/home-mobile.png` was updated but no independent audit of 375px viewport for Phase 10+11 changes.

**Risk:** HeroScene carousel at mobile breakpoint may have layout issues. HeroScene.module.css has mobile rules but they haven't been independently screenshotted outside of the Playwright run.

**Integration plan:** Browser QA lane will screenshot mobile viewport once dev server is confirmed running.

---

### GAP-LP-06: Vercel production deploy not triggered (MEDIUM)

**Status per AGENTS.md deploy rule (HARD):** Do NOT deploy to Vercel in dev/test loop. Push to GitHub only. Production deploys happen separately/manually.

**Current state:** `main` has Phase 10+11 work. Vercel project `seed-scale` is configured with `rootDirectory=apps/web`, `nodeVersion=22.x`, commit author rebase applied. A manual Vercel redeploy will push this to production.

**Gate before prod deploy:**
1. GAP-LP-01 fix deployed to main
2. Data-reveal sections confirmed visible in screenshots
3. AR sign-off

---

## Integration Execution Order

```
1. FIX GAP-LP-01 (data-reveal fallback) → commit → push → screenshot verify
2. Phase 12 implementation (HeroCarousel + DashboardShowcase split) → commit → push
3. Phase 11a (GSAP install + scaffold) → commit
4. Phase 11b → 11c → 11d (GSAP animations) → commit
5. Phase 6 soak (Lighthouse, cross-browser, mobile QA)
6. AR sign-off → Vercel production deploy
```

---

## What Can Be Integrated Immediately (Low Risk)

| Action | Risk | Rationale |
|---|---|---|
| Add data-reveal timeout fallback | LOW | 3-line useEffect change; doesn't break any existing behavior; unblocks all below-fold sections |
| Correct Phase 12 plan.md [x] checkboxes | ZERO | Docs update only |
| Update phase-11 a/plan.md to reflect GSAP not yet installed | ZERO | Docs sync |

**Recommendation:** Ship the data-reveal fix (GAP-LP-01) immediately in the next Codex run. Everything else gates on that.

---

*Cross-reference: `main-branch-audit.md`, `red-team.md`, `plan.md`*
