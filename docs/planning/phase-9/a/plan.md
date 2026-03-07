# Phase 9a — Bootstrap app runtime, full Tailwind migration, all 3 route groups, env normalization, and shared infrastructure scaffolding

## Focus
Convert `apps/web` from a marketing-only Next.js app into a real platform runtime foundation. This subphase does three major things beyond the standard bootstrap: (1) migrates all 2,960 lines of hand-written CSS to Tailwind 4, (2) moves marketing into a `(marketing)/` route group alongside new `(auth)/` and `(platform)/` groups, and (3) establishes the dependency graph, directory layout, and shared infrastructure files that every later subphase depends on.

## Inputs
- `docs/planning/phase-9/plan.md` (locked decisions)
- `docs/planning/phase-8/finalplan.md`
- `docs/planning/phase-8/review.md`
- `docs/planning/phase-8/a/architecture.md`
- `apps/web/package.json` (current: next ^15.0.0, react ^19, react-dom ^19, typescript ^5.9 — zero backend deps)
- `apps/web/app/layout.tsx` (24 lines: Manrope + Space_Grotesk fonts, clean root layout, imports `./globals.css`)
- `apps/web/.env.example` (currently 1 line: `NEXT_PUBLIC_BOOKING_URL` only)
- `apps/web/.env.local` (exists, has real marketing values — must not be committed)
- `apps/web/tsconfig.json` (no path aliases, strict mode, ES2022)
- `apps/web/next.config.ts` (minimal: `reactStrictMode: true` only)
- `apps/web/app/globals.css` (2,960 lines hand-written CSS — 17 @keyframes, ~6 @media queries, CSS custom properties)
- `apps/web/app/components/` (8 files, 977 lines total: Shell.tsx, HomeContent.tsx, PricingContent.tsx, HeroScene.tsx, LeadForm.tsx, CtaLink.tsx, MobileCta.tsx, analytics.ts)
- `apps/web/app/actions/submit-form.ts` (89 lines, marketing lead form server action)
- `apps/web/app/page.tsx` (home page — imports `./components/HomeContent`)
- `apps/web/app/pricing/page.tsx` (pricing page — imports `../components/PricingContent`)

## Skills Available for This Subphase
- `find-local-skills` output: unavailable on this machine (missing local index); fallback to manual skill selection.
- `find-skills` output: unavailable on this machine; fallback to confirmed local skills only.
- Planned invocations:
  - `backend-development`
  - `context7-docs`
  - `requirements-clarity`
  - `react-dev`
  - `frontend-design`
  - `javascript-typescript`

## Execution Status
- In progress.
- 9a is not complete until the Tailwind migration, shadcn init, and post-migration visual comparison are finished.
- The foundation/bootstrap slice is on disk and validated; the CSS migration slice is still open.

## Work

### 0. Add TypeScript path aliases (prerequisite for all imports)
- Add `baseUrl` and `paths` to `apps/web/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "baseUrl": ".",
      "paths": {
        "@/*": ["./*"]
      }
    }
  }
  ```
- Verify with `npm run web:build` — path aliases must not break existing marketing imports.

### 1. Normalize the app contract before adding new runtime code
- Replace `.env.example` (currently 1 line) with a comprehensive template covering both marketing and platform vars:
  ```
  # Marketing (existing)
  NEXT_PUBLIC_BOOKING_URL=https://example.com/book-demo
  FORM_WEBHOOK_URL=

  # Core App
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  APP_ENV=development
  CRON_SECRET=
  INTERNAL_API_TOKEN=
  APP_ENCRYPTION_KEY=

  # Database / Auth
  DATABASE_URL=
  DIRECT_URL=
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=

  # Stripe
  STRIPE_SECRET_KEY=
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
  STRIPE_WEBHOOK_SECRET=
  STRIPE_STARTER_PRICE_ID=
  STRIPE_GROWTH_PRICE_ID=

  # Inngest
  INNGEST_APP_ID=seed-scale
  INNGEST_EVENT_KEY=
  INNGEST_SIGNING_KEY=
  INNGEST_ENV=development

  # OpenAI
  OPENAI_API_KEY=

  # Shopify
  SHOPIFY_API_KEY=
  SHOPIFY_API_SECRET=
  SHOPIFY_APP_SCOPES=read_products,write_orders,read_fulfillments
  SHOPIFY_WEBHOOK_SECRET=

  # Gmail / Google
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  GOOGLE_PROJECT_ID=

  # Meta / Instagram
  META_APP_ID=
  META_APP_SECRET=

  # Browser Worker
  CREATOR_SEARCH_WORKER_BASE_URL=http://localhost:4000
  CREATOR_SEARCH_WORKER_TOKEN=

  # Observability
  SENTRY_DSN=
  ```
