# Landing-Page: Main Branch Audit
> Generated 2026-03-09 by podhi-orchestrator controller run
> Mandate: AR requirement — evaluate prior frontend work already on `main`, not yet live on domain.
> Evidence source: git log, file inspection, screenshot analysis from `tests/screenshots/home-desktop.png`

---

## Commits Reviewed

| Commit | Date | Author | Summary |
|--------|------|--------|---------|
| `c8c09c9` | 2026-03-09 08:25 | itsAR-VR | MERGE: hero carousel-dock animation from `feature/hero-media-dock` → main |
| `134df8c` | 2026-03-09 03:47 | itsAR-VR | feat(marketing): replay landing redesign on latest platform sync |
| `8769653` | earlier | itsAR-VR | docs: phase-11 planning docs |
| `c6b9995` | earlier | itsAR-VR | docs: phase-10 plan + collabstr scrape runbook |
| `c606e64` | earlier | itsAR-VR | docs(landing-redesign): add phase-plan subphase docs, red-team analysis, design-tokens artifact |

**Head commit is `c8c09c9`** — a merge from `feature/hero-media-dock`. This is the definitive state for all analysis below.

---

## Files Changed in c8c09c9 (frontend-relevant diff)

```
apps/web/app/(marketing)/components/HeroScene.module.css  +793 lines (NEW)
apps/web/app/(marketing)/components/HeroScene.tsx         +814 lines (rewritten)
apps/web/app/(marketing)/components/HomeContent.tsx       +52  / -36 (updated imports, HeroScene wired in)
apps/web/app/(marketing)/components/LeadForm.tsx          +14 lines (minor)
apps/web/app/globals.css                                  +193 / -many (hero-shell, hero-grid, hero-frost overhaul)
apps/web/next.config.mjs                                  +8 (Turbopack root config added)
apps/web/package.json                                     +1 dep (minor)
tests/hero-media-stage.spec.ts                            +210 lines (NEW spec)
tests/screenshots/home-desktop.png                        updated (1440×6396, 1.6MB)
tests/screenshots/home-mobile.png                         updated
tests/screenshots/pricing-desktop.png                     updated
tests/screenshots/pricing-mobile.png                      updated
docs/planning/phase-10/*                                  (planning docs, see below)
docs/planning/phase-11/*                                  (planning docs)
docs/planning/phase-12/*                                  (planning docs)
```

---

## Five-Category Breakdown

### Category 1: Landed on `main`, NOT yet live on domain

All of the following are committed to `main` as of `c8c09c9` but the domain (aha.inc or whatever production URL) is not pointing to this build:

| File/Feature | Commit | What it does |
|---|---|---|
| `HeroScene.tsx` (739 lines active) | c8c09c9 | Scroll-progress carousel → dock animation, custom RAF, no GSAP |
| `HeroScene.module.css` (793 lines) | c8c09c9 | Full CSS spec for carousel slots, dock states, scroll-linked transforms |
| `HomeContent.tsx` updated | c8c09c9 | Renders `<HeroScene />` in hero-shell section; data-reveal on all below-fold sections |
| `globals.css` hero overhaul | c8c09c9 | hero-shell, hero-grid, hero-frost, hero-stage-panel CSS rules (+193 lines) |
| `next.config.mjs` Turbopack | c8c09c9 | `turbopack: { root: __dirname }` added |
| `tests/hero-media-stage.spec.ts` | c8c09c9 | 210-line Playwright spec for the carousel-dock motion model |
| Phase 10/11/12 planning docs | c8c09c9 + 8769653 | Strategic plans for next phases |

**Risk note:** The `tests/screenshots/` snapshots in the repo reflect the dev-server state as of the feature branch merge and are NOT production screenshots.

---

### Category 2: Worth Keeping As-Is

| Item | Rationale |
|---|---|
| `HeroScene.tsx` carousel mechanism | Custom RAF loop with smoothstep easing — no GSAP dependency, performant, follows AGENTS.md light-mode spec. RED TEAM approved 2026-03-09. |
| `HeroScene.module.css` CSS approach | CSS-driven dock transforms are correct choice for this motion type — scroll-linked CSS vars update from RAF. Zero layout shift risk. |
| `HomeContent.tsx` section structure | Section skeleton (pain-strip, workflow-story, intelligence-section, evidence-wall) is correct. CSS class names match globals.css spec. |
| `globals.css` hero section | hero-shell and related rules are coherent and match warm light-mode AGENTS.md direction. |
| Turbopack config | Low-risk dev speed improvement. |
| `tests/hero-media-stage.spec.ts` | 210-line spec is real coverage. Keep and update as phase 12 restructure lands. |
| Credit system (`lib/credits.ts`) | Full ledger implementation. Keep as-is. |
| `lib/workers/creator-search.ts` | Real pipeline, not stubbed. Worker + local fallback pattern is correct. Keep. |

---

### Category 3: Worth Reworking

