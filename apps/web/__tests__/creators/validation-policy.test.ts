import { describe, expect, it } from "vitest";
import {
  canAutoRemoveInvalidCampaignCreator,
  isCreatorValidationFresh,
} from "@/lib/creators/validation-policy";

describe("isCreatorValidationFresh", () => {
  it("returns true for recent validations", () => {
    const now = new Date("2026-03-10T00:00:00.000Z");
    const validatedAt = new Date("2026-03-08T12:30:00.000Z");

    expect(isCreatorValidationFresh(validatedAt, now, 72)).toBe(true);
  });

  it("returns false for missing or stale validations", () => {
    const now = new Date("2026-03-10T00:00:00.000Z");
    const stale = new Date("2026-03-05T00:00:00.000Z");

    expect(isCreatorValidationFresh(null, now, 72)).toBe(false);
    expect(isCreatorValidationFresh(stale, now, 72)).toBe(false);
  });
});

describe("canAutoRemoveInvalidCampaignCreator", () => {
  it("allows safe removal for untouched ready queue rows", () => {
    expect(
      canAutoRemoveInvalidCampaignCreator({
        reviewStatus: "pending",
        lifecycleStatus: "ready",
        outreachCount: 0,
        lastOutreachAt: null,
        lastReplyAt: null,
        hasConversationThread: false,
        hasShopifyOrder: false,
        shippingSnapshotCount: 0,
        reminderScheduleCount: 0,
        costRecordCount: 0,
        mentionAssetCount: 0,
      })
    ).toBe(true);
  });

  it("blocks removal once downstream activity exists", () => {
    expect(
      canAutoRemoveInvalidCampaignCreator({
        reviewStatus: "approved",
        lifecycleStatus: "ready",
        outreachCount: 1,
        lastOutreachAt: new Date("2026-03-09T12:00:00.000Z"),
        lastReplyAt: null,
        hasConversationThread: true,
        hasShopifyOrder: false,
        shippingSnapshotCount: 0,
        reminderScheduleCount: 0,
        costRecordCount: 0,
        mentionAssetCount: 0,
      })
    ).toBe(false);
  });
});
