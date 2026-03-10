# Phase 16 — Creator Search Job Execution Recovery and Yield Verification

## Original User Request (verbatim)
these discovery jobs havent resulted in any yield. [Image #1] investigate and fix $phase-plan then test with $playwright-interactive

## Purpose
Restore creator discovery jobs so newly queued searches are actually executed across the real runtime paths, not left pending or failed with zero yield, and verify the repaired behavior end to end with local browser QA.

## Context
- The current bug is on the Phase 14/15 creator discovery surface, specifically the background job path exposed by the global `Discovery Jobs` tray and the `/creators` search modal.
- Investigation on this machine showed one execution failure mode where a new `CreatorSearchJob` stayed `pending` with `progressPercent = 0`, `candidateCount = 0`, and `resultCount = 0`, which meant the UI was creating jobs but no worker was claiming them.
- Follow-on debugging showed additional execution failures beyond local queueing: runtime-specific worker assumptions, bundled module resolution issues, and non-critical downstream event sends were capable of turning otherwise valid discovery runs into `failed` jobs.
- Historical completed jobs with non-zero `resultCount` came from the earlier search path, so this is an execution-path/runtime-resilience problem rather than a category/filter regression.
- The repo currently has unrelated uncommitted work in `apps/web/app/(platform)/onboarding/page.tsx`. This phase must avoid that file unless the root cause forces an explicit coordination step.

## Skills Available for Implementation
- `find-local-skills`: unavailable in practice here because its documented index path `/home/podhi/.openclaw/workspace/orchestration/skill-index.json` does not exist on this machine.
- `find-skills`: unavailable in this environment; no executable or installed tool was found.
- Selected implementable skills from the installed local catalog: `backend-development`, `javascript-typescript`, `requirements-clarity`, `playwright-interactive`, `playwright-testing`, `phase-plan`.

## Concurrent Phases
| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 15 | Complete | Creator discovery, background jobs, job tray, unified search routes | Treat as the active baseline. Phase 16 is a bug-fix follow-up on top of the shipped Phase 15 flow. |
| Phase 14 | Complete | Creator validation, cache-first discovery, background job UX | Preserve as historical context only; do not revert its tray and validation behavior. |
| Unplanned local work | Active/uncommitted | `apps/web/app/(platform)/onboarding/page.tsx` | Avoid onboarding changes while fixing discovery-job execution unless the bug crosses into onboarding-created jobs. |

## Objectives
* [x] Reproduce and document why creator search jobs remain pending or finish with zero useful yield.
* [x] Implement a resilient creator-search execution path so queued discovery jobs are claimed and run across the real runtime environments, including when the external worker path is unavailable.
* [x] Verify the repaired search flow with local interactive Playwright QA and capture evidence of job progression plus non-empty results.

## Constraints
- Keep the existing background-job UX intact; fix the runtime pickup path rather than reverting to a blocking synchronous search UI.
- Avoid changes to unrelated onboarding and connections work already in the tree.
- Preserve the intended background execution model while making the runtime path resilient. Any fallback or alternate execution path must prevent duplicate processing through an atomic job claim step.
- Local verification is required in this phase, but the implementation target is the general creator-search execution path rather than a one-off local-only workaround.

## Success Criteria
- A newly created creator discovery job transitions out of `pending` and completes through the supported execution path instead of depending on one fragile runtime assumption.
- The job record shows real progress and final counts (`candidateCount`, `validatedCount`, and/or `resultCount`) after execution.
- The `/creators` flow and `Discovery Jobs` tray reflect the repaired behavior in the local app.
- The fix is covered by targeted local validation and documented in this phase.

## Subphase Index
* a — Reproduce the stalled-job failure and lock the dispatch fix strategy
* b — Implement atomic job claiming and in-process fallback execution for creator search jobs
* c — Validate the repaired discovery flow locally with interactive Playwright QA

## Outcome
- Creator search execution now has a more resilient fallback path instead of assuming one specific worker/runtime arrangement.
- The collabstr/stored-creator lane now yields candidates from the imported marketplace data instead of depending on previously validated cache only.
- Local QA confirmed a new creators discovery job can complete with non-zero `Ready` results in the `Discovery Jobs` tray.
- A separate follow-up UI defect remains in the search modal: the lower discovery-keyword selector still clips its dropdown near the modal footer.
