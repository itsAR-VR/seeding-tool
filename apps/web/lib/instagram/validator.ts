import { chromium } from "playwright";
import { sanitizeFollowerCount } from "@/lib/creators/follower-count";
import {
  extractInstagramFollowerCountFromHtml,
  extractInstagramRecentVideoUrlsFromHtml,
  extractInstagramViewCountFromHtml,
  isInstagramProfileBlocked,
  isInstagramProfileMissing,
} from "@/lib/instagram/profile-html";

export type InstagramValidationErrorCode =
  | "missing_profile"
  | "blocked_or_login_wall"
  | "timeout"
  | "follower_count_not_found"
  | "zero_followers"
  | "out_of_range"
  | "navigation_failed";

export type InstagramValidationTarget = {
  creatorId?: string;
  handle: string;
  minFollowers?: number | null;
  maxFollowers?: number | null;
};

export type InstagramValidationResult = {
  creatorId: string | null;
  handle: string;
  url: string;
  followerCount: number | null;
  avgViews: number | null;
  checkedVideoCount: number;
  blocked: boolean;
  status: "valid" | "invalid";
  errorCode: InstagramValidationErrorCode | null;
  error: string | null;
};

export type InstagramValidationOptions = {
  concurrency?: number;
  headful?: boolean;
  includeAvgViews?: boolean;
  maxVideoPosts?: number;
  requestHandlerTimeoutSecs?: number;
  navigationTimeoutSecs?: number;
  sessionMaxAgeSecs?: number;
  sessionMaxUsageCount?: number;
  delayRangeMs?: [number, number];
  blockPauseMs?: number;
  maxPauseCycles?: number;
};

const DEFAULT_OPTIONS: Required<InstagramValidationOptions> = {
  concurrency: 1,
  headful: false,
  includeAvgViews: false,
  maxVideoPosts: 12,
  requestHandlerTimeoutSecs: 120,
  navigationTimeoutSecs: 45,
  sessionMaxAgeSecs: 300,
  sessionMaxUsageCount: 8,
  delayRangeMs: [600, 1800],
  blockPauseMs: 300_000,
  maxPauseCycles: 3,
};

function normalizeHandle(handle: string) {
  return handle.trim().replace(/^@/, "");
}

function getProxyServer() {
  const proxyUrls = process.env.CRAWLEE_PROXY_URLS?.split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (!proxyUrls?.length) {
    return undefined;
  }

  return proxyUrls[0];
}

function buildValidationUrl(handle: string) {
  return `https://www.instagram.com/${normalizeHandle(handle)}/`;
}

function classifyFollowerRange(
  followerCount: number,
  minFollowers?: number | null,
  maxFollowers?: number | null
) {
  if (minFollowers != null && followerCount < minFollowers) {
    return {
      errorCode: "out_of_range" as const,
      error: `follower_count_below_min:${minFollowers}`,
    };
  }

  if (maxFollowers != null && followerCount > maxFollowers) {
    return {
      errorCode: "out_of_range" as const,
      error: `follower_count_above_max:${maxFollowers}`,
    };
  }

  return null;
}

function classifyCrawlerFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (/timed? out|Timeout/i.test(message)) {
    return {
      errorCode: "timeout" as const,
      error: message,
    };
  }

  return {
    errorCode: "navigation_failed" as const,
    error: message,
  };
}

class AdaptiveDelayController {
  private minDelayMs: number;
  private maxDelayMs: number;
  private consecutiveBlocks = 0;
  private pauseCycles = 0;

  constructor(
    private readonly baseRange: [number, number],
    private readonly blockPauseMs: number,
    private readonly maxPauseCycles: number
  ) {
    this.minDelayMs = baseRange[0];
    this.maxDelayMs = baseRange[1];
  }

  nextDelay() {
    const delta = Math.max(0, this.maxDelayMs - this.minDelayMs);
    return this.minDelayMs + Math.floor(Math.random() * (delta + 1));
  }

