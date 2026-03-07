# Phase 7a - Lock redesign architecture, narrative, and motion direction

## Focus
Define the final experience model before changing shared styles or route code. This subphase turns the current critique and user preferences into a decision-complete redesign brief written to disk.

## Inputs
- `docs/planning/phase-7/plan.md` (root plan with constraints and RED TEAM findings)
- `docs/planning/phase-6/plan.md` (CRO iteration log and funnel learnings)
- Current implementation:
  - `apps/web/app/page.tsx` (637 lines — homepage with inline SVG hero, nav, footer, all data arrays)
  - `apps/web/app/pricing/page.tsx` (325 lines — pricing with duplicated shell)
  - `apps/web/app/globals.css` (1608 lines — all styles, animations, responsive rules)
  - `apps/web/app/layout.tsx` (20 lines — Manrope + Space Grotesk fonts, single Metadata export)
- Browser and critique findings gathered from the local site, `refunnel.com`, and `aha.inc`

## Work
1. **Audit the current page architecture** — Read both page files and globals.css. Catalog every section, its purpose, and whether it survives, is rewritten, or removed.

2. **Define the role of each route:**
   - Homepage = stop, orient, prove, and bridge to action
   - Pricing = qualify, compare, reduce risk, and convert

3. **Lock the section model** — Replace the current section model with a tighter architecture that avoids repeated card-grid treatment and removes redundant CTA surfaces. Document the new section order and rationale for each route.

4. **Lock the copy posture:**
   - Keep "seeding operating system" as the top-line frame
   - Explain AI as the operational intelligence layer for ranking, detection, and exception handling
   - Ban vague hype and generic SaaS phrasing
   - **BANNED PHRASES**: "request teardown", "book a teardown", "workflow teardown", "map this phase", "AI-powered", "intelligent automation"
   - Use hormozi-hooks + copywriting skills to define replacement CTA language that is clear and human

5. **Define the homepage hero concept in detail:**
   - Kinetic creator-collage composition (not flowchart, not dashboard mock)
   - Allowed motion families (cap at 3-4 for the hero)
   - Reduced-motion fallback behavior
   - Explicit motifs to avoid: flowchart arrows, mini dashboard widgets, busy status-chip clutter, generic gradient orbs

6. **Make the component extraction decision:**
   - Document which elements become shared components in `apps/web/app/components/`
   - Minimum shared components to extract: `Shell.tsx` (nav + footer + ambient layers + skip link + noise), `CtaLink.tsx`, `MobileCta.tsx`, `analytics.ts` (trackEvent + dataLayer)
   - Decide whether to add more (FAQ primitive, proof strip, section wrapper)

7. **Make the metadata architecture decision:**
   - Current: both pages are `"use client"`, metadata in `layout.tsx` is shared
   - Required: per-route metadata (title, description, OG tags)
   - Solution: each page file becomes a server component that exports `metadata` and renders a `"use client"` content component
   - Document the file structure: e.g., `page.tsx` (server, exports metadata, renders `<HomeContent />`) + `components/HomeContent.tsx` (client)

8. **Typography and color (LOCKED):**
   - Typography: Manrope (body) + Space Grotesk (display) — confirmed, refine scale/weights only
   - Color: warm parchment palette — confirmed, refine tokens only, no major shift
   - Define any new token additions needed for the refined system

9. **Plan real form implementation:**
   - Forms must submit real data via Next.js Server Action (`apps/web/app/actions/submit-form.ts`)
   - Server Action posts to `FORM_WEBHOOK_URL` env var (Slack webhook, Zapier, Make, etc.)
   - Graceful degradation when env var is not set (success UI shown, data logged to console)
   - Add Calendly embed placeholder using `NEXT_PUBLIC_CALENDLY_URL` env var (visible when set, hidden when not)

10. **Decide which current content survives, is rewritten, or removed** across home and pricing.

11. **Define CTA language alternatives** — using hormozi-hooks and copywriting skills, provide 3-5 humanized CTA alternatives to replace "request teardown" across all surfaces.

## Skills to invoke during this subphase
- `find-local-skills` — preflight
- `landing-page-architecture` — conversion-focused section architecture
- `hormozi-offers` — Grand Slam Offer framing
- `hormozi-value-equation` — dream outcome / effort / time / risk
- `hormozi-hooks` — scroll-stopping headline and CTA alternatives
- `impeccable:critique` — evaluate current design
- `page-cro` — diagnose highest-friction sections
- `copywriting` — CTA language and narrative voice

## Output
- `docs/planning/phase-7/a/brief.md` — a decision-complete redesign brief covering:
  - Section order for homepage and pricing (with content survival/rewrite/remove map)
  - CTA hierarchy rules and humanized CTA copy alternatives (3-5 options to replace "request teardown")
  - Narrative posture and banned patterns (explicit list)
  - Hero motion concept with allowed/banned motifs
  - Component extraction plan (shared component list with file names)
  - Metadata architecture (server/client split strategy)
  - Typography (Manrope + Space Grotesk, scale refinements) and color token decisions (warm palette refinements)
  - Form implementation strategy (Server Action + webhook + Calendly placeholder)
  - Skill outputs and recommendations applied to section/copy decisions

### Execution Result - 2026-03-05
- Created `docs/planning/phase-7/a/brief.md`.
- Locked the route roles, section order, CTA replacements, hero-motion rules, component extraction list, metadata strategy, typography/color constraints, and form/calendly behavior.
- Merged unexpected concurrent plan expansion from the current untracked `phase-7` files into the brief rather than discarding it.

## Coordination Notes

**Integrated from concurrent local plan work:** the expanded `phase-7` files on disk added stricter requirements for real form submission, route-specific metadata, CTA bans, and component extraction.
**Files affected:** `docs/planning/phase-7/a/plan.md`, `docs/planning/phase-7/a/brief.md`
**Potential conflicts with:** `phase-6` marketing baseline and any uncommitted changes inside `apps/web`
**Integration notes:** treated the more detailed `phase-7` text as the active execution contract because it is newer than the initial scaffold and does not conflict with the user's stated redesign goal.

## Handoff
Phase 7b uses this brief to build the shared shell, extract components, set up server/client page wrappers, and define the token system. No content or IA decisions should be reopened in 7b.

## Validation (RED TEAM)
- `docs/planning/phase-7/a/brief.md` exists and is non-empty
- Brief covers all 7 decision areas listed in Output
- Brief contains explicit file paths for every planned new component
- No code changes in this subphase — it is planning-only

## Resolved Decisions (from user input)
- Typography: Manrope + Space Grotesk confirmed. Refine scale/weights only.
- Color: warm parchment palette confirmed. Refine tokens only.
- Forms: REAL submission via Server Action. Not decorative.
- CTA copy: "request teardown" banned. Humanize with skills.
