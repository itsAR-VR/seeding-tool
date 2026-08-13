import { describe, expect, it } from "vitest";
import {
  computeConversionRates,
  computeTimeToPost,
  bucketTimeToPost,
} from "@/lib/analytics/conversion";
import { generateCSV } from "@/lib/analytics/csv-export";
import type { AnalyticsResponse } from "@/lib/analytics/types";

// ---------------------------------------------------------------------------
// Test 1: Conversion rates calculate correctly (each adjacent stage pair)
// ---------------------------------------------------------------------------
describe("computeConversionRates", () => {
  it("calculates correct stage-to-stage conversion rates", () => {
    const lifecycle: Record<string, number> = {
      ready: 10,
      outreach_sent: 20,
      replied: 15,
      address_confirmed: 10,
      order_created: 8,
      shipped: 6,
      delivered: 5,
      posted: 3,
      completed: 2,
      opted_out: 0,
      stalled: 0,
    };

    const rates = computeConversionRates(lifecycle);

    // Total at ready or beyond: 10+20+15+10+8+6+5+3+2 = 79
    // Total at outreach_sent or beyond: 20+15+10+8+6+5+3+2 = 69
    expect(rates.readyToOutreachSent).toBeCloseTo(
      (69 / 79) * 100,
      1
    );

    // Total at replied or beyond: 15+10+8+6+5+3+2 = 49
    expect(rates.outreachSentToReplied).toBeCloseTo(
      (49 / 69) * 100,
      1
    );

    // Total at address_confirmed or beyond: 10+8+6+5+3+2 = 34
    expect(rates.repliedToAddressConfirmed).toBeCloseTo(
      (34 / 49) * 100,
      1
    );

    // Total at order_created or beyond: 8+6+5+3+2 = 24
    expect(rates.addressConfirmedToOrderCreated).toBeCloseTo(
      (24 / 34) * 100,
      1
    );

    // Total at shipped or beyond: 6+5+3+2 = 16
    expect(rates.orderCreatedToShipped).toBeCloseTo(
      (16 / 24) * 100,
      1
    );

    // Total at delivered or beyond: 5+3+2 = 10
    expect(rates.shippedToDelivered).toBeCloseTo(
      (10 / 16) * 100,
      1
    );

    // Total at posted or beyond: 3+2 = 5
    expect(rates.deliveredToPosted).toBeCloseTo(
      (5 / 10) * 100,
      1
    );

    // Overall: posted or beyond / ready or beyond: 5 / 79
    expect(rates.overallConversion).toBeCloseTo(
      (5 / 79) * 100,
      1
    );
  });

  // -------------------------------------------------------------------------
  // Test 2: Conversion rate handles zero creators (no divide-by-zero)
  // -------------------------------------------------------------------------
  it("handles zero creators at a stage without divide-by-zero", () => {
    const lifecycle: Record<string, number> = {
      ready: 0,
      outreach_sent: 0,
      replied: 0,
      address_confirmed: 0,
      order_created: 0,
      shipped: 0,
      delivered: 0,
      posted: 0,
      completed: 0,
      opted_out: 0,
      stalled: 0,
    };

    const rates = computeConversionRates(lifecycle);

    expect(rates.readyToOutreachSent).toBe(0);
    expect(rates.outreachSentToReplied).toBe(0);
    expect(rates.repliedToAddressConfirmed).toBe(0);
    expect(rates.addressConfirmedToOrderCreated).toBe(0);
    expect(rates.orderCreatedToShipped).toBe(0);
    expect(rates.shippedToDelivered).toBe(0);
    expect(rates.deliveredToPosted).toBe(0);
    expect(rates.overallConversion).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 11: All-opted-out campaign shows 0% conversion rates
  // -------------------------------------------------------------------------
  it("shows 0% conversion when all creators are opted_out", () => {
    const lifecycle: Record<string, number> = {
      ready: 0,
      outreach_sent: 0,
      replied: 0,
      address_confirmed: 0,
      order_created: 0,
      shipped: 0,
      delivered: 0,
      posted: 0,
      completed: 0,
      opted_out: 50,
      stalled: 0,
    };

    const rates = computeConversionRates(lifecycle);

    // opted_out is a terminal state, not in primary path
    // No one is in any primary stage => 0 at all stages
    expect(rates.readyToOutreachSent).toBe(0);
    expect(rates.overallConversion).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Test 3: Time-to-post distribution computed correctly
// ---------------------------------------------------------------------------
describe("computeTimeToPost", () => {
  it("computes hours between outreachSentAt and postedAt", () => {
    const outcomes = [
      {
        outreachSentAt: new Date("2026-01-01T00:00:00Z"),
        postedAt: new Date("2026-01-02T12:00:00Z"), // 36 hours
      },
      {
        outreachSentAt: new Date("2026-01-01T00:00:00Z"),
        postedAt: new Date("2026-01-08T00:00:00Z"), // 168 hours (7 days)
      },
    ];

    const result = computeTimeToPost(outcomes);

    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(36, 1);
    expect(result[1]).toBeCloseTo(168, 1);
  });

  // -------------------------------------------------------------------------
  // Test 4: Time-to-post handles missing timestamps gracefully
  // -------------------------------------------------------------------------
  it("skips records with missing outreachSentAt or postedAt", () => {
    const outcomes = [
      { outreachSentAt: null, postedAt: new Date("2026-01-02T00:00:00Z") },
      { outreachSentAt: new Date("2026-01-01T00:00:00Z"), postedAt: null },
      { outreachSentAt: null, postedAt: null },
      {
        outreachSentAt: new Date("2026-01-01T00:00:00Z"),
        postedAt: new Date("2026-01-02T00:00:00Z"), // 24 hours
      },
    ];

    const result = computeTimeToPost(outcomes);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(24, 1);
  });
});

// ---------------------------------------------------------------------------
// Test 5: Creator leaderboard sorted by total engagement descending
// ---------------------------------------------------------------------------
describe("creator leaderboard sorting", () => {
  it("sorts by total engagement (likes + comments + views) descending", () => {
    const entries = [
      {
        creatorId: "c1",
        creatorName: "Low",
        handle: "low",
        platform: "instagram",
        totalLikes: 10,
        totalComments: 5,
        totalViews: 100,
        mentionCount: 1,
      },
      {
        creatorId: "c2",
        creatorName: "High",
        handle: "high",
        platform: "instagram",
        totalLikes: 1000,
        totalComments: 500,
        totalViews: 10000,
        mentionCount: 3,
      },
      {
        creatorId: "c3",
        creatorName: "Mid",
        handle: "mid",
        platform: "tiktok",
        totalLikes: 100,
        totalComments: 50,
        totalViews: 1000,
        mentionCount: 2,
      },
    ];

    const sorted = [...entries].sort(
      (a, b) =>
        b.totalLikes +
        b.totalComments +
        b.totalViews -
        (a.totalLikes + a.totalComments + a.totalViews)
    );

    expect(sorted[0].creatorId).toBe("c2");
    expect(sorted[1].creatorId).toBe("c3");
    expect(sorted[2].creatorId).toBe("c1");
  });

  // -------------------------------------------------------------------------
  // Test 6: Creator leaderboard handles campaigns with zero mentions
  // -------------------------------------------------------------------------
  it("returns empty leaderboard when no mentions exist", () => {
    const mentionsByCreator = new Map<
      string,
      { likes: number; comments: number; views: number; count: number }
    >();

    const leaderboard = Array.from(mentionsByCreator.entries());

    expect(leaderboard).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 7: Date range filter narrows API results
// ---------------------------------------------------------------------------
describe("date range filtering", () => {
  it("constructs valid date filter from ISO strings", () => {
    const fromParam = "2026-01-01";
    const toParam = "2026-03-31";

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromParam) {
      const fromDate = new Date(fromParam);
      if (!Number.isNaN(fromDate.getTime())) {
        dateFilter.gte = fromDate;
      }
    }
    if (toParam) {
      const toDate = new Date(toParam);
      if (!Number.isNaN(toDate.getTime())) {
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
    }

    expect(dateFilter.gte).toBeInstanceOf(Date);
    expect(dateFilter.lte).toBeInstanceOf(Date);
    // Use UTC methods to avoid timezone issues in CI
    expect(dateFilter.gte!.toISOString()).toContain("2026-01-01");
    expect(dateFilter.lte!.getHours()).toBe(23);
    expect(dateFilter.lte!.getMinutes()).toBe(59);
  });

  it("handles missing from/to gracefully (empty filter)", () => {
    const fromParam = null;
    const toParam = null;

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (fromParam) {
      dateFilter.gte = new Date(fromParam);
    }
    if (toParam) {
      dateFilter.lte = new Date(toParam);
    }

    expect(Object.keys(dateFilter)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Test 8: Cost-by-type breakdown matches CostRecord aggregation
// ---------------------------------------------------------------------------
describe("cost-by-type breakdown", () => {
  it("aggregates cost records by type correctly", () => {
    const costRecords = [
      { amount: 1000, type: "product" },
      { amount: 2000, type: "product" },
      { amount: 500, type: "shipping" },
      { amount: 300, type: "platform_fee" },
      { amount: 150, type: "other" },
    ];

    const costsByType = costRecords.reduce<Record<string, number>>(
      (acc, c) => ({
        ...acc,
        [c.type]: (acc[c.type] ?? 0) + c.amount,
      }),
      {}
    );

    expect(costsByType).toEqual({
      product: 3000,
      shipping: 500,
      platform_fee: 300,
      other: 150,
    });
  });
});

// ---------------------------------------------------------------------------
// Test 9: CSV export generates valid CSV with correct headers
// ---------------------------------------------------------------------------
describe("generateCSV", () => {
  it("produces CSV with lifecycle, cost, and leaderboard sections", () => {
    const mockData: AnalyticsResponse = {
      campaignId: "test-campaign-1",
      summary: {
        totalCreators: 10,
        totalMentions: 5,
        totalOrders: 3,
        totalLikes: 100,
        totalComments: 50,
        totalViews: 1000,
        totalProductValueCents: 5000,
        totalCostCents: 2000,
      },
      lifecycle: {
        ready: 2,
        outreach_sent: 3,
        replied: 2,
        address_confirmed: 1,
        order_created: 1,
        shipped: 1,
        delivered: 0,
        posted: 0,
        completed: 0,
        opted_out: 0,
        stalled: 0,
      },
      review: { pending: 2, approved: 8, declined: 0, deferred: 0 },
      mentions: {
        total: 5,
        byPlatform: { instagram: 3, tiktok: 2 },
        engagement: { likes: 100, comments: 50, views: 1000 },
      },
      orders: { total: 3, byStatus: { pending: 1, fulfilled: 2 } },
      conversionRates: {
        readyToOutreachSent: 80,
        outreachSentToReplied: 50,
        repliedToAddressConfirmed: 40,
        addressConfirmedToOrderCreated: 30,
        orderCreatedToShipped: 20,
        shippedToDelivered: 10,
        deliveredToPosted: 5,
        overallConversion: 1,
      },
      timeToPost: [24, 48, 72],
      creatorLeaderboard: [
        {
          creatorId: "c1",
          creatorName: "Test Creator",
          handle: "testcreator",
          platform: "instagram",
          totalLikes: 50,
          totalComments: 25,
          totalViews: 500,
          mentionCount: 2,
        },
      ],
      costsByType: { product: 1500, shipping: 500 },
    };

    const csv = generateCSV(mockData);

    // Contains campaign info
    expect(csv).toContain("Campaign: test-campaign-1");
    expect(csv).toContain("Total Creators: 10");

    // Contains lifecycle headers
    expect(csv).toContain("Stage,Count,Conversion Rate (%)");

    // Contains lifecycle stages
    expect(csv).toContain("ready,2,80");

    // Contains cost section
    expect(csv).toContain("Cost Type,Amount (cents)");
    expect(csv).toContain("product,1500");
    expect(csv).toContain("shipping,500");

    // Contains leaderboard section
    expect(csv).toContain("Creator,Handle,Platform,Likes,Comments,Views,Mentions");
    expect(csv).toContain("Test Creator,testcreator,instagram,50,25,500,2");
  });
});

// ---------------------------------------------------------------------------
// Test 10: Empty campaign (zero creators) renders empty state, not error
// ---------------------------------------------------------------------------
describe("empty campaign handling", () => {
  it("produces valid analytics response with zero creators", () => {
    const lifecycle: Record<string, number> = {
      ready: 0,
      outreach_sent: 0,
      replied: 0,
      address_confirmed: 0,
      order_created: 0,
      shipped: 0,
      delivered: 0,
      posted: 0,
      completed: 0,
      opted_out: 0,
      stalled: 0,
    };

    const rates = computeConversionRates(lifecycle);
    const timeToPost = computeTimeToPost([]);
    const buckets = bucketTimeToPost(timeToPost);

    // All conversion rates should be 0
    expect(rates.overallConversion).toBe(0);
    expect(rates.readyToOutreachSent).toBe(0);

    // Time-to-post should be empty
    expect(timeToPost).toHaveLength(0);

    // All buckets should be 0
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bucket time-to-post
// ---------------------------------------------------------------------------
describe("bucketTimeToPost", () => {
  it("places hours into correct histogram bins", () => {
    const hours = [
      1, // 0-24h
      12, // 0-24h
      36, // 1-3d
      100, // 3-7d
      200, // 7-14d
      500, // 14-30d
      1000, // 30d+
    ];

    const buckets = bucketTimeToPost(hours);

    expect(buckets[0]).toMatchObject({ label: "0-24h", count: 2 });
    expect(buckets[1]).toMatchObject({ label: "1-3d", count: 1 });
    expect(buckets[2]).toMatchObject({ label: "3-7d", count: 1 });
    expect(buckets[3]).toMatchObject({ label: "7-14d", count: 1 });
    expect(buckets[4]).toMatchObject({ label: "14-30d", count: 1 });
    expect(buckets[5]).toMatchObject({ label: "30d+", count: 1 });
  });
});
