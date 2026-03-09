# RED TEAM Analysis — Phase Landing Redesign

> Generated 2026-03-09 via `phase-gaps` skill
> Subagent: seeding-tool-landing-page-phase-plan-gaps-rerun

---

## Original User Request Preserved

See `plan.md` — "Original User Request (verbatim)" section added 2026-03-09.
The AGENTS.md design context is the canonical spec anchor for all RED TEAM judgments below.

---

## Repo Reality Check ✅/❌

| Assertion | Status | Notes |
|-----------|--------|-------|
| `HeroScene.tsx` exists | ✅ | On `feature/hero-media-dock`, 739 lines |
| `HeroScene.module.css` exists | ✅ | On `feature/hero-media-dock`, 793 lines |
| `HomeContent.tsx` exists | ✅ | Updated on feature branch |
| `apps/web/app/globals.css` exists | ✅ | Both main + feature branch have it |
| `AGENTS.md` design context | ✅ | Light mode canonical spec confirmed |
| `docs/planning/phase-landing-redesign/plan.md` | ✅ | Existed pre-rerun, updated with verbatim section |
| Feature branch merged to main | ❌ | `feature/hero-media-dock` NOT merged. Required for subphase a |
| Guarantee section in HomeContent | ❓ | Not confirmed — requires grep check in subphase b |
| Footer component exists | ❓ | Not confirmed — requires check in subphase b |
| Turbopack config applied | ❓ | On feature branch only, not on main dirty tree |
| `design-tokens.md` artifact | ❌ | Does not exist yet — created in subphase c |

---

## RED TEAM Findings — Gaps / Weak Spots

### GAP 1 (CRITICAL): Plan/Reality Design Direction Conflict

**Status:** ❌ CRITICAL — Plan doc `plan.md` specified DARK frosted glass (oklch dark navy),
but AGENTS.md and the actual `feature/hero-media-dock` implementation use LIGHT MODE with
warm neutral gradients.

**Evidence:**
- `plan.md` (V1): "Background: deep navy `oklch(10% 0.03 260)`"
- `AGENTS.md`: "Light mode first. Warm neutral base, restrained accent color."
- `HeroScene.module.css` on feature branch: `rgba(255, 248, 241, 0.96)` (warm cream)

**Impact:** If any future agent reads the root plan.md and follows the dark palette, the
implementation will diverge from the canonical AGENTS.md spec. ALREADY happened once — the
feature branch author had to correct course based on AGENTS.md.

**Mitigation (applied in this RED TEAM pass):**
- Added `⚠️ SPEC CONFLICT` warning block to `plan.md` immediately after the verbatim section
- Updated `plan.md` to explicitly flag the dark brief as V1/superseded
- Subphase c Step 2 includes a grep for orphaned dark palette references

**Assumption:** `feature/hero-media-dock` implementation is authoritative. `(confidence ~95%)`

---

### GAP 2 (HIGH): GSAP/Lenis Deferred Without Plan Update

**Status:** ⚠️ HIGH — The root `plan.md` Phase 4 specifies GSAP + Lenis smooth scroll.
The implementation on `feature/hero-media-dock` uses a CUSTOM RAF loop with smoothstep easing,
no GSAP or Lenis.

**Why this matters:** If Phase 4 is executed by a new agent reading the plan, it will attempt
to install and configure GSAP, potentially overwriting the existing clean implementation.

**Mitigation:**
- Subphase `a/plan.md` documents the actual implementation (RAF + smoothstep) as canonical
- Subphase `c/plan.md` explicitly notes "No GSAP. No Lenis. Custom RAF loop. V1 plan superseded."
- Root `plan.md` Phase 4 left intact (verbatim preservation rule) but flagged via subphase index

**Open question (confidence ~72%):** Is there any intent to add GSAP for other sections
(feature grid stagger, stat counters) even though the hero animation doesn't need it?
If yes, GSAP install should be isolated to those sections. Current assumption: no GSAP.

---

### GAP 3 (HIGH): `feature/hero-media-dock` Not Merged

**Status:** ❌ HIGH — All animation work (739-line HeroScene, 793-line CSS module) lives on a
non-main branch. Until merged, subphases b/c/d cannot run on real code.

