# Phase 4 — Unified Playwright audit system (owned + competitors) + blueprint outputs

## Purpose
Consolidate Phase 1 (Aha marketing + platform audit) and Phase 2 (competitor teardown) into one decision-complete plan for a single Playwright-based audit system that captures pages, tokens, and micro-animations into living docs and build-ready blueprints.

## Context
We have two overlapping plans:
- **Phase 1** focuses on building an “audit pack” for our owned product (`aha.inc` + `platform.aha.inc`), including auth bootstrap, onboarding recording, and an app “everything” crawl.
- **Phase 2** focuses on competitor teardown (`tks.world` + `refunnel.com`) with anti-bot hygiene and a “fusion” motion/typography/component spec.

Both phases require the same core primitives (route discovery, deterministic page capture, motion evidence capture, token extraction, and Markdown reporting). This phase merges the overlap and keeps the best parts:
- Phase 1’s **auth + flow recorder + network logging** (HAR + request index).
- Phase 2’s **throttled competitor crawling** + **explicit “no asset/code copying” constraints** + **motion/typography library synthesis**.

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 1 | Superseded | Domain: Aha audit blueprint | Merged into Phase 4 |
| Phase 2 | Superseded | Domain: Competitor teardown | Merged into Phase 4 |
| Phase 3 | Superseded | Domain: Aha audit harness | Never implemented; Phase 4 is the canonical starting point |

**Note:** The repo is empty (no code exists). Phase 4a must scaffold from scratch.

## Objectives
* [x] Ship one reusable Playwright audit harness that supports multiple sites and auth/no-auth contexts.
* [x] Implement deterministic baseline (reduced motion) and motion evidence (micro-interactions) capture primitives.
* [x] Implement OAuth bootstrap runner (manual) and onboarding flow recorder for the authenticated app.
* [ ] Capture the full campaign creation flow and catalog key dashboard surfaces.
* [x] Implement competitor marketing crawlers with throttling and challenge detection.
* [x] Implement living Markdown docs generation (pages + index + runbook).
* [x] Implement blueprint generation outputs:
  - Owned-site rebuild blueprint (Aha 1:1 parity)
  - Competitor “fusion” blueprint (patterns + motion library, using original assets)

## Constraints
- **Authorization:** only audit/crawl sites you are authorized to access. Competitor capture is for internal reference; do not copy proprietary code/assets.
- **No bypassing bot protections:** do not bypass CAPTCHA/MFA/Cloudflare/Turnstile; use headed/manual checkpoints and throttle.
- **Production safety (owned app):** default `ALLOW_DESTRUCTIVE=0`; allow only safe writes needed to proceed in a test org, prefixing data with `PW_TEST_`.
- **Data sensitivity:** artifacts may contain sensitive data (screenshots/HAR). Store under `artifacts/` and keep `artifacts/` + `.auth/` out of git.
- **Determinism:** baseline capture runs with reduced motion and stable waits (`document.fonts.ready`, timeboxed network idle).
- **Single output contract:** do not create parallel artifact/doc directory conventions per site.

## Repo Reality Check (RED TEAM)

- What exists today:
  - `src/audit/runners/platform-campaign.ts`
  - `src/audit/runners/platform.ts`
  - `src/audit/capture/flow.ts`
  - `docs/audit/flows/platform/onboarding.md`
  - `docs/audit/flows/platform/campaign-create.md`
- What the plan assumes:
  - Manual login + manual campaign flow navigation during capture
  - Storage state files present in `.auth/`
  - Route discovery relies on in-app anchors (may undercount SPA routes)
- Verified touch points:
  - Platform flow capture: `src/audit/capture/flow.ts`
  - Campaign flow runner: `src/audit/runners/platform-campaign.ts`
  - Platform audit runner: `src/audit/runners/platform.ts`

## RED TEAM Findings (Gaps / Weak Spots)

### Highest-risk failure modes
- Manual campaign flow not completed within step timeout → increase `FLOW_STEP_TIMEOUT_MS` or re-run with user ready.

### Missing or ambiguous requirements
- “Complete catalog” scope is undefined → need a list of must-cover surfaces or deep links.

### Repo mismatches (fix the plan)
- Platform route discovery currently captures only 6 routes → add deep-link seeding or nav click exploration if full catalog required.

### Performance / timeouts
- Manual flow capture depends on per-step timeout → document recommended values (60–120s).

### Security / permissions
- Campaign creation is a write action → ensure `ALLOW_WRITES=1` only in test org.

### Testing / validation
- Validate campaign flow doc has ≥5 steps before marking success.

## Open Questions (Need Human Input)

- [ ] What pages/sections define the “complete catalog” for the platform? (confidence <90%)
  - Why it matters: determines whether we add deep-link seeds or interactive nav exploration.
  - Current assumption in this plan: capture campaign flow + core routes (`/home`, `/campaign`, `/report`) and extend as links allow.

## Assumptions (Agent)

- Campaign creation can be performed with sample data in a non-production test org. (confidence >=90%)
  - Mitigation question/check (optional): confirm the test org and whether new entities should be prefixed with `PW_TEST_`.