- Note: `FORM_WEBHOOK_URL` is used by `submit-form.ts` but was missing from the old `.env.example`.
- Verify `.env.local` is in `.gitignore`.

### 2. Install and lock the platform dependency set inside `apps/web`
- Attempt Next.js 16 upgrade (LOCKED DECISION: attempt with revert gate):
  ```bash
  cd apps/web
  npm install next@16 react@19 react-dom@19
  npm run build  # if fails, revert: npm install next@15
  ```
- Add backend platform dependencies:
  ```bash
  npm install @supabase/supabase-js @supabase/ssr
  npm install @prisma/client @prisma/adapter-pg
  npm install stripe @stripe/stripe-js
  npm install inngest
  npm install zod openai server-only
  ```
- Add UI dependencies:
  ```bash
  npm install class-variance-authority clsx tailwind-merge
  npm install lucide-react date-fns
  npm install react-hook-form @hookform/resolvers
  npm install @tanstack/react-query sonner
  ```
- Add dev dependencies:
  ```bash
  npm install -D prisma tailwindcss@4 @tailwindcss/postcss postcss
  npm install -D eslint eslint-config-next
  ```
- Run `npx shadcn@latest init` to scaffold `components.json`, `components/ui/`, and Tailwind config. When prompted, choose settings that align with the ZRG reference (New York style, CSS variables, `@/components` alias).
- Add app-level scripts to `apps/web/package.json`:
  ```json
  {
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint",
      "db:generate": "prisma generate",
      "db:push": "prisma db push",
      "db:studio": "prisma studio",
      "inngest:dev": "npx inngest-cli@latest dev -u http://localhost:3000/api/inngest"
    }
  }
  ```
- Run `npm run web:build` to verify dependencies don't break the existing build.

### 3. Screenshot marketing pages for visual regression baseline
- Before touching any CSS or routes, capture screenshots of:
  - `/` at desktop (1440px) and mobile (390px) widths
  - `/pricing` at desktop (1440px) and mobile (390px) widths
- Use Playwright (`npx playwright screenshot`) or manual browser screenshots.
- Save to `test-results/visual-baseline/` for post-migration comparison.
- This step is NON-NEGOTIABLE. Without baselines, visual regression is impossible to verify.

### 4. Move marketing into `(marketing)/` route group (LOCKED DECISION)
- Create the three route groups:
  - `app/(marketing)/`
  - `app/(auth)/`
  - `app/(platform)/`
- Move marketing files into `(marketing)/`:
  - `app/page.tsx` → `app/(marketing)/page.tsx`
  - `app/pricing/page.tsx` → `app/(marketing)/pricing/page.tsx`
  - `app/components/` → `app/(marketing)/components/`
  - `app/actions/submit-form.ts` → `app/(marketing)/actions/submit-form.ts`
  - `app/globals.css` → `app/(marketing)/globals.css` (temporary — will be replaced by Tailwind in step 5)
- Create `app/(marketing)/layout.tsx`:
  - Import `./globals.css`
  - This layout wraps all marketing pages
  - It does NOT import Tailwind (yet — that comes after migration)
- Update root `app/layout.tsx`:
  - Remove the `import "./globals.css"` line (CSS is now in marketing layout)
  - Keep fonts (Manrope, Space_Grotesk) in root layout since they're shared
- Fix all relative imports in moved files:
  - `app/(marketing)/page.tsx`: import from `./components/HomeContent` (unchanged)
  - `app/(marketing)/pricing/page.tsx`: import from `../components/PricingContent` (unchanged)
  - `app/(marketing)/components/Shell.tsx`: imports from `./CtaLink`, `./MobileCta`, `./analytics` (unchanged)
- Run `npm run web:build` after the move to verify:
  - `/` still resolves (route groups are URL-transparent)
  - `/pricing` still resolves
  - All imports work

