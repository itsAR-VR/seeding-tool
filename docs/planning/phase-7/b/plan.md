# Phase 7b - Extract shared shell, rebuild tokens/typography/motion foundation

## Focus
Create the shared component layer and design-system tokens that both routes will use. This is primarily a structural refactor: extract duplicated code into shared components, set up server/client page wrappers for per-route metadata, and define the new token system. Both pages must build and render correctly after this subphase with minimal visual change.

## Inputs
- `docs/planning/phase-7/a/brief.md` (design brief with component list and architecture decisions)
- `docs/planning/phase-7/plan.md` (constraints, RED TEAM findings)
- Current files:
  - `apps/web/app/page.tsx` (637 lines, `"use client"`)
  - `apps/web/app/pricing/page.tsx` (325 lines, `"use client"`)
  - `apps/web/app/globals.css` (1608 lines)
  - `apps/web/app/layout.tsx` (20 lines)

## Skills to invoke during this subphase
- `frontend-design` — production-grade component patterns
- `impeccable:normalize` — normalize tokens to design system

## Work

### Step 1 — Create the shared component directory
- Create `apps/web/app/components/` if it does not exist

### Step 2 — Extract shared utilities
- Create `apps/web/app/components/analytics.ts`:
  - Extract the `Window.dataLayer` declaration
  - Extract `trackEvent(event: string)` function
  - Extract `bookingUrl` and `isExternalBooking` constants
- Both pages import from this file instead of defining their own

### Step 3 — Extract the shared shell component
- Create `apps/web/app/components/Shell.tsx` (`"use client"`):
  - Props: `children`, `navItems` (array of links), `activeRoute` (optional)
  - Contains: skip link, noise layer, ambient blobs, `<header>` with nav + hamburger + CTA, `<footer>`, mobile CTA bar
  - Nav toggle state lives inside Shell
  - CTA in header uses `bookingUrl` from analytics module
- Both pages replace their inline shell with `<Shell>` wrapping their content

### Step 4 — Extract the CTA link component
- Create `apps/web/app/components/CtaLink.tsx` (`"use client"`):
  - Props: `className`, `label`, `event`
  - Uses `bookingUrl`, `isExternalBooking`, `trackEvent` from analytics module
- Replace all inline CTA anchor patterns in both pages

### Step 5 — Set up server/client page split for per-route metadata
- Refactor `apps/web/app/page.tsx`:
  - Remove `"use client"` from the file
  - Export `metadata` object with homepage-specific title, description, and OG tags
  - Move all client content into `apps/web/app/components/HomeContent.tsx` (`"use client"`)
  - `page.tsx` becomes: `export metadata = {...}; export default function Page() { return <HomeContent />; }`
- Refactor `apps/web/app/pricing/page.tsx`:
  - Same pattern: server component exports `metadata`, renders `<PricingContent />`
  - Client content moves to `apps/web/app/components/PricingContent.tsx`
- Update `apps/web/app/layout.tsx`:
  - Keep fonts and root layout
  - Remove the shared fallback `metadata` or keep it as a default that per-route overrides

### Step 6 — Define the new token system
- Update `:root` in `apps/web/app/globals.css`:
  - Refine/add typography scale tokens (if brief specifies changes)
  - Refine/add color tokens (if brief specifies changes)
  - Add spacing rhythm tokens if not present
  - Add motion timing tokens: `--hero-stagger`, `--section-reveal`, `--motion-budget` (max 2s for hero)
  - Keep existing tokens that aren't changing to avoid regressions

### Step 7 — Update metadata strategy
- Ensure homepage has its own title: e.g., "Seeding OS | Influencer Seeding Operating System"
- Ensure pricing has its own title: e.g., "Pricing | Seeding OS"
- Add OG description and type tags to both

### Step 8 — Preserve accessibility foundations
- Ensure Shell component preserves: focus-visible states, 44px touch targets, reduced-motion support, semantic heading flow, skip link
- Verify the `@media (prefers-reduced-motion: reduce)` rules in globals.css still apply after token changes

### Step 9 — Verify build
- Run `npm run web:build` (which runs `cd apps/web && npm run build`)
- Both routes must render with the extracted shell
- No console errors, no build errors

## Output
- New files created:
  - `apps/web/app/components/analytics.ts`
  - `apps/web/app/components/Shell.tsx`
  - `apps/web/app/components/CtaLink.tsx`
  - `apps/web/app/components/HomeContent.tsx`
  - `apps/web/app/components/PricingContent.tsx`
- Modified files:
  - `apps/web/app/page.tsx` (server component wrapper)
  - `apps/web/app/pricing/page.tsx` (server component wrapper)
  - `apps/web/app/layout.tsx` (metadata defaults updated)
  - `apps/web/app/globals.css` (token refinements)
- Both routes build, render, and show the extracted shell without visual regression

### Execution Result - 2026-03-05
- Created `apps/web/app/components/analytics.ts`, `CtaLink.tsx`, `MobileCta.tsx`, `Shell.tsx`, `HomeContent.tsx`, and `PricingContent.tsx`.
- Split both route entry files into server wrappers that export route-specific metadata and render client content components.
- Updated the root layout metadata defaults and added motion-token placeholders in `globals.css`.
- Verified the server/client split with `npm run web:build` successfully.

## Coordination Notes

**Integrated from Phase 7a brief:** route-specific metadata, shared shell extraction, and route-scoped CTA fallbacks.
**Files affected:** `apps/web/app/page.tsx`, `apps/web/app/pricing/page.tsx`, `apps/web/app/layout.tsx`, `apps/web/app/globals.css`, `apps/web/app/components/*`
**Potential conflicts with:** any uncommitted `apps/web` work outside this phase
**Integration notes:** kept the current visual output mostly intact in this subphase so the structural refactor could land before the larger redesign work in 7c and 7d.

## Handoff
Phase 7c applies the new visual system to the homepage, builds the new hero SVG, and restructures sections — all using the shared components and tokens from this subphase. The server/client page split is complete, so 7c only edits `HomeContent.tsx` and `globals.css`.

## Validation (RED TEAM)
- `npm run web:build` passes with zero errors
- `apps/web/app/components/` directory exists with at least 5 files (analytics, Shell, CtaLink, HomeContent, PricingContent)
- `apps/web/app/page.tsx` is NOT `"use client"` and exports `metadata`
- `apps/web/app/pricing/page.tsx` is NOT `"use client"` and exports `metadata`
- Both pages import Shell and render it
- No duplicate `trackEvent` or `bookingUrl` definitions across files
