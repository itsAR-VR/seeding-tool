# Phase 24 — Outreach Excellence

## Original User Request (verbatim)

I'm not sure if email outreach works and all the platforms are connected. I just want it to look good, work, not be clunky, and be intelligently designed.

## Purpose

Make email outreach professional, deliverable, and measurable. Transform plain-text-only emails into rich HTML with templates, add a warmup system so new aliases don't get spam-flagged, and cache Gmail tokens to eliminate redundant OAuth calls.

## Context

Phase 22 hardened the send pipeline (daily limits, List-Unsubscribe, suppression). Phase 24 builds on that to make outreach actually effective. Independent of Phase 23 — can run in parallel after Phase 22 is settled.

### Deep Sweep Confidence
- **65%** overall (token caching 95%, HTML templates 80%, warmup system 55%)
- Warmup is the wildcard — getting the schedule and feedback loop right requires deliverability domain expertise
- HTML emails must ship WITH warmup (switching from plain text to HTML without warmup will crater deliverability)

### Dependencies
- Phase 22a (daily send limits must be enforced before warmup makes sense)
- Phase 22c (AI model config for drafter)
- Phase 24a (token caching) is independent and can ship first

## Skills Available for Implementation
- `backend-coding-agent` — warmup scheduler, token caching
- `frontend-coding-agent` — HTML email templates
- `mo-book-email-deliverability-setup` — warmup schedule design, deliverability best practices
- `context7-docs` — React Email / MJML docs, Gmail OAuth token lifecycle
- `code-review` — post-implementation review

## Objectives
* [ ] HTML email templates with product images, branded headers, unsubscribe footer
* [ ] Email warmup system with gradual volume ramp and auto-pause on high bounce rates
* [ ] Gmail access token caching with 50-minute TTL
* [ ] Template variable system for personalization

## Constraints
- Warmup must ship before or simultaneously with HTML emails
- No external email template builder dependency for v1 (inline CSS, code-defined templates)
- Token caching must be in-memory (no Redis dependency for now)
- `EmailAlias.isWarmedUp` flag already exists in schema — use it

## Success Criteria
1. Outbound emails render correctly in Gmail, Outlook, Apple Mail
2. Warmup schedule progresses: 5→15→30→full over 14 days
3. Auto-pause when bounce rate > 5% in any 24h window
4. Token refresh calls reduced by 90%+ (cached for ~50 minutes)
5. `npm run build` + `vitest run` pass

## Subphase Index
* a — Gmail Token Caching (quick win, independent)
* b — Email Warmup System (foundational for deliverability)
* c — HTML Email Templates (depends on warmup being active)