  noteSuccess() {
    this.consecutiveBlocks = 0;
    this.minDelayMs = this.baseRange[0];
    this.maxDelayMs = this.baseRange[1];
  }

  async noteBlock(wait: (ms: number) => Promise<void>) {
    this.consecutiveBlocks += 1;
    this.minDelayMs = Math.min(this.minDelayMs * 2, 4_000);
    this.maxDelayMs = Math.min(this.maxDelayMs * 2, 8_000);

    if (
      this.consecutiveBlocks >= 5 &&
      this.pauseCycles < this.maxPauseCycles
    ) {
      this.pauseCycles += 1;
      this.consecutiveBlocks = 0;
      await wait(this.blockPauseMs);
    }
  }
}

async function computeAverageViews(
  page: import("playwright").Page,
  profileHtml: string,
  options: Required<InstagramValidationOptions>,
  delayController: AdaptiveDelayController
) {
  const videoUrls = extractInstagramRecentVideoUrlsFromHtml(
    profileHtml,
    options.maxVideoPosts
  );

  if (videoUrls.length === 0) {
    return {
      avgViews: null,
      checkedVideoCount: 0,
      blocked: false,
    };
  }

  const videoPage = await page.context().newPage();
  try {
    await videoPage.setExtraHTTPHeaders({
      "accept-language": "en-US,en;q=0.9",
      referer: "https://www.instagram.com/",
    });

    const viewCounts: number[] = [];

    for (const url of videoUrls) {
      await videoPage.waitForTimeout(delayController.nextDelay());
      await videoPage.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: options.navigationTimeoutSecs * 1_000,
      });
      await videoPage.waitForLoadState("domcontentloaded");

      const html = await videoPage.content();
      if (isInstagramProfileBlocked(html)) {
        await delayController.noteBlock((ms) => videoPage.waitForTimeout(ms));
        return {
          avgViews: null,
          checkedVideoCount: viewCounts.length,
          blocked: true,
        };
      }

      const viewCount = extractInstagramViewCountFromHtml(html);
      if (viewCount != null) {
        viewCounts.push(viewCount);
      }

      delayController.noteSuccess();
    }

    const avgViews =
      viewCounts.length > 0
        ? Math.round(
            viewCounts.reduce((sum, value) => sum + value, 0) /
              viewCounts.length
          )
        : null;

    return {
      avgViews,
      checkedVideoCount: viewCounts.length,
      blocked: false,
    };
  } finally {
    await videoPage.close().catch(() => undefined);
  }
}

