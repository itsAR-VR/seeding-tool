# Seeding Web App (`apps/web`)

## Local run
1. `cd apps/web`
2. `cp .env.example .env.local`
3. Fill the required vars for the slice you are working on
4. `npm install`
5. `npm run dev`

## Current scope
- Marketing routes live under `app/(marketing)` and still resolve at `/` and `/pricing`
- Platform/auth scaffolds live under `app/(platform)` and `app/(auth)`
- Shared runtime scaffolds exist for Supabase SSR, Inngest, and Prisma placeholders

## Helpful scripts
- `npm run dev` — local app server
- `npm run build` — production build
- `npm run lint` — ESLint CLI
- `npm run db:generate` — Prisma client generation once schema exists
- `npm run db:push` — Prisma schema push once the database is configured
- `npm run inngest:dev` — local Inngest dev server for `/api/inngest`
