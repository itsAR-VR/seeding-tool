# Phase 26 — Platform Expansion

## Original User Request (verbatim)

I'm not sure if email outreach works and all the platforms are connected. I just want it to look good, work, not be clunky, and be intelligently designed.

## Purpose

Expand the platform beyond its current Instagram-email-only footprint. Wire the existing Instagram Graph API to mention attribution, add multi-platform validation, and build a campaign analytics dashboard.

## Context

The Instagram Graph API client (`lib/instagram/client.ts`, 356 lines) is fully implemented with tagged media, mentioned media, insights, and token refresh. The mention poll Inngest function exists. What's missing is wiring detected mentions to the CampaignCreator lifecycle and building attribution metrics.

### Ultraplan Corrections
- Instagram Graph API is NOT a stub — it's a full 356-line implementation
- `instagram-mention-poll.ts` already polls for tagged media every 15 minutes
- Missing: `@mentions` detection (only tags polled), lifecycle wiring, attribution

### Deep Sweep Confidence
- **45%** overall (mention wiring 75%, multi-platform 60%, real-time inbox 30%)
- Real-time inbox on Vercel serverless is highest risk (WebSocket impossible, SSE limited by timeouts)
- Recommendation: defer real-time inbox to separate phase, use Supabase Realtime if pursued

### Dependencies
- Phase 24 (HTML email templates) for rich notification emails
- Phase 25 (scoring) for multi-platform score adjustments

## Skills Available for Implementation
- `backend-coding-agent` — mention attribution, analytics aggregation
- `frontend-coding-agent` — analytics dashboard
- `architect` — multi-platform validation architecture
- `context7-docs` — Instagram Graph API docs, Supabase Realtime docs
- `code-review` — post-implementation

## Objectives
* [ ] Instagram mention detection wired to CampaignCreator lifecycle
* [ ] Mention attribution with engagement metrics
* [ ] Multi-platform validation framework (TikTok, YouTube)
* [ ] Campaign analytics dashboard with funnel visualization

## Constraints
- Instagram API rate limit: 200 calls/user/hour — must be conservative
- No real-time inbox in this phase (deferred — too risky for serverless)
- Keep Playwright worker for Instagram validation alongside API enrichment
- Multi-platform validation: TikTok first (largest adjacent platform)

## Success Criteria
1. Detected mentions update `CampaignCreator.lifecycleStatus` to `posted`
2. Mention engagement metrics (likes, comments, reach) stored and displayed
3. Campaign funnel: Discovered → Outreached → Replied → Shipped → Posted
4. Conversion rates at each funnel stage
5. TikTok validation via Apify scraper returns follower counts

## Subphase Index
* a — Instagram Mention Attribution (wire existing client to lifecycle)
* b — Multi-Platform Validation Framework (abstract + add TikTok)
* c — Campaign Analytics Dashboard (funnel, conversion rates, cost per post)
