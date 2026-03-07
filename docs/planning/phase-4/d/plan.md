# Phase 4d — Implement authenticated platform crawl + capture + network logs

## Focus
Crawl “everything reachable” in the authenticated app via UI navigation and capture per-route page artifacts, plus network behavior (HAR + request index) for functional parity mapping.

## Inputs
- `.auth/platform.afterOnboarding.storageState.json` from Phase 4c.
- Capture primitives from Phase 4b.
- Safety defaults: `ALLOW_DESTRUCTIVE=0`, `ALLOW_WRITES=1` (safe creates only) within test org.

## Work
1. Implement `audit:platform` runner:
   - create context with storageState
   - navigate to a stable post-login route (dashboard)
2. Discover routes (SPA-aware UI crawl):
   - collect link candidates from nav/sidebar/menu items and tab controls
   - BFS click-through: after interaction, wait for URL change or stable content-change heuristic
   - record route metadata (title/primary heading, how reached)
   - output `artifacts/<run-id>/platform/routes.json`
3. Per-route capture:
   - baseline reduced-motion captures across viewports
   - motion capture for micro-interactions (hover menus, dropdowns, modals)
4. Network capture:
   - write a run-level HAR: `artifacts/<run-id>/platform/network/platform.har`
   - write request index (JSONL) with method/url/status/resourceType/timing
5. Flow discovery (non-destructive):
   - detect top CTAs (“Create/New/Add/Next/Save/Publish”)
   - if safe, open and record resulting wizard/modal as a flow stub (no destructive submits)
   - enforce `ALLOW_DESTRUCTIVE` gating.

## Output
- `artifacts/<run-id>/platform/routes.json`
- `artifacts/<run-id>/platform/network/platform.har`
- `artifacts/<run-id>/platform/network/requests.jsonl`
- Per-route artifacts under `artifacts/<run-id>/platform/<routeKey>/...`

## Handoff
Phase 4e consumes `routes.json`, token/animation inventories, and flow artifacts to update the living Markdown knowledge base and indexes.