**Merge blockers to verify:**
1. `apps/web/app/globals.css` — feature branch modifies hero section. Check for dirty-tree conflicts.
2. `apps/web/package.json` — feature branch adds `dev:webpack` script. Low conflict risk.
3. `apps/web/next.config.mjs` — feature branch adds Turbopack config. Clean add.

**Command to verify pre-merge:**
```bash
git merge --no-commit --no-ff feature/hero-media-dock
git diff HEAD --stat
git merge --abort
```

**Mitigation:** Subphase `a/plan.md` Step 4 has the explicit merge command and conflict resolution
guide. No subphase b/c/d work should begin until merge confirmed.

---

### GAP 4 (MEDIUM): Guarantee Section + Footer Not Confirmed

**Status:** ⚠️ MEDIUM — Root `plan.md` Phase 3 specifies guarantee section (3 cards:
escrow / contract / verified traffic). `HomeContent.tsx` on feature branch has friction cards,
story steps, AI capabilities, evidence. Guarantee section not confirmed present.

**Impact:** Page missing a trust signal section. Not critical for launch but noted.

**Mitigation:** Subphase `b/plan.md` Step 2 has explicit grep to check + scaffold instructions.

---

### GAP 5 (MEDIUM): Multi-Agent Dirty-Tree Conflict — `package.json` (Root)

**Status:** ⚠️ MEDIUM — Root-level `package.json` is modified in the dirty tree (unrelated
platform work). The feature branch also modifies `apps/web/package.json` (different file).
These are separate files and should not conflict.

However: in a turborepo/monorepo setup, root `package.json` workspace resolution and
`apps/web/package.json` changes may both need `npm install` to reconcile.

**Concurrent agent note:** The dirty tree contains platform modifications across:
- `apps/web/lib/outreach/send-pipeline.ts`
- `apps/web/lib/unipile/send-dm.ts`
- `apps/web/app/(platform)/campaigns/[campaignId]/outreach/page.tsx`
- `apps/web/app/api/brands/[brandId]/route.ts`
- `apps/web/prisma/schema.prisma`

None of these files overlap with `(marketing)/` components. Safe to merge.

**Mitigation:** After merge, run `npm install` from monorepo root to ensure lock file is consistent.

---

### GAP 6 (MEDIUM): No Playwright Smoke Tests for Marketing Routes

**Status:** ⚠️ MEDIUM — The root `plan.md` Phase 6 specifies Playwright smoke tests for
the marketing page. No tests exist yet for `/(marketing)` routes. The existing test suite
(`apps/web/__tests__/`) covers webhooks only.

**Impact:** Regression risk on future deploys if hero animation breaks silently.

**Mitigation:**
- Subphase `d/plan.md` Step 2-3 covers manual browser verification as the gate
- Automated Playwright tests recommended as a post-QA-gate addition (not blocking)
- `browser-automation` skill can scaffold these

**Confidence:** ~88% that manual verification is sufficient for this phase; automated tests deferred.

---

### GAP 7 (LOW): Font Loading Not Verified

**Status:** ⚠️ LOW — The V1 plan identified font sprawl (5+ families) as a problem. Subphase
`c/plan.md` includes a verification step, but current font config not confirmed.

**Check:**
```bash
grep -n "font\|jakarta\|inter\|geist\|poppins\|dm.sans" apps/web/app/layout.tsx
```

Expected: Only Plus Jakarta Sans + Inter loaded via `next/font`. If Geist/Poppins/DM Sans
still present, remove in subphase c.

---

### GAP 8 (LOW): `design-tokens.md` Missing

**Status:** ⚠️ LOW — Root plan Phase 2 deliverable was `design-tokens.md`. Does not exist.

**Mitigation:** Created as explicit output of subphase `c/plan.md` Step 4.

---

## Multi-Agent Conflict Notes

### Files Modified in Dirty Tree That Touch Landing Page Work

