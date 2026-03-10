# Phase 14d — Validate Manual Imports and Handle Saved Invalid Creators

## Focus
Apply the validation contract to manual creator ingress paths and safely handle creators that later fail validation after they are already saved.

## Inputs
- Root phase contract: `docs/planning/phase-14/plan.md`
- Outputs from 14a-14c
- Current manual ingress paths: CSV/manual creator import and inline add-to-campaign/create-creator flows

## Skills Available for This Subphase
- `find-local-skills` output: unavailable in this session; fallback is manual local-skill selection.
- `find-skills` output: unavailable in this session; fallback is installed-skill-only planning.
- Planned invocations:
  - `backend-development`
  - `javascript-typescript`
  - `requirements-clarity`

## Work
1. CSV/manual creator import:
   - validate each supplied handle
   - import/update only valid creators
   - return `requested`, `validImported`, `updated`, `invalidDropped`, `skipped`
   - do not auto-top-up
2. Inline add-to-campaign / create-creator:
   - require the same validation before save/attach
3. Saved invalid creator policy:
   - mark invalid and hide from default creator/discovery/cache queries
   - auto-remove only from draft/ready campaign queues with no downstream activity
   - keep creators with downstream activity, but mark invalid and prevent future reuse
4. Existing-data cleanup path:
   - provide one deterministic backfill/cleanup command or job for already-saved invalid creators in the current DB

## Validation (RED TEAM)
- `cd apps/web && npx tsc -p tsconfig.json --noEmit`
- `set -a && source ./.env.local && set +a && cd apps/web && npm run build`
- `cd apps/web && npm run lint -- 'app/api/creators/import/route.ts' 'app/api/campaigns/[campaignId]/creators/route.ts' 'app/api/creators/route.ts' 'app/(platform)/creators/import/page.tsx' 'app/(platform)/campaigns/[campaignId]/import/page.tsx'`

## Output
- Manual creator ingress paths now all validate against the shared Instagram validator before save/attach.
- Invalid creators are hidden from default creator/campaign selection flows, and the repo now has a dedicated cleanup path (`npm run creators:validate`) plus a nightly Inngest sweep for stale creators.
- Invalid saved creators are auto-removed only from safe draft/ready queue entries; campaign links with downstream history are retained while the creator is marked invalid and excluded from reuse.

## Handoff
14e surfaces the remaining background-job UX in the platform shell and records the final verification evidence.

## Progress This Turn (Terminus Maximus)
- Work done:
  - `POST /api/creators/import` now validates every supplied handle with the shared Instagram validator, drops invalid creators, and returns `{ requested, validImported, created, updated, invalidDropped, skipped }`.
  - `POST /api/campaigns/[campaignId]/creators` now rejects invalid existing creators and requires live Instagram validation before inline creator creation.
  - `GET /api/creators` now hides `validationStatus = "invalid"` by default, which also removes invalid saved creators from the campaign-import picker and creators list unless an explicit `includeInvalid=1` query is used.
  - The creators import page now reports invalid drops separately from created/updated/skipped rows.
- Commands run:
  - `cd apps/web && npx tsc -p tsconfig.json --noEmit` — pass
  - `set -a && source ./.env.local && set +a && cd apps/web && npm run build` — pass
  - `cd apps/web && npm run lint -- 'app/api/creators/import/route.ts' 'app/api/campaigns/[campaignId]/creators/route.ts' 'app/api/creators/route.ts' 'app/(platform)/creators/import/page.tsx' 'app/(platform)/campaigns/[campaignId]/import/page.tsx'` — pass with existing repo warnings only
- Blockers:
  - None for 14d.
- Next concrete steps:
  - Finish the shell jobs tray and creators-page non-blocking search UX.
  - Record verification in the phase review.