### 5. Full Tailwind migration of marketing CSS (LOCKED DECISION)
This is the largest single step. Convert all 2,960 lines of `globals.css` to Tailwind 4 utility classes applied directly in component files.

#### 5a. Map CSS custom properties to Tailwind theme
- The CSS uses 30+ custom properties (`:root` block). Convert these to Tailwind theme extensions in `tailwind.config.ts` (or CSS `@theme` in Tailwind 4):
  - `--bg`, `--surface`, `--surface-2` → background colors
  - `--ink`, `--ink-soft`, `--muted` → text colors
  - `--line`, `--line-hard` → border colors
  - `--primary`, `--primary-dark`, `--primary-soft` → primary palette
  - `--coral`, `--coral-soft` → accent colors
  - `--teal`, `--teal-soft` → accent colors
  - `--shadow-soft`, `--shadow-med`, `--shadow-hard` → box shadows
  - `--ease-out`, `--duration-*` → transition/animation timing
  - Font variables (`--font-body`, `--font-display`) already set by Next.js font system

#### 5b. Convert @keyframes animations to Tailwind
- 17 custom keyframes need Tailwind `@keyframes` definitions in the theme or a dedicated `animations.css` that Tailwind imports:
  - `drift`, `marquee`, `fadeSlideUp`, `faqFadeIn`, `floatContentCard`, `flowDash`, `popIn`, `fadeScaleIn`, `dashboardBarGrow`, `slideInFromRight`, `pulseGlow`, `pastelRotate`, `pastelRotateReverse`, `sceneFloat`, `scenePulse`, `sceneLift`, `sceneSweep`
- These become `animation: { drift: '...' }` in theme extend, then `animate-drift` etc. in components.

#### 5c. Convert component CSS class-by-class
- Process each component file, replacing `className="css-class"` with Tailwind utility strings.
- Order: Shell.tsx (11 classNames) → CtaLink.tsx (1) → MobileCta.tsx (2) → LeadForm.tsx (10) → HeroScene.tsx (42) → HomeContent.tsx (55) → PricingContent.tsx (39)
- Run `npm run web:build` after each component conversion.
- For complex responsive styles (~6 @media queries at 1024px, 768px, 640px breakpoints), use Tailwind responsive prefixes (`lg:`, `md:`, `sm:`).
- For `color-mix()` and other modern CSS functions, use Tailwind arbitrary values: `bg-[color-mix(in_srgb,var(--line)_84%,transparent)]` or simplify to opacity utilities.

#### 5d. Delete `globals.css` and create minimal Tailwind entry
- After all components are converted, delete `app/(marketing)/globals.css`.
- Create a single Tailwind CSS entry point (e.g., `app/globals.css` or `styles/tailwind.css`) that:
  - Imports Tailwind base, components, utilities
  - Includes the theme extensions for custom colors/shadows/animations
  - Is imported by the root layout (so all route groups share it)
- Update `app/(marketing)/layout.tsx` to remove the old CSS import.
- Update `app/layout.tsx` to import the new Tailwind CSS.

#### 5e. Visual regression check
- Screenshot all marketing pages at the same viewports as step 3.
- Compare side-by-side with baselines.
- Fix any visual regressions before proceeding.
- Acceptable: minor sub-pixel differences. Unacceptable: layout shifts, missing animations, wrong colors, broken responsive behavior.

### 6. Create the platform directory skeleton
- Establish the import convention (now simplified by route groups):
  - `apps/web/app/(marketing)/components/` — marketing components (moved from `app/components/`)
  - `apps/web/app/(marketing)/actions/` — marketing actions (moved from `app/actions/`)
  - `apps/web/components/ui/` — shadcn UI primitives (shared)
  - `apps/web/components/platform/` — platform-specific components
  - `apps/web/actions/` — platform server actions
  - `apps/web/lib/` — platform runtime utilities
- Add the directories that later subphases will fill:
  - `apps/web/app/(auth)/`
  - `apps/web/app/(platform)/`
  - `apps/web/app/api/`
  - `apps/web/actions/`
  - `apps/web/components/ui/` (may already exist from shadcn init)
  - `apps/web/components/platform/`
  - `apps/web/lib/supabase/`
  - `apps/web/lib/inngest/`
  - `apps/web/lib/security/`
  - `apps/web/lib/stripe/`
  - `apps/web/lib/shopify/`
  - `apps/web/lib/gmail/`
  - `apps/web/lib/ai/`
  - `apps/web/lib/observability/`
  - `apps/web/prisma/`

