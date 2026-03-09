# Phase 12b — Implement the new reel carousel, dashboard showcase, and responsive dock choreography

## Focus
Build the new carousel and dashboard showcase using the shared motion model, then tune the desktop and mobile choreography so the handoff reads clearly and calmly.

## Inputs
- Phase 12a output
- `apps/web/app/(marketing)/components/HomeContent.tsx`
- `apps/web/app/(marketing)/components/HeroScene.tsx`
- `apps/web/app/(marketing)/components/HeroScene.module.css`
- `apps/web/app/globals.css`
- `apps/web/app/(platform)/dashboard/page.tsx`

## Work
1. Implement the reel-first hero carousel with 2 dominant reels and supporting side previews.
2. Build the marketing-derived dashboard showcase below it with a visible mentions landing zone.
3. Animate 4 reel items into the mentions area on scroll.
4. Add simplified mobile and reduced-motion variants.

## Validation
- Desktop and mobile browser captures show the new section order and the dock target clearly.
- No clipping or overlap into the copy column.

## Output
- `apps/web/app/(marketing)/components/HeroScene.tsx`
  - Added the reel-first carousel, four-item dock logic for desktop, simplified two-item dock logic for mobile, reduced-motion fallback, and the dashboard-derived mentions target.
- `apps/web/app/(marketing)/components/HeroScene.module.css`
  - Replaced the old single-stage dashboard styling with a new corridor layout, editorial carousel panel, marketing-derived dashboard showcase, and responsive motion-safe poster styling.
- Browser iteration artifacts
  - Verified the new top-state and dock-state geometry with local Playwright captures before updating the automated test contract.

## Coordination Notes
- Kept the proof rail, pain strip, workflow story, AI section, pricing bridge, and lead capture sections intact.
- Borrowed structure from `apps/web/app/(platform)/dashboard/page.tsx` for metrics, recent campaigns, action queue, and recent mentions while keeping the marketing version static.

## Handoff
Phase 12c should refresh automated coverage and write the final phase summary/review artifacts against the new corridor behavior.
