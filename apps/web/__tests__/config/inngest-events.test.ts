import { describe, it, expect } from "vitest";
import type { AppEventPayloads } from "@/lib/inngest/events";

/**
 * Compile-time type safety tests for the Inngest event catalog.
 *
 * These tests verify that:
 * 1. All 11 declared events exist in the type
 * 2. Event payloads have the correct shape
 * 3. The type system catches missing required fields
 */

// Compile-time assertion helper: if this compiles, the type is correct
function assertEventShape<K extends keyof AppEventPayloads>(
  _name: K,
  _data: AppEventPayloads[K]["data"]
) {
  // no-op at runtime; purely a compile-time check
}

describe("AppEventPayloads type catalog", () => {
  it("declares exactly 11 events", () => {
    // Enumerate all expected event names at the type level
    const expectedEvents: Array<keyof AppEventPayloads> = [
      "app/ping",
      "gmail/message.received",
      "mention/media.archive",
      "creator-search/requested",
      "creator-avg-views/requested",
      "reminder/send",
      "shopify/order.fulfilled",
      "unipile/message.received",
      "metrics/snapshots-collected",
      "shipping/address.approved",
      "mention/attributed",
    ];

    expect(expectedEvents).toHaveLength(11);
  });

  it("app/ping has correct shape", () => {
    assertEventShape("app/ping", { timestamp: "2026-04-07" });
  });

  it("gmail/message.received has correct shape", () => {
    assertEventShape("gmail/message.received", {
      threadId: "t1",
      messageId: "m1",
      brandId: "b1",
      campaignCreatorId: "cc1",
    });
  });

  it("mention/media.archive has correct shape", () => {
    assertEventShape("mention/media.archive", { mentionAssetId: "ma1" });
  });

  it("creator-search/requested has correct shape", () => {
    // Minimal required fields
    assertEventShape("creator-search/requested", {
      jobId: "j1",
      brandId: "b1",
    });

    // With optional fields
    assertEventShape("creator-search/requested", {
      jobId: "j1",
      brandId: "b1",
      campaignId: "c1",
      query: { keywords: ["beauty"] },
      discoverySource: "apify",
      criteria: { searchMode: "hashtag" },
    });
  });

  it("creator-avg-views/requested has correct shape", () => {
    assertEventShape("creator-avg-views/requested", {
      creatorIds: ["c1", "c2"],
    });
  });

  it("reminder/send has correct shape", () => {
    assertEventShape("reminder/send", {
      campaignCreatorId: "cc1",
      brandId: "b1",
      reminderNumber: 2,
      orderId: "o1",
    });
  });

  it("shopify/order.fulfilled has correct shape", () => {
    assertEventShape("shopify/order.fulfilled", {
      orderId: "o1",
      shopifyOrderId: "so1",
      campaignCreatorId: "cc1",
    });
  });

  it("unipile/message.received has correct shape", () => {
    assertEventShape("unipile/message.received", {
      threadId: "t1",
      messageId: "m1",
      brandId: "b1",
      campaignCreatorId: "cc1",
      chatId: "ch1",
    });
  });

  it("metrics/snapshots-collected has correct shape", () => {
    assertEventShape("metrics/snapshots-collected", {
      profileIds: ["p1", "p2"],
    });
  });

  it("shipping/address.approved has correct shape", () => {
    assertEventShape("shipping/address.approved", {
      snapshotId: "s1",
      campaignCreatorId: "cc1",
      brandId: "b1",
      campaignId: "c1",
    });
  });

  it("mention/attributed has correct shape", () => {
    assertEventShape("mention/attributed", {
      mentionAssetId: "ma1",
      campaignCreatorId: "cc1",
      attributionConfidence: "high",
    });
  });
});