### 7. Establish route-group layouts
- `(auth)/layout.tsx` — minimal auth shell
- `(platform)/layout.tsx` — sidebar-driven platform shell
- `(marketing)/layout.tsx` — lightweight marketing wrapper; root `app/layout.tsx` continues to own global CSS until Tailwind cutover is complete
- Do NOT reuse the marketing `Shell.tsx` for the platform
- Add placeholder pages:
  - `(auth)/login/page.tsx`
  - `(auth)/signup/page.tsx`
  - `(platform)/dashboard/page.tsx`

### 8. Add shared runtime scaffolds
- `apps/web/proxy.ts` — Next.js 16 proxy entrypoint that will become the auth gate in 9c
- `apps/web/lib/supabase/proxy.ts` — proxy helper for Supabase SSR session refresh
- `apps/web/lib/supabase/client.ts` — browser Supabase client
- `apps/web/lib/supabase/server.ts` — server Supabase client (uses `cookies()`)
- `apps/web/lib/prisma.ts` — null placeholder until 9b lands the real Prisma schema/client
- `apps/web/lib/inngest/client.ts` — Inngest client init with `INNGEST_APP_ID`
- `apps/web/lib/inngest/events.ts` — event type definitions (placeholder)
- `apps/web/app/api/inngest/route.ts` — Inngest route handler

### 9. Update `next.config`
- Add image domains for Supabase storage, Shopify CDN, and social media profile images
- Add any transpile/webpack config needed for Inngest or other packages
- Add `outputFileTracingRoot` to stop Next.js from choosing the wrong workspace root when multiple lockfiles exist
- Use `next.config.mjs` under the current ESM package setup; `next.config.ts` is not stable enough here on Next.js 16

### 10. Create ESLint configuration
- Create flat ESLint config extending Next core-web-vitals + TypeScript rules
- `lint` script already added in step 2 and uses the ESLint CLI (`eslint .`) because `next lint` is removed in Next.js 16
- Run `npm run lint` and fix any issues

### 11. Final validation
- `npm run web:build` (from repo root)
- `cd apps/web && npm run lint`
- `cd apps/web && npx tsc --noEmit` (type-check without build)
- Verify middleware does NOT gate public marketing routes:
  - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` should return 200
  - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/pricing` should return 200
- Visual regression: compare post-migration screenshots with step 3 baselines
- Verify no hand-written CSS remains (no `globals.css` with raw selectors)

## Validation (RED TEAM)
- Every import using `@/` must resolve after tsconfig change
- Marketing pages must be visually equivalent before and after Tailwind migration (screenshot comparison)
- All 17 @keyframes animations must have Tailwind equivalents and render correctly
- All responsive breakpoints must work at 1024px, 768px, and 640px
- Route group move must NOT change any URL — `/` and `/pricing` must resolve unchanged
- `app/(marketing)/actions/submit-form.ts` must still work (test lead form submission)
- All new directories must exist after scaffold step
- `.env.example` must document every var that any subphase will need (including `FORM_WEBHOOK_URL`)
- Middleware must NOT redirect or block unauthenticated access to marketing routes
- `npm run web:build` must pass at every checkpoint (minimum 5 build checks during this subphase)

## Progress This Turn (Terminus Maximus)
- Work done:
  - Installed the Phase 9a dependency baseline in `apps/web`, including Next.js 16.1.6, Supabase SSR, Prisma packages, Stripe, Inngest, Zod, OpenAI, Tailwind 4 tooling, and ESLint.
  - Expanded `apps/web/.env.example` from the one-line marketing placeholder into a full marketing + platform template, and updated `apps/web/.gitignore` to ignore `.env.local`.
  - Added `@/*` path aliases, switched `next.config` to `apps/web/next.config.mjs`, and added `outputFileTracingRoot` so Next stops inferring the wrong workspace root.
  - Moved the marketing app into `apps/web/app/(marketing)/` without changing `/` or `/pricing`, and created `(auth)` + `(platform)` route groups with placeholder pages.
  - Created foundation scaffolds: `apps/web/proxy.ts`, `apps/web/lib/supabase/{client,server,proxy}.ts`, `apps/web/lib/inngest/{client,events}.ts`, `apps/web/lib/prisma.ts`, and `apps/web/app/api/inngest/route.ts`.
  - Captured current marketing baselines at `test-results/visual-baseline/phase9a-home-desktop.png`, `test-results/visual-baseline/phase9a-home-mobile.png`, `test-results/visual-baseline/phase9a-pricing-desktop.png`, and `test-results/visual-baseline/phase9a-pricing-mobile.png`.
  - Ran a sidecar CSS audit and confirmed the Phase 7 marketing surface still contains large legacy selector clusters in `apps/web/app/globals.css`; Tailwind migration should start from shared shell primitives and move the reveal delay logic into JSX.