## Success Criteria
- [x] A single command suite exists (examples):
  - `npm run audit:marketing` (owned marketing; sitemap + crawl)
  - `npm run audit:platform:bootstrap` (manual OAuth; records onboarding; saves storageState)
  - `npm run audit:platform:campaign` (manual campaign flow capture)
  - `npm run audit:platform` (authenticated IA crawl; page capture + HAR)
  - `npm run audit:competitors` (tks + refunnel route discovery + capture with throttling)
  - `npm run audit:report` (regenerate docs)
- [x] Running the audits produces:
  - Verified `routes.json` per site/context *(live run: 20260203-122609)*
  - Per-route baseline screenshots + DOM snapshot + a11y snapshot *(live run: 20260203-122609)*
  - Motion evidence: event logs + short videos (or step screenshots) *(live run: 20260203-122609)*
  - Token inventories (typography/colors/radii/shadows) and animation inventories (`@keyframes` + observed usage) *(live run: 20260203-122609)*
  - Updated docs under `docs/audit/` with global indexes and per-page docs *(generated from run 20260203-122609)*
- [ ] Campaign flow docs:
  - `docs/audit/flows/platform/campaign-create.md` with step table + screenshots
- [x] Blueprint docs generation exists (grounded once audits are run):
  - `docs/audit/blueprints/owned/rebuild-blueprint.md` + `parity-tests.md`
  - `docs/audit/blueprints/fusion/` with typography, motion, components, blueprint, and backlog

## Subphase Index
* a — Scaffold project from scratch + config + output contract
* b — Implement shared capture + token/motion/network primitives
* c — Implement marketing runners (owned + competitors) + route inventories
* d — Implement authenticated app runners (bootstrap + onboarding + IA crawl)
* e — Implement Markdown reporter + runbook + indexes
* f — Synthesize design system + motion library + blueprints + parity tests/backlog
* g — Capture campaign creation flow + expand platform catalog

## Subphase Dependencies
```
4a (scaffold) → 4b (primitives)
                     ↓
          ┌─────────┴─────────┐
          4c (marketing)    4d (platform)
                  └─────────┬─────────┘
                            4e (docs)
                               ↓
                            4f (blueprints)
```
Execute sequentially: 4a → 4b → (4c ∥ 4d) → 4e → 4f → 4g. Phases 4c and 4d may run in parallel after 4b completes.

## Canonical URLs
| Site | Canonical Base URL |
|------|-------------------|
| Aha Marketing | `https://aha.inc` |
| Aha Platform | `https://platform.aha.inc` |
| TKS | `https://www.tks.world` |
| Refunnel | `https://refunnel.com` |

All runners must follow redirects and store the final canonical URL in route inventories.

## Cleanup Strategy
After each audit cycle:
- Delete all entities prefixed `PW_TEST_*` via platform UI or API
- Regenerate `.auth/*.storageState.json` if older than 7 days
- Archive old `artifacts/<run-id>/` directories to external storage if needed

## Phase Summary

### Shipped
- Complete TypeScript + Playwright audit harness (24 TypeScript modules)
- All 6 subphases (4a–4f) implemented in sequence
- Shared capture primitives: baseline, motion, tokens, animations, network (HAR scrubbing)
- Runners: marketing (owned), competitors (throttled + challenge detection), platform (bootstrap + authenticated crawl)
- Reporting: Markdown doc generator + blueprint generators (owned rebuild + fusion)
- CLI scripts: `audit:marketing`, `audit:platform:bootstrap`, `audit:platform`, `audit:competitors`, `audit:report`, `audit:all`
- Key files:
  - `src/audit/config.ts` — centralized env-based configuration
  - `src/audit/capture/` — baseline, motion, tokens, animations, network, flow primitives
  - `src/audit/runners/` — marketing, competitors, platform-bootstrap, platform
  - `src/audit/report/` — report + blueprints generators
  - `src/audit/utils/` — url, robots, crawl, challenge, page, time, fs, run-summary

### Verified
- `npx tsc --noEmit`: ✅ **PASS** (no type errors)
- `npm run lint`: ⚠️ **SKIP** (script not defined; follow-up)
- `npm run build`: ⚠️ **SKIP** (script not defined; follow-up)

### Notes
- **Live audit run complete:** `20260203-122609` (marketing + competitors + platform) with docs regenerated via `audit:report`.
- **Onboarding capture updated:** manual run captured 20 steps (`RUN_ID=20260203-195449`), still not marked complete (no dashboard finish).
- **Follow-ups:** Add lint/build scripts to package.json; complete campaign flow capture; expand platform route discovery beyond 6 routes.

See `docs/planning/phase-4/review.md` for detailed verification results and follow-up actions.

## Phase Summary (running)
- 2026-02-04 12:06:53 — Added campaign flow subphase + runner + manual flow capture support (files: `docs/planning/phase-4/plan.md`, `docs/planning/phase-4/g/plan.md`, `src/audit/runners/platform-campaign.ts`, `package.json`)
- 2026-02-04 12:11:17 — Ran campaign flow capture + platform audit (campaign steps incomplete; routes still 6) (files: `docs/planning/phase-4/g/plan.md`)
