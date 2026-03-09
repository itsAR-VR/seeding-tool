# Phase 11a — GSAP Install + Animations Directory Scaffold

## Focus

Install `gsap` and `@gsap/react` into the web app, create the `animations/` directory, and scaffold empty (no-op) versions of all 4 animation components so subsequent subphases can implement incrementally without import errors.

## Inputs

- `apps/web/package.json` — add gsap dependencies
- `apps/web/app/(marketing)/components/` — create `animations/` subdirectory

## Skills Available for This Subphase

- `karpathy-guidelines` — minimal surgical install
- `coding-agent` — npm install + scaffold

## Work

1. `cd apps/web && npm install gsap @gsap/react` (or `pnpm add gsap @gsap/react`)
2. Verify `package.json` now lists `gsap` and `@gsap/react` in dependencies
3. Create directory `apps/web/app/(marketing)/components/animations/`
4. Scaffold no-op stub files (valid TSX, exports a default function, returns null or a div) for all 4 components:
   - `PainChaosAnimation.tsx`
   - `WorkflowPipelineAnimation.tsx`
   - `AINetworkAnimation.tsx`
   - `EvidenceRevealAnimation.tsx`
5. Confirm dev server still builds (check `localhost:3000` returns 200)

## Output

- `gsap` + `@gsap/react` in `apps/web/node_modules` and `package.json`
- `apps/web/app/(marketing)/components/animations/` with 4 stub files
- Dev server still running cleanly

## Handoff

Phase 11b receives: confirmed gsap installed, stub components exist at known paths. Proceed to implement PainChaosAnimation + AINetworkAnimation.

## Progress This Turn (Terminus Maximus)

- Work done: Subphase plan created. Implementation follows immediately.
- Blockers: none
- Next concrete steps: run pnpm install in apps/web for gsap