- Commands run:
  - `cd apps/web && npm install --save ... && npm install --save-dev ...` — pass; dependency baseline installed, 9 advisories reported by `npm audit`.
  - `npm run web:build` — pass on Next.js 16.1.6 after switching to `next.config.mjs`.
  - `cd apps/web && npm run lint` — pass with 1 existing warning (`@next/next/no-img-element` in `app/(marketing)/components/HomeContent.tsx`).
  - `cd apps/web && npx tsc --noEmit` — pass.
  - Playwright screenshot capture against the local app — pass for four baseline assets.
- Coordination notes:
  - Integrated the completed Phase 7 marketing surface into the new `(marketing)` route group without rewriting the marketing copy or CSS system.
  - The overlapping files were `apps/web/app/page.tsx`, `apps/web/app/pricing/page.tsx`, `apps/web/app/components/**`, and `apps/web/app/actions/submit-form.ts`; their logic was preserved during the move.
- Blockers:
  - Tailwind is installed but not active yet. The full 2,960-line CSS migration, shadcn initialization, and visual parity fix pass are still outstanding inside 9a.
  - The home/pricing full-page baseline captures show large blank-space artifacts in the current Phase 7 render. That needs to be understood before the Tailwind parity pass, or the migration will compare against a compromised baseline.
- Next concrete steps:
  - Activate Tailwind 4 in the shared root stylesheet without breaking the current marketing render.
  - Initialize shadcn once the Tailwind entrypoint is in place.
  - Convert shell primitives and shared tokens first, then the active Phase 7 marketing blocks, then delete the legacy unused selector families.

## Output
- Partial 9a output is on disk:
  - `apps/web` now has the dependency baseline and structural scaffolding required for real product work.
  - TypeScript path aliases (`@/`) are configured.
  - All marketing routes now live inside `app/(marketing)/`, and auth/platform route groups exist at stable URLs.
  - Env docs were rebuilt from scratch for both marketing and platform variables.
  - ESLint is configured via flat config and passing.
  - Shared runtime scaffolds exist (`proxy.ts`, Supabase helpers, Inngest client/route, Prisma placeholder).
- Remaining before 9a can be called complete:
  - Tailwind 4 must replace the hand-written marketing CSS.
  - shadcn/ui must be initialized against the Tailwind setup.
  - Post-migration visual comparison must pass against the captured baselines.

## Handoff
9a stays active. Do not start 9b yet. The next execution slice is still inside 9a: Tailwind activation, shadcn init, component-by-component CSS migration, deletion of the legacy selector block, and post-migration screenshot comparison.

## Assumptions / Open Questions (RED TEAM)
- Next.js 16 upgrade may fail. If so, stay on 15 and adapt any ZRG patterns that depend on 16-specific APIs.
  - Why it matters: affects middleware API, route handler signatures, and some React Server Component patterns.
  - Current default: LOCKED — attempt 16, revert if build breaks.
- Full Tailwind migration can achieve visual parity with 2,960 lines of hand-written CSS.
  - Why it matters: if complex animations or `color-mix()` functions can't be replicated in Tailwind, marketing pages will look different.
  - Current default: LOCKED — use Tailwind arbitrary values `[]` syntax for anything that doesn't have a direct utility. Accept minor sub-pixel differences; reject layout shifts or missing animations.
- Marketing route group move creates no URL changes.
  - Why it matters: Next.js route groups in parentheses are URL-transparent. If this assumption is wrong, SEO and existing links break.
  - Current default: LOCKED — verified behavior in Next.js 15+.
