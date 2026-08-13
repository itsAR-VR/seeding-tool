# Phase 28 — Codebase Health & Refactoring

## Original User Request (verbatim)

Create a new /phase-plan to do all of this.

(Referring to the full codebase health audit: fix pre-existing failures, delete dead code, add missing indexes, consolidate duplicates, split oversized files, close test coverage gaps.)

## Purpose

Pay down accumulated tech debt from the Phases 22-27 build sprint. The code works and tests pass, but 15 files exceed 400 lines, 6 modules are dead, 20 models lack `brandId` indexes, and 46% of lib modules have zero tests. Clean foundation = faster future work.

## Context

- Phase 27 just shipped (55b1af5) — the lifecycle now runs end-to-end
- 472 tests pass, 1 pre-existing failure (gmail.test.ts), 1 pre-existing TS error (classification.test.ts)
- 22 Inngest functions registered, 57 Prisma models
- No new features in this phase — pure cleanup and hardening

## Skills Available

- `refactor-cleaner` — dead code removal, file splitting
- `tdd-guide` — test coverage gaps
- `database-reviewer` — schema indexes
- `code-review` — post-refactor validation
- `typescript-reviewer` — type safety

## Objectives

* [ ] Zero pre-existing test failures (was 1)
* [ ] Zero pre-existing TS errors (was 1)
* [ ] Zero `console.log` in production code (was 9)
* [ ] Zero dead modules (was 5 -- sentry.ts is NOT dead)
* [ ] All `brandId` columns indexed (was 11 missing -- 9 already covered by compound indexes)
* [ ] All `status` columns indexed (was 6 justified -- 5 removed from original list)
* [ ] No file over 800 lines in lib/ (was 3 over 1000)
* [ ] Core business logic tested: orchestrator, decision-engine, classification-llm
* [ ] DM module boundaries clarified (not consolidated -- they serve different use cases)

## Subphase Index

| Sub | Scope | Effort | Dependencies |
|-----|-------|--------|-------------|
| a | Quick Wins: fix failures, delete dead code, clean console.logs | 1 hour | None |
| b | Database Indexes: brandId + status indexes | Half day | None |
| c | Consolidate Duplicates: unipile DMs, shared constants | Half day | None |
| d | Split Oversized Files: onboarding, creators, worker | 1-2 days | None |
| e | Test Coverage: orchestrator, decision-engine, classification-llm, key gaps | 1-2 days | a (needs clean baseline) |

**All subphases are independent except e depends on a (clean test baseline).**

## Execution Order

```
Parallel:  28a + 28b + 28c + 28d
Sequential: 28e (after 28a for clean test baseline)
```

Total: ~3-4 days

## Deep Sweep Confidence

| Sub | Original | Corrected | Key Corrections |
|-----|----------|-----------|-----------------|
| a | 95% | 93% | sentry.ts is NOT dead, threads.ts needs mock cleanup, multi-platform.ts needs test cleanup |
| b | 95% | 95% | Only 11 models need brandId index (not 20), 6 models need status index (not 11) |
| c | 90% | 92% | DM modules serve different purposes -- clarify, don't merge |
| d | 85% | 82% | workers/creator-search.ts is dead code (delete, don't split); creators needs state management |
| e | 88% | 88% | No changes |