| File | Dirty Tree | Feature Branch | Conflict? |
|------|-----------|----------------|-----------|
| `apps/web/app/globals.css` | ❌ (not in dirty tree) | ✅ Modified | None — feature changes isolated to hero section |
| `apps/web/app/(marketing)/components/HeroScene.tsx` | ❌ | ✅ | None — not in dirty tree |
| `apps/web/app/(marketing)/components/HeroScene.module.css` | ❌ | ✅ New file | None |
| `apps/web/app/(marketing)/components/HomeContent.tsx` | ❌ | ✅ Modified | None |
| `apps/web/package.json` | ❌ (root `package.json` modified, not apps/web) | ✅ Modified | Low — different scope |
| `apps/web/next.config.mjs` | ❌ | ✅ Modified | None |
| `apps/web/prisma/schema.prisma` | ✅ Modified | ❌ | None — feature branch doesn't touch schema |
| `apps/web/lib/outreach/send-pipeline.ts` | ✅ Modified | ❌ | None |
| `apps/web/lib/unipile/send-dm.ts` | ✅ Modified | ❌ | None |

**Verdict:** No blocking multi-agent conflicts. Platform work (dirty tree) and landing page
work (feature branch) operate in separate directory trees. Safe to merge independently.

**Coordination note:** The `feat/email-enrichment` branch (stale, listed in `git branch`) also
modifies platform files. Verify it's not rebased against main before landing page merge.

---

## RED TEAM Checklist Results

| Check | Status | Notes |
|-------|--------|-------|
| Referenced files exist | ✅ | All files verified on feature branch |
| File paths correct | ✅ | All paths confirmed |
| Schema changes needed | ✅ | None — landing page is pure frontend |
| Auth/secret checks | ✅ | N/A — marketing page is public |
| Input validation | ✅ | Lead form validation assumed in LeadForm component |
| Success criteria measurable | ✅ | Subphase d has falsifiable criteria |
| Reduced motion handled | ✅ | `prefersReducedMotion` wired throughout |
| Multi-agent overlap | ✅ | Documented — no blocking conflicts |
| Human input items | See below | 1 item below 84.7% confidence |
| Skills available | ✅ | All required skills installed |
| Original request preserved | ✅ | Added verbatim section to plan.md |

---

## Refined Execution Order

1. **Subphase a** — Merge `feature/hero-media-dock` to main + visual browser verify
2. **Subphase b** — Section audit + fill guarantee/footer gaps
3. **Subphase c** — Design token pass + `design-tokens.md` artifact
4. **Subphase d** — QA gate (screenshots, Lighthouse, AR sign-off)

No subphase can start until the prior one's success criteria are confirmed on disk.

---

## Assumptions (≥ 84.7% confidence)

- `feature/hero-media-dock` implementation is the authoritative spec (`~95%`)
- AGENTS.md light mode direction overrides V1 dark glass brief (`~97%`)
- No GSAP or Lenis needed — custom RAF loop is correct approach (`~88%`)
- Platform dirty-tree changes are safe to co-exist with landing page merge (`~92%`)
- Guarantee section needs to be added (not yet in HomeContent) (`~75%`)

---

## Open Questions (< 84.7% confidence)

### Q1: Is GSAP intended for any landing page sections beyond the hero?

- **Why it matters:** If yes, `npm install gsap` + section-specific GSAP inits needed in subphase b/c
- **Current default assumption:** No GSAP — use CSS transitions + IntersectionObserver for
  non-hero sections (`~72% confidence`)
- **What to confirm:** Check with AR whether feature grid stagger or stat counters need GSAP

### Q2: Is the guarantee section content confirmed for this version?

- **Why it matters:** If guarantee section is intentionally deferred (not in current build),
  subphase b should skip it rather than scaffold it
- **Current default assumption:** Guarantee section was in V1 plan and should be added (`~75%`)
- **What to confirm:** AR confirmation on whether guarantee/trust signal section is in scope
  for this redesign iteration

### Q3: Is the dark theme being kept for any section?

- **Why it matters:** The root plan.md Phase 3 CTA section says "full-width, dark, with background
  glow." If the CTA section intentionally uses a dark treatment, that's valid within a light-mode page.
- **Current default assumption:** Isolated dark CTA is acceptable (single section, clear visual
  break); full dark-mode theme is cancelled (`~80%`)
- **What to confirm:** Whether CTA section dark treatment is intended
