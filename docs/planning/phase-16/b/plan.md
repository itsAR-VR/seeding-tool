# Phase 16b — Implement atomic job claiming and in-process fallback execution for creator search jobs

## Focus
Move creator search execution into a shared runner that can be claimed by the primary worker path or a safe alternate execution path, so queued jobs do not stay pending or fail due to one runtime assumption.

## Inputs
- Phase 16a root-cause statement and chosen dispatch strategy
- Existing `handleCreatorSearch` logic in `apps/web/lib/inngest/functions/creator-search.ts`
- Creator search creation/polling routes in `apps/web/app/api/creators/search/**` and campaign equivalents

## Skills Available for This Subphase
- `find-local-skills` output: unavailable here because the documented local index path is missing
- `find-skills` output: unavailable in this environment
- Planned invocations: `backend-development`, `javascript-typescript`

## Work
- Extract the creator-search execution body into a shared runner with an atomic “claim pending job” step.
- Update the Inngest function to use that shared runner instead of unconditionally starting work.
- Add a resilient alternate execution path from search creation and/or stale-job polling that attempts to claim and execute a job when the primary worker has not picked it up.
- Keep duplicate protection explicit so production Inngest processing and local fallback cannot both execute the same job.
- Reduce non-essential execution failures so optional follow-up work does not mark a successful discovery run as failed.
- Add or update tests around the claim logic and execution behavior where practical.

## Output
- Code changes that let queued creator search jobs execute reliably without depending on one fragile worker/runtime path.
- Test coverage or direct validation around the new claim/execution behavior.

## Handoff
Phase 16c should validate the repaired behavior in the local app and confirm the job tray plus results UI reflect the fix.
