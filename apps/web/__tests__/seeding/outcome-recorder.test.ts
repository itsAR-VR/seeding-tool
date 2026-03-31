import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaignCreator: {
      findUnique: mocks.findUnique,
    },
    campaignOutcome: {
      upsert: mocks.upsert,
    },
  },
}));

import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";

describe("recordOutcomeEvent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T12:00:00.000Z"));
    mocks.findUnique.mockReset();
    mocks.upsert.mockReset();
  });

  it("computes response time from the last outreach timestamp when replies arrive", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "cc-1",
      campaignId: "camp-1",
      creatorId: "creator-1",
      lastOutreachAt: new Date("2026-03-30T10:00:00.000Z"),
      creator: { influencerIdentityId: "identity-1" },
      outcome: null,
    });
    mocks.upsert.mockResolvedValue({ id: "outcome-1" });

    await recordOutcomeEvent({
      campaignCreatorId: "cc-1",
      event: { type: "reply_received", replyType: "positive" },
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          replyType: "positive",
          responseTimeHours: 2,
        }),
        create: expect.objectContaining({
          replyType: "positive",
          responseTimeHours: 2,
        }),
      })
    );
  });
});
