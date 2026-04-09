# Phase 28d — Split Oversized Files

## Focus

Break the 3 files over 1000 lines into focused modules. Target: no lib/ file over 800 lines, no page file over 600 lines.

Confidence: **82%**

## Work

### 1. Split `onboarding/page.tsx` (1498 lines)

**Current**: One massive Server Component with all onboarding steps inline.

**Split into**:
- `onboarding/page.tsx` — orchestrator only (~100 lines): step routing, layout
- `onboarding/components/brand-step.tsx` — brand creation form
- `onboarding/components/discovery-step.tsx` — discovery preferences
- `onboarding/components/connect-step.tsx` — integration connections
- `onboarding/components/preset-step.tsx` — feature flag preset selection (Phase 27c)
- `onboarding/components/done-step.tsx` — completion screen
- `onboarding/components/stepper.tsx` — step indicator UI

**Rule**: Pure structural refactor. Zero behavior changes. Each component receives props from the orchestrator.

### 2. Split `creators/page.tsx` (1384 lines)

**Note**: This file is `"use client"` (Client Component), not Server Component. It has 35+ intertwined `useState` calls in one monolithic function. Splitting requires addressing state management.

**State management approach**:
- Extract a `useCreatorsState()` custom hook that encapsulates all 35+ state variables
- Sub-components receive the hook's return value as props

**Split into**:
- `creators/page.tsx` — layout + `useCreatorsState()` orchestration (~150 lines)
- `creators/hooks/use-creators-state.ts` — all 35+ useState calls in a custom hook
- `creators/components/creators-table.tsx` — table rendering + sorting
- `creators/components/creator-filters.tsx` — filter sidebar/dropdowns
- `creators/components/creator-modals.tsx` — import/export/bulk action modals
- `creators/components/search-creators-modal.tsx` — search modal (if it exists inline)

### 3. Delete Dead Worker + Split Job Runner

**`lib/workers/creator-search.ts` (1234 lines) -- DEAD CODE**:
Zero importers anywhere in the codebase. This is NOT an HTTP server -- it's a library module with one export. Delete entirely.

**`lib/creator-search/job-runner.ts` (849 lines) -- Split into**:
- `job-runner.ts` -- orchestration (~300 lines)
- `job-persistence.ts` -- `persistDiscoveredCandidate` and related DB ops
- `job-validation.ts` -- `validateDiscoveryCandidates` and validation logic

### 4. Assess Remaining >400 Line Files

For files 400-800 lines, document whether splitting is warranted:
- `orchestrator.ts` (729) -- complex interdependencies, split is risky
- `validator.ts` (530) -- self-contained Playwright module, splitting adds coupling

Decision: document but don't split unless the file is actively causing merge conflicts or comprehension issues.

Note: `job-runner.ts` (849 lines) moved from this "assess" section to the "split" section above (item 3).

## Deep Sweep Corrections Applied

- [x] CRITICAL: `lib/workers/creator-search.ts` (1234 lines) is DEAD CODE -- zero importers anywhere in the codebase. The original plan said "split into 4 files" but this is splitting dead code into 4 files of dead code. Changed to: delete entirely.
- [x] HIGH: `creators/page.tsx` has 35+ intertwined `useState` calls in one monolithic function. The original plan said "pure structural refactor" but didn't address state management. Added: extract `useCreatorsState()` custom hook.
- [x] HIGH: `job-runner.ts` (849 lines) was in the "assess but don't split" section. Moved to the "split" section -- this is the file that ACTUALLY needs splitting.
- [x] MEDIUM: Original plan described `creator-search.ts` as "HTTP server + orchestration" -- it is NOT an HTTP server. It's a library module with one export. Corrected.
- [x] LOW: `onboarding/page.tsx` is `"use client"` (Client Component), not Server Component as the plan implied. Split is still feasible -- existing function structure maps to file structure.

Confidence reduced from 85% to 82% -- creators split is harder than planned due to state management.

## Tests

- Verify: all tests pass after each split (run between each file)
- Verify: `npx tsc --noEmit` — no new errors
- Verify: no behavioral changes (same props, same rendering, same API)

## Output

(empty — to be filled after implementation)
