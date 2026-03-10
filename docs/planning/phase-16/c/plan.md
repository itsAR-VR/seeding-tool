# Phase 16c — Validate the repaired discovery flow locally with interactive Playwright QA

## Focus
Run the fixed creators discovery flow end to end in the local app, using persistent Playwright handles to verify functional behavior, visual job-state progression, and non-empty yield as evidence that the general execution path is repaired.

## Inputs
- Phase 16b implementation
- Local app runtime with the repo-root environment loaded
- Creators search UI, jobs tray, and polling routes

## Skills Available for This Subphase
- `find-local-skills` output: unavailable here because the documented local index path is missing
- `find-skills` output: unavailable in this environment
- Planned invocations: `playwright-interactive`, `playwright-testing`

## Work
- Build a QA inventory covering job creation, job status progression, tray visibility, and visible result yield.
- Start the local app in a persistent session, launch the browser through `js_repl`, and reuse the same browser/context across iterations.
- Trigger a discovery search from `/creators`, observe the job transition out of `pending`, and confirm results appear when the job completes.
- Capture visual evidence for the repaired job tray and results state, plus note any remaining defects or exclusions.

## Output
- Interactive QA evidence showing a creators discovery job progressing to `completed` with `Ready: 5`, `Validated: 15`, and `Cached: 5` in the `Discovery Jobs` tray.
- Residual note: the lower discovery-keyword selector inside the modal still clips its dropdown and should be handled as a separate UI follow-up.

## Handoff
If QA passes, Phase 16 is ready for review/commit. If it fails, loop back to 16b with the specific failing state and evidence.
