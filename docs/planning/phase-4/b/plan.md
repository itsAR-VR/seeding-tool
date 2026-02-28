# Phase 4b — Implement shared capture + token/motion/network primitives

## Focus
Implement reusable primitives for:
- deterministic baseline capture (reduced motion)
- motion/micro-interaction evidence capture (events + video/steps)
- token extraction (typography/colors/radii/shadows)
- optional network capture (HAR + request index)

These are shared by owned marketing, owned app, and competitor runners.

## Inputs
- Phase 4a scaffold + config contract.

## Work
1. Baseline capture primitive (`captureBaseline(page, ctx)`):
   - reduced motion emulation
   - `document.fonts.ready`
   - timeboxed `networkidle` (fallback to “rendered DOM dump”)
   - scroll to trigger lazy-load then return to top
   - outputs: full-page + above-fold screenshots, DOM snapshot, a11y snapshot.
2. Motion evidence primitive (`captureMotion(page, ctx)`):
   - enable motion
   - install in-page listeners:
     - `animationstart/end`, `transitionrun/end`
     - `document.getAnimations()` snapshots before/after interactions
     - `MutationObserver` for class/style changes during “interaction windows”
   - run a generic interaction script:
     - hover primary CTAs/nav
     - open/close menus/accordions/modals where discoverable
     - segmented scroll to trigger scroll reveals
   - outputs: event logs + short video (or step screenshots with timestamps).
3. Token extractor (`extractTokens(page)`):
   - computed typography for headings/buttons/body
   - color usage histogram for text/background/border
   - radii + shadows (computed styles)
   - font inventory from CSS responses (`@font-face`) + `document.fonts`.
4. Animation inventory:
   - parse CSS responses for `@keyframes` names
   - combine with runtime-observed animation/transition events and element fingerprints
   - output per-run `animations.json`.
5. Network capture (owned app by default; optional elsewhere):
   - run-level HAR
   - request index JSONL (method/url/status/resourceType/timing)
   - **HAR scrubbing:** post-process HAR to replace `Authorization` header values and `Cookie` header values with `[REDACTED]` before writing to disk
   - ensure docs never include raw auth tokens/cookies.

## Output
- Shared capture/extraction modules with stable JSON schemas:
  - `tokens.json`, `animations.json`, `requests.jsonl`, HAR.

## Output (Actual)
- Added shared capture primitives:
  - `src/audit/capture/baseline.ts` (baseline screenshots + DOM + a11y)
  - `src/audit/capture/motion.ts` + `src/audit/capture/interactions.ts` (event/mutation logs + interaction routine)
  - `src/audit/capture/tokens.ts` (typography/colors/radii/shadows + fonts)
  - `src/audit/capture/animations.ts` + `src/audit/capture/css.ts` (keyframes from CSS)
  - `src/audit/capture/network.ts` (request logging + HAR scrubbing)
- Added shared utilities:
  - `src/audit/utils/page.ts` (network idle + scroll)

## Verification
- [ ] `captureBaseline()` can be called on a test page and produces screenshot + DOM snapshot
- [ ] `captureMotion()` produces event log JSON with at least `animationstart`/`transitionrun` entries on a page with CSS animations
- [ ] `extractTokens()` returns non-empty `colors`, `typography`, and `fonts` arrays on a styled page
- [ ] HAR files contain `[REDACTED]` instead of actual cookie/auth values
- [x] All modules export TypeScript types for their output schemas

## Handoff
Phase 4c should wire these primitives into the marketing and competitor runners, and add route discovery + per-route artifact capture.
