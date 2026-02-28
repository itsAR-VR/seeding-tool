# Phase 2 — Competitive website teardown (TKS.world + Refunnel) + “fusion” build blueprint

> **Status:** Superseded by the merged plan in `docs/planning/phase-4/plan.md`. Phase 2 remains for history; implement Phase 4 going forward.

## Purpose
Produce a page-by-page, animation-aware teardown of `tks.world` and `refunnel.com` (structure, typography, motion, and interaction patterns) and synthesize it into a build-ready “fusion” blueprint: **TKS-like program/admissions funnel + TKS micro-animations**, with **Refunnel-level visual polish and motion design**, adapted to our non-SaaS offering.

## Context
You want to “rip” both sites in the sense of *understanding and recreating the experience*—not copying proprietary assets or shipping their code. The deliverable is a concrete implementation guide and asset-independent specs:
- TKS provides the business model + funnel shape (program/admissions) and you like its micro-animations.
- Refunnel provides a modern, premium marketing aesthetic and motion polish, but its SaaS positioning does not map to our product; we’ll borrow its structure/patterns and adapt the content and flows to a TKS-like model.
- We will use Microsoft Playwright MCP for interactive inspection and a repeatable Playwright capture runner for batch screenshots, DOM snapshots, and short recordings.

Initial reconnaissance (Playwright MCP) indicates:
- **TKS** exposes a public `sitemap.xml` with core marketing pages and programs.
- **Refunnel** does **not** expose a usable `sitemap.xml` (404), and appears to load Cloudflare/Turnstile resources on some visits, so route discovery must be crawl-based and capture runs must throttle and allow manual checkpoints.
- Both sites load Webflow-hosted assets and use GSAP-family animation tooling; TKS additionally loads Lenis, ScrollToPlugin, and Swiper.
- Typography signals:
  - Refunnel: body uses “SF Pro Display”; headings use “Cabinet Grotesk” (font-family appears as `Cabinetgrotesk`).
  - TKS: secondary headings use “PP Neue Montreal” (font-family appears as `Ppneuemontreal`).

## Concurrent Phases

| Phase | Status | Overlap | Coordination |
|-------|--------|---------|--------------|
| Phase 1 | Active | Domain: Playwright audit harness + capture/output contracts | Reuse/extend Phase 1’s output contract (`artifacts/<run-id>/…`, `docs/audit/…`) so competitor capture artifacts slot into the same system. Avoid creating a parallel, incompatible structure. |

## Objectives
* [ ] Enumerate and verify as many public pages as feasible for both sites (route inventory with status + canonical URLs).
* [ ] Capture multi-viewport screenshots + DOM snapshots per page and maintain a per-site page index.
* [ ] Extract and document typography (fonts, sizes, weights, spacing), color/tone tokens, layout patterns, and key reusable components.
* [ ] Identify and record motion patterns (scroll/hover/entrance micro-animations), including triggers and timing/easing.
* [ ] Produce “fusion” page templates and motion specs that map to our TKS-like funnel (non-SaaS), plus a prioritized build backlog that plugs into the existing roadmap.

## Constraints
- **Do not copy** proprietary code, images, or brand assets from competitor sites. Captures are for internal reference; the rebuild must use original assets and reimplemented motion patterns.
- **No bypassing** CAPTCHAs/bot protections (Cloudflare/Turnstile). Use headed mode and manual checkpoints when needed; throttle requests to minimize triggering defenses.
- **Crawl scope:** “as much as possible” on public, same-origin pages, with hard caps:
  - Only `https://www.tks.world/*` and `https://refunnel.com/*`
  - Exclude subdomains and external apps (e.g., `application.tks.world`, `app.refunnel.com`)
  - De-dupe URLs by canonicalized path (strip `utm_*`, hash fragments, and known tracking query params)
  - Stop at `MAX_PAGES=200` per site unless explicitly increased
- **Artifact storage:** store under `artifacts/<run-id>/competitors/...` and keep `artifacts/` out of git (gitignored), consistent with Phase 1.
- **Target implementation stack:** Next.js + Tailwind + GSAP (ScrollTrigger + SplitText) with Lenis-style smooth scrolling if it’s part of the “feel”; no dependency on Webflow runtime.

## Success Criteria
- A reproducible capture run produces (for each site):
  - `artifacts/<run-id>/competitors/<site>/routes.json` (URL list + status + title + canonical URL)
  - Per-route screenshots for desktop/tablet/mobile and DOM snapshot (`.html` or serialized DOM JSON)
  - `artifacts/<run-id>/competitors/<site>/typography.json` and `motion.json`
  - Short video clips (or step screenshots) showing the top 10 motion patterns per site
- Documentation exists under `docs/audit/pages/competitors/`:
  - One Markdown file per page with: structure outline, components, typography, and motion notes
  - A per-site index and a global “fusion blueprint” doc
- A build-ready “fusion” blueprint exists mapping:
  - Our intended funnel IA (TKS-like) → page templates
  - Refunnel-inspired visual patterns → reusable components
  - Motion patterns → a small, named animation library with parameters (durations, easing, triggers)

## Subphase Index
* a — Establish competitor capture runner + route inventories
* b — TKS teardown (page-by-page structure + typography + motion evidence)
* c — Refunnel teardown (page-by-page structure + typography + motion evidence)
* d — Motion/typography “library” spec + component pattern catalog
* e — “Fusion” site blueprint + implementation backlog (integrated with roadmap)
