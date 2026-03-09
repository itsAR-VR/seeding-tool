# Phase 11b — PainChaosAnimation + AINetworkAnimation

## Focus

Implement the two IntersectionObserver-triggered GSAP animations:
1. `PainChaosAnimation.tsx` — chaos SVG resolves to order on scroll entry
2. `AINetworkAnimation.tsx` — network node pulse animation on scroll entry

Both use `useGSAP` from `@gsap/react` with an IntersectionObserver trigger (no ScrollTrigger pin needed).

## Inputs

- Phase 11a: gsap installed, stub files at `apps/web/app/(marketing)/components/animations/`
- `HomeContent.tsx` data: `frictionCards` (3 pain cards) + `aiCapabilities` (4 items)
- Brand tokens: `--color-brand-ink`, `--color-brand-primary`, `--color-brand-coral`, `--color-brand-teal`, `--color-brand-primary-soft`

## Skills Available for This Subphase

- `impeccable-animate` — GSAP timeline patterns
- `frontend-design` — SVG storytelling composition

## Work

### PainChaosAnimation.tsx

SVG-based animation that shows the "before state" chaos:
- 3 creator cards rendered as SVG rects, initially scattered/rotated/overlapping
- Spreadsheet-like grid rows behind them (opacity 0.3, light lines)
- GSAP timeline on scroll entry: cards fly in from random positions → rotate to 0deg → snap into a clean grid
- Background chaos: small scattered dots/emojis (SVG text elements) → fade out as order resolves
- Reduced motion: skip GSAP, show final "ordered" state directly
- Section heading + frictionCards text content stays in HomeContent.tsx; this component sits BELOW the `.section-block` heading inside `.pain-strip`

### AINetworkAnimation.tsx

SVG neural network visualization:
- 3 layers: input nodes (6), middle nodes (4), output nodes (2)
- SVG lines connecting layers (paths)
- GSAP timeline on scroll entry: nodes scale in (stagger), then signal pulses flow along paths (stroke-dashoffset animation)
- Each capability (fit scoring, reply triage, exception flags, post detection) labels a node cluster
- Reduced motion: static SVG with no motion
- Sits below `.section-block` heading inside `.intelligence-section`

## Output

- `PainChaosAnimation.tsx` — full implementation
- `AINetworkAnimation.tsx` — full implementation
- Both export valid React components, no TypeScript errors

## Handoff

Phase 11c receives: pain and AI sections animated. Proceed to WorkflowPipelineAnimation (ScrollTrigger pin).

## Progress This Turn (Terminus Maximus)

- Work done: Subphase plan created. Implementation follows immediately.
- Blockers: none
- Next concrete steps: implement PainChaosAnimation.tsx
