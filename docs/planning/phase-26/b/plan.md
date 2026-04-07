# Phase 26b — Multi-Platform Validation Framework

## Focus

Abstract the Instagram-only validation into a platform-agnostic interface. Add TikTok validation as the first additional platform.

## Inputs
- `apps/web/lib/instagram/validator.ts` (531 lines) — Instagram-specific Playwright scraping
- `apps/web/lib/creator-search/scoring/features.ts` — uses platform-agnostic metrics
- `CreatorProfile` model — already supports multiple platforms (instagram, tiktok, youtube, twitter)
- User decision: keep Playwright worker on Fly.io

## Skills Available for This Subphase
- `architect` — validation interface design
- `backend-coding-agent` — TikTok validator implementation
- `context7-docs` — Apify TikTok scraper docs
- `code-review` — post-implementation

## Work

### 1. Abstract Validator Interface

```ts
interface PlatformValidator {
  platform: string;
  validate(handle: string, options?: ValidationOptions): Promise<ValidationResult>;
}

interface ValidationResult {
  status: "valid" | "invalid" | "unknown" | "retry";
  followerCount?: number;
  avgViews?: number;
  engagementRate?: number;
  errorCode?: string;
}
```

### 2. Refactor Instagram Validator
Implement `PlatformValidator` interface on existing `validator.ts` without changing behavior.

### 3. Add TikTok Validator
Use Apify TikTok profile scraper to get follower count, avg views, engagement rate.

### 4. Update Scoring
`computeScaleFit()` and `computeEngagementQuality()` already use platform-agnostic metrics. Ensure multi-platform creators get their best platform's metrics.

### 5. Tests
- Test: Instagram validator still works via interface
- Test: TikTok validator returns follower count
- Test: multi-platform creator scored on best platform metrics

## Output
- Platform-agnostic validation interface
- TikTok validation via Apify
- Multi-platform scoring support

## Handoff
Subphase c (Analytics Dashboard) aggregates data from all platforms and lifecycle stages.
