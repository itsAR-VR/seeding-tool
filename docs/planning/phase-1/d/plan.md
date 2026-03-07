# Phase 1d — Next.js implementation scaffold in apps/web

## Focus
Ship a local-first Next.js App Router implementation for the landing page.

## Inputs
- IA and copy decisions from prior subphases
- Repo layout decision: `apps/web`

## Work
1. Create standalone Next.js app scaffold under `apps/web`.
2. Add global styles, layout, and homepage route.
3. Wire all demo CTAs through `NEXT_PUBLIC_BOOKING_URL`.
4. Add lightweight event contract stubs for analytics handoff.

## Output
Created files:
- `apps/web/package.json`
- `apps/web/next.config.ts`
- `apps/web/tsconfig.json`
- `apps/web/next-env.d.ts`
- `apps/web/.env.example`
- `apps/web/.gitignore`
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/globals.css`
- `apps/web/README.md`

## Handoff
Proceed to Phase 1e for design-quality hardening and motion/accessibility polish.
