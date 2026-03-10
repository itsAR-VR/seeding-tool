import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  activeNavigations: 0,
  maxConcurrentNavigations: 0,
  pageCounter: 0,
}));

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => ({
        newContext: vi.fn(async () => ({
          newPage: vi.fn(async () => {
          const pageId = ++mockState.pageCounter;

          return {
            goto: vi.fn(async () => {
              mockState.activeNavigations += 1;
              mockState.maxConcurrentNavigations = Math.max(
                mockState.maxConcurrentNavigations,
                mockState.activeNavigations
              );
              await new Promise((resolve) => setTimeout(resolve, 20));
              mockState.activeNavigations -= 1;
            }),
            waitForLoadState: vi.fn(async () => undefined),
            waitForTimeout: vi.fn(async () => undefined),
            setExtraHTTPHeaders: vi.fn(async () => undefined),
            content: vi.fn(async () => "<html></html>"),
            url: vi.fn(() => `https://instagram.com/mock_${pageId}`),
            context: vi.fn(() => ({
              newPage: vi.fn(),
            })),
            close: vi.fn(async () => undefined),
          };
        }),
        close: vi.fn(async () => undefined),
      })),
      close: vi.fn(async () => undefined),
    })),
  },
}));

vi.mock("@/lib/instagram/profile-html", () => ({
  extractInstagramFollowerCountFromHtml: vi.fn(() => "12.4K"),
  extractInstagramRecentVideoUrlsFromHtml: vi.fn(() => []),
  extractInstagramViewCountFromHtml: vi.fn(() => 18_200),
  isInstagramProfileBlocked: vi.fn(() => false),
  isInstagramProfileMissing: vi.fn(() => false),
}));

import { validateInstagramCreators } from "@/lib/instagram/validator";

describe("validateInstagramCreators", () => {
  beforeEach(() => {
    mockState.activeNavigations = 0;
    mockState.maxConcurrentNavigations = 0;
    mockState.pageCounter = 0;
  });

  it("respects the requested concurrency with a bounded worker pool", async () => {
    const results = await validateInstagramCreators(
      [
        { handle: "creator_one" },
        { handle: "creator_two" },
        { handle: "creator_three" },
      ],
      {
        concurrency: 2,
        includeAvgViews: false,
        delayRangeMs: [0, 0],
      }
    );

    expect(results).toHaveLength(3);
    expect(results.every((result) => result.status === "valid")).toBe(true);
    expect(mockState.maxConcurrentNavigations).toBe(2);
  });
});