export async function validateInstagramCreators(
  targets: InstagramValidationTarget[],
  rawOptions: InstagramValidationOptions = {}
): Promise<InstagramValidationResult[]> {
  const options = {
    ...DEFAULT_OPTIONS,
    ...rawOptions,
  };

  const delayController = new AdaptiveDelayController(
    options.delayRangeMs,
    options.blockPauseMs,
    options.maxPauseCycles
  );
  const results = new Map<string, InstagramValidationResult>();
  const proxyServer = getProxyServer();
  const browser = await chromium.launch({
    headless: !options.headful,
    ...(proxyServer ? { proxy: { server: proxyServer } } : {}),
  });

  const context = await browser.newContext({
    extraHTTPHeaders: {
      "accept-language": "en-US,en;q=0.9",
      referer: "https://www.instagram.com/",
    },
  });

  try {
    for (const rawTarget of targets) {
      const target = {
        ...rawTarget,
        handle: normalizeHandle(rawTarget.handle),
      };
      const handle = target.handle;
      const page = await context.newPage();

      try {
        await page.goto(buildValidationUrl(handle), {
          waitUntil: "domcontentloaded",
          timeout: options.navigationTimeoutSecs * 1_000,
        });
        await page.waitForLoadState("domcontentloaded");
        await page.waitForTimeout(delayController.nextDelay());

        const html = await page.content();

        if (isInstagramProfileBlocked(html)) {
          await delayController.noteBlock((ms) => page.waitForTimeout(ms));
          results.set(handle, {
            creatorId: target.creatorId ?? null,
            handle,
            url: page.url(),
            followerCount: null,
            avgViews: null,
            checkedVideoCount: 0,
            blocked: true,
            status: "invalid",
            errorCode: "blocked_or_login_wall",
            error: "blocked_or_login_wall",
          });
          continue;
        }

        if (isInstagramProfileMissing(html)) {
          results.set(handle, {
            creatorId: target.creatorId ?? null,
            handle,
            url: page.url(),
            followerCount: null,
            avgViews: null,
            checkedVideoCount: 0,
            blocked: false,
            status: "invalid",
            errorCode: "missing_profile",
            error: "missing_profile",
          });
          continue;
        }

        const followerCount = sanitizeFollowerCount(
          "instagram_html",
          extractInstagramFollowerCountFromHtml(html)
        );

        if (followerCount == null) {
          results.set(handle, {
            creatorId: target.creatorId ?? null,
            handle,
            url: page.url(),
            followerCount: null,
            avgViews: null,
            checkedVideoCount: 0,
            blocked: false,
            status: "invalid",
            errorCode: "follower_count_not_found",
            error: "follower_count_not_found",
          });
          continue;
        }

        if (followerCount <= 0) {
          results.set(handle, {
            creatorId: target.creatorId ?? null,
            handle,
            url: page.url(),
            followerCount,
            avgViews: null,
            checkedVideoCount: 0,
            blocked: false,
            status: "invalid",
            errorCode: "zero_followers",
            error: "zero_followers",
          });
          continue;
        }

        const followerRangeError = classifyFollowerRange(
          followerCount,
          target.minFollowers,
          target.maxFollowers
        );

        if (followerRangeError) {
          results.set(handle, {
            creatorId: target.creatorId ?? null,
            handle,
            url: page.url(),
            followerCount,
            avgViews: null,
            checkedVideoCount: 0,
            blocked: false,
            status: "invalid",
            errorCode: followerRangeError.errorCode,
            error: followerRangeError.error,
          });
          continue;
        }

        let avgViews: number | null = null;
        let checkedVideoCount = 0;

        if (options.includeAvgViews) {
          const avgViewResult = await computeAverageViews(
            page,
            html,
            options,
            delayController
          );

          avgViews = avgViewResult.avgViews;
          checkedVideoCount = avgViewResult.checkedVideoCount;

          if (avgViewResult.blocked) {
            results.set(handle, {
              creatorId: target.creatorId ?? null,
              handle,
              url: page.url(),
              followerCount: null,
              avgViews: null,
              checkedVideoCount,
              blocked: true,
              status: "invalid",
              errorCode: "blocked_or_login_wall",
              error: "blocked_or_login_wall",
            });
            continue;
          }
        }

        delayController.noteSuccess();
        results.set(handle, {
          creatorId: target.creatorId ?? null,
          handle,
          url: page.url(),
          followerCount,
          avgViews,
          checkedVideoCount,
          blocked: false,
          status: "valid",
          errorCode: null,
          error: null,
        });
      } catch (error) {
        const failure = classifyCrawlerFailure(error);

        results.set(handle, {
          creatorId: target.creatorId ?? null,
          handle,
          url: buildValidationUrl(handle),
          followerCount: null,
          avgViews: null,
          checkedVideoCount: 0,
          blocked: false,
          status: "invalid",
          errorCode: failure.errorCode,
          error: failure.error,
        });
      } finally {
        await page.close().catch(() => undefined);
      }
    }
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  return targets.map((target) => {
    const handle = normalizeHandle(target.handle);

    return (
      results.get(handle) ?? {
        creatorId: target.creatorId ?? null,
        handle,
        url: buildValidationUrl(handle),
        followerCount: null,
        avgViews: null,
        checkedVideoCount: 0,
        blocked: false,
        status: "invalid",
        errorCode: "navigation_failed",
        error: "no_result",
      }
    );
  });
}