| Item | Why Rework | Evidence |
|---|---|---|
| **Phase 12 architectural split** | `HeroScene.tsx` currently combines carousel + dashboard dock in one component. AR's Phase 12 spec requires separating these into (a) standalone reel carousel and (b) dashboard showcase below. The plan is written, implementation not done. | Phase 12 `plan.md` success criteria marked `[x]` are FALSE — no `HeroCarousel.tsx`, `DashboardShowcase.tsx` or separate components exist. |
| **data-reveal IntersectionObserver pattern** | CRITICAL: All below-fold sections (pain-strip, workflow-story, intelligence, evidence) use `data-reveal` + IntersectionObserver which starts sections at `opacity: 0`. In screenshots and initial render they are INVISIBLE. This is the same regression pattern as the Z2A animation bug. | Screenshot `home-desktop.png` confirms: hero renders, entire mid-page is blank, only footer visible. Sections exist in DOM but invisible without scroll. |
| `HomeContent.tsx` static sections | Planned for Phase 11 GSAP animations. Current CSS-only reveals work but Phase 11 calls for narrative motion replacements (PainChaosAnimation etc.). | Phase 11 plan docs exist. No animation code yet. |

---

### Category 4: Should Be Reverted / Ignored

| Item | Reason |
|---|---|
| **Phase 12 `[x]` success criteria in `plan.md`** | These are FALSE. The structural split was never implemented. Do not treat as complete. The checkboxes were written aspirationally and merged before implementation. |
| **V1 dark frosted glass palette in `plan.md`** | Superseded by AGENTS.md. `plan.md` already has `⚠️ SPEC CONFLICT` warning block added by RED TEAM. Do NOT follow dark palette. Canonical spec is light mode, warm neutral base. |
| **`feature/hero-media-dock` branch** | Already merged to main. No need to reference this branch further. |
| **GSAP/Lenis mentions in root `plan.md` Phase 4** | Implementation uses custom RAF loop. GSAP was deemed unnecessary for the hero. This Phase 4 plan entry is obsolete. Phase 11 still calls for GSAP in content sections — that is separate scope. |

---

### Category 5: Still Missing

| Gap | Phase | Priority |
|---|---|---|
| **Phase 12 structural split** — separate `HeroCarousel.tsx` from `DashboardShowcase.tsx` | Phase 12 | HIGH (AR spec requirement) |
| **data-reveal fix** — sections below hero invisible on initial load; need scroll-trigger alternative or SSR-safe reveal | Immediate fix needed | CRITICAL |
| **Phase 11 GSAP animations** — `PainChaosAnimation.tsx`, `WorkflowPipelineAnimation.tsx`, `AINetworkAnimation.tsx`, `EvidenceRevealAnimation.tsx` | Phase 11 a/b/c/d | HIGH |
| **GSAP not installed** — `gsap` and `@gsap/react` absent from `apps/web/package.json` | Phase 11a prerequisite | BLOCKS Phase 11 |
| **Lenis not installed** — removed from plan but if still desired for content sections, not installed | Phase TBD | LOW |
| **Mobile verification** — `home-mobile.png` updated but no independent audit of Phase 10+11 design on 375px | Before any prod deploy | HIGH |
| **Lighthouse / perf soak** | Phase 6 (soak) | MEDIUM |
| **Phase 12 Playwright spec update** — `tests/hero-media-stage.spec.ts` currently asserts old single-stage dock behavior, will need new section-aware assertions post-restructure | After Phase 12 | MEDIUM |
| **Footer component verification** — footer links (Workflow, A-team, Proof, Pricing) confirmed in screenshot but anchor targets need to exist in DOM | Before prod deploy | MEDIUM |

---

## Screenshot Evidence

**Source:** `tests/screenshots/home-desktop.png` (1440×6396, generated by Playwright at merge time)

**Confirmed present:**
- Hero section rendering: ✅ (headline, CTA buttons, HeroScene card visible)
- Light-mode warm palette: ✅ (off-white/cream background, navy text)
- Footer: ✅ (SEEDING OS branding, nav links)

**Confirmed missing from visual render:**
- pain-strip section: ❌ (invisible — data-reveal opacity:0)
- workflow-story section: ❌ (invisible)
- intelligence-section: ❌ (invisible)
- evidence-wall section: ❌ (invisible)
- proof-rail section: ❌ (invisible or not confirmed present)

This is a **regression** caused by `data-reveal` + IntersectionObserver not firing in Playwright's non-scroll render. Same pattern as Z2A animation regression from memory. Must be fixed before production.

---

## Spec Conformance

| AGENTS.md Requirement | Status |
|---|---|
| Light mode, warm neutral base | ✅ Correct — rgba(255,248,241,0.96) in HeroScene.module.css |
| One dominant action per viewport | ✅ Hero CTA is primary |
| Motion clarifies state, not decoration | ✅ Carousel→dock tells product story |
| Mobile calmer than desktop | ⚠️ Not independently verified |
| GSAP as hero animation | ❌ Intentionally replaced with custom RAF — correct per plan |
| Frosted glass dark navy V1 spec | ❌ Superseded — light mode canonical |

---

*End of audit. See `phase-gaps.md` for integration plan.*
