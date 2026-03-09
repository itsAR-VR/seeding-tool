# Phase 13a — Sync Release Posture, Logout, and Placeholder Cleanup

## Focus
Start from the correct remote baseline, then land the smallest shell/marketing fixes that unblock a trustworthy production release: fast-forward `main`, add a real logout path, and remove the example-logo proof rail from the marketing homepage.

## Inputs
- Root phase contract: `docs/planning/phase-13/plan.md`
- Current branch state: `main` behind `origin/main` by docs-only commit `681138c`
- Platform shell: `apps/web/app/(platform)/layout.tsx`
- Auth/session helpers: `apps/web/lib/supabase/server.ts`, `apps/web/lib/supabase/middleware.ts`
- Marketing placeholder proof surface: `apps/web/app/(marketing)/components/HomeContent.tsx`

## Skills Available for This Subphase
- `find-local-skills` output: unavailable in this session; fallback is manual local-skill selection.
- `find-skills` output: unavailable in this session; fallback is installed-skill-only planning.
- Planned invocations:
  - `javascript-typescript`
  - `react-dev`
  - `backend-development`
  - `playwright-testing`
  - `frontend-design`

## Work
1. Fast-forward `main` to `origin/main`:
   ```bash
   git pull --ff-only origin main
   ```
   Verify: `git log --oneline -3` shows `681138c` at HEAD.
2. Create `POST /api/auth/logout` route at `apps/web/app/api/auth/logout/route.ts`:
   - Call `supabase.auth.signOut()` via server-side `createClient()` (this clears auth cookies set by `@supabase/ssr`)
   - Return `302` redirect to `/login`
   - No request body needed; POST-only to prevent CSRF via link prefetch
3. Add a `Logout` button in `apps/web/app/(platform)/layout.tsx`:
   - Place below the user email display (line ~54)
   - Use a `<form action="/api/auth/logout" method="POST">` wrapper (works without JS)
   - Style as a subtle text button matching sidebar aesthetic
4. Remove the `logoRail` constant (lines 10-20) and the entire `.proof-rail` section (lines 162-183) from `apps/web/app/(marketing)/components/HomeContent.tsx`.
   - Check `apps/web/app/globals.css` for `.proof-rail`, `.brand-band`, `.brand-band-track`, `.brand-mark` styles — remove or leave (no runtime harm if unused CSS remains)
   - Verify the page doesn't collapse: the section above (hero) and below should still flow cleanly
5. Establish the production QA baseline for this phase:
   - target tenant: `SleepKalm/ClubKalm`
   - live sender path: `ar@soramedia.co`
   - no shared-team-email migration in this phase

## Validation (RED TEAM)
- `curl -X POST http://localhost:3000/api/auth/logout` returns 302 to `/login`
- Platform sidebar shows Logout button; clicking it ends session and redirects
- Marketing homepage loads without logo rail; no blank space or layout collapse
- `git log --oneline -1` shows the fast-forwarded commit

## Output
- `main` fast-forwarded to `681138c docs(fly): add deploy status and blocker notes for creator-search worker`
- `apps/web/app/api/auth/logout/route.ts` added with server-side Supabase `auth.signOut()` + redirect to `/login`
- `apps/web/app/(platform)/layout.tsx` now exposes a sidebar `Logout` form under the signed-in email
- `apps/web/app/(marketing)/components/HomeContent.tsx` and `apps/web/app/globals.css` no longer render/style the example-logo proof rail

## Handoff
13b can start from the synced baseline. The only remaining global blockers are unrelated repo issues discovered during validation: repo-wide lint fails on `apps/web/lib/brands/icp.ts` (`no-explicit-any`) and `next build` fails on `apps/web/app/api/billing/balance/route.ts` because `prisma.brandCreditBalance` is missing from the generated Prisma client types.

## Progress This Turn (Terminus Maximus)
- Work done:
  - Fast-forwarded `main` to `origin/main` (`681138c`) before any code edits.
  - Added `POST /api/auth/logout` using the existing server-side Supabase client so auth cookies clear through `auth.signOut()` before redirecting to `/login`.
  - Added a no-JS logout form to the platform sidebar.
  - Removed the marketing proof rail markup and its unused CSS so the homepage no longer shows example logos.
  - Reverted the generated `apps/web/next-env.d.ts` churn created by `next build` so the diff stays scoped to 13a.
- Commands run:
  - `git pull --ff-only origin main` — pass; fast-forwarded `main` from `d309d73` to `681138c`
  - `npm run lint -- app/api/auth/logout/route.ts "app/(platform)/layout.tsx" "app/(marketing)/components/HomeContent.tsx"` — fail as a repo-wide script; surfaced pre-existing lint error in `apps/web/lib/brands/icp.ts`
  - `npx eslint app/api/auth/logout/route.ts "app/(platform)/layout.tsx" "app/(marketing)/components/HomeContent.tsx"` — pass
  - `npm run build` — fail; existing unrelated TypeScript/Prisma error in `apps/web/app/api/billing/balance/route.ts`
- Blockers:
  - Repo-wide quality gates are not green yet because of pre-existing issues outside 13a scope.
  - Browser-click verification of logout was not run in this turn because no local server session was started.
- Next concrete steps:
  - Start 13b by extracting the category source-of-truth from the March 1 n8n audit files.
  - Keep the unrelated `icp.ts` lint error and billing-balance Prisma typing error tracked as cross-phase blockers until their owning work is addressed.
  - Add a local browser verification pass once the next implementation batch is ready or when a server session is running.
