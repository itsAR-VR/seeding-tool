# Phase 9b — Land Prisma schema, database access layer, encryption primitives, and migration scaffolding

## Focus
Turn the Phase 8 schema contract into the real runtime data layer: Prisma schema, DB client, migration flow, encryption helpers, and seed/import scaffolding. This subphase makes the platform’s data model executable.

## Inputs
- `docs/planning/phase-9/plan.md`
- `docs/planning/phase-9/a/plan.md`
- `docs/planning/phase-8/finalplan.md`
- `docs/planning/phase-8/b/schema.md`
- `docs/planning/phase-8/review.md`
- `apps/web/prisma/` (from 9a)
- `apps/web/lib/prisma.ts` (from 9a)

## Skills Available for This Subphase
- `find-local-skills` output: unavailable on this machine (missing local index); fallback to manual skill selection.
- `find-skills` output: unavailable on this machine; fallback to confirmed local skills only.
- Planned invocations:
  - `database-schema-designer`
  - `backend-development`
  - `context7-docs`
  - `javascript-typescript`

## Work

### 1. Materialize the canonical schema
- Create `apps/web/prisma/schema.prisma`.
- Implement the Phase 8 entity set as actual Prisma models, prioritizing:
  - tenancy and billing
  - brand config and provider credentials
  - campaign and creator backbone
  - inbox/order/mention/intervention tables
  - durable queue tables
- Resolve any implementation-level ambiguity in favor of the Phase 8 schema document, not ad hoc simplification.

### 2. Add database access primitives
- Finalize `apps/web/lib/prisma.ts` with:
  - adapter/singleton pattern
  - connection-error handling
  - duplicate-key error helpers
- Create any required DB helper modules for:
  - transaction boundaries
  - idempotent upserts
  - tenant scoping helpers

### 3. Add encryption and hashing primitives
- Implement app-level helpers for:
  - credential encryption/decryption
  - email hashing + preview generation
  - shipping-address ciphertext helpers
- Keep these in `apps/web/lib/security/` or an equivalent isolated location.
- Ensure the schema and helpers align: ciphertext fields, hash fields, preview fields.

### 4. Establish migration/seed workflow
- Add the initial migration path for the schema.
- Add bootstrap scripts for:
  - seed dev org/client/brand
  - seed static subscription plans / entitlements
  - optionally seed dev templates/products
- Add pilot-import scaffolding or placeholder scripts for later migration work so Phase 9h does not start from zero.

### 5. Decide what stays typed vs JSON
- Keep core operational data in typed columns.
- Keep only genuinely variable/provider-specific blobs in `Json`.
- Do not collapse key operational entities back into a few giant JSON payloads.

### 6. Generate `APP_ENCRYPTION_KEY` (RED TEAM: critical for credential storage)
- Document how to generate a cryptographically secure key (e.g., `openssl rand -base64 32`)
- Add the key to `.env.local` and document it in `.env.example`
- Encryption helpers in `lib/security/` must use this key for all `ProviderCredential`, email, and address encryption

### 7. Validation
- `cd apps/web && npx prisma validate`
- `npm run web:build` (from repo root)
- `cd apps/web && npx prisma generate` (generates Prisma Client from schema)
- If a Supabase DB is available, `cd apps/web && npx prisma db push` to verify schema applies
- Verify that encryption round-trip works: encrypt a test value, decrypt it, compare

## Validation (RED TEAM)
- Schema must have all entities from Phase 8 `schema.md` — do not defer core entities to later subphases
- Every enum must include the exact values from the Phase 8 contract
- `prisma validate` must pass with zero errors
- Encryption helpers must handle the case where `APP_ENCRYPTION_KEY` is missing (throw, don't silently skip)
- Seed scripts must be idempotent (safe to run multiple times)

## Output
- A real Prisma schema exists in `apps/web/prisma/schema.prisma`.
- DB access, encryption primitives, and migration/seed scaffolding exist in the app runtime.
- `APP_ENCRYPTION_KEY` generation is documented and helpers use it.
- The data layer is stable enough for auth, billing, onboarding, and operational feature work.

## Handoff
Phase 9c should build auth and tenancy directly against the real database layer from this subphase. No auth or onboarding work should invent shadow models outside Prisma. The encryption helpers are ready for `ProviderCredential` storage.

## Assumptions / Open Questions (RED TEAM)
- Prisma schema colocated at `apps/web/prisma/schema.prisma` (locked in Phase 8a).
  - Why it matters: affects import paths, Vercel deploy root, and migration commands.
  - Current default: `apps/web/prisma/`.
- UUID generation uses `gen_random_uuid()` (locked in Phase 8b).
  - Why it matters: UUID v7 was considered but rejected to avoid ambiguity.
  - Current default: database-generated UUIDs.
- A Supabase Postgres database must exist before `db:push` can run.
  - Why it matters: without a running DB, schema validation is syntax-only, not semantic.
  - Current default: Supabase project created as an external prerequisite before 9b executes.
