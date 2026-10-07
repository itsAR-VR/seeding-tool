import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREATOR_FILTERS,
  CURRENT_STAGES,
  countCampaignCreators,
  countCurrentStage,
  countStages,
  countStepsReached,
  everEmailed,
  everReplied,
  isCreatorFilterKey,
  lifecycleBreakdown,
  needsAnswer,
  addressToCheck,
  type CountableCreator,
} from "@/lib/stats/campaign-counts";
import {
  countNeedsAnswer,
  findOutreachWaitingToSend,
  findStuckCreators,
} from "@/lib/stats/needs-you";
import { STAGE_DISPLAY } from "@/lib/stats/stage-display";

const mocks = vi.hoisted(() => ({
  threadFindMany: vi.fn(),
  ccFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversationThread: { findMany: mocks.threadFindMany },
    campaignCreator: { findMany: mocks.ccFindMany },
  },
}));

function creator(overrides: Partial<CountableCreator> = {}): CountableCreator {
  return { reviewStatus: "approved", lifecycleStatus: "ready", ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ever reached (cumulative)", () => {
  it("counts everyone emailed, including people who moved past Emailed", () => {
    const list = [
      creator({ lifecycleStatus: "ready" }),
      creator({ lifecycleStatus: "outreach_sent" }),
      creator({ lifecycleStatus: "replied" }),
      creator({ lifecycleStatus: "shipped" }),
      creator({ lifecycleStatus: "stalled", outreachCount: 1 }),
      creator({ lifecycleStatus: "opted_out", lastOutreachAt: new Date() }),
    ];
    // The funnel shows 1 person currently at "Emailed", but 5 were ever emailed.
    expect(lifecycleBreakdown(list).outreach_sent).toBe(1);
    expect(countStepsReached(list).emailed).toBe(5);
  });

  it("counts a reply on record even if they then said no", () => {
    expect(everReplied(creator({ lifecycleStatus: "opted_out", lastReplyAt: new Date() }))).toBe(true);
    expect(everReplied(creator({ lifecycleStatus: "address_confirmed" }))).toBe(true);
    expect(everReplied(creator({ lifecycleStatus: "outreach_sent" }))).toBe(false);
  });

  it("does not treat a never-emailed exit as emailed", () => {
    expect(everEmailed(creator({ lifecycleStatus: "opted_out" }))).toBe(false);
  });
});

describe("campaign chips", () => {
  it("each chip count equals the size of the list it filters to", () => {
    const list: CountableCreator[] = [
      creator(),
      creator({ reviewStatus: "pending" }),
      creator({ lifecycleStatus: "outreach_sent" }),
      creator({ lifecycleStatus: "replied", latestMessageDirection: "inbound" }),
      creator({
        lifecycleStatus: "address_review",
        shippingSnapshots: [{ isActive: false, confirmedAt: null }],
      }),
      creator({ lifecycleStatus: "order_created", stuck: true }),
    ];
    const counts = countCampaignCreators(list);
    for (const [key, filter] of Object.entries(CREATOR_FILTERS)) {
      expect(counts[key as keyof typeof counts]).toBe(list.filter(filter.match).length);
    }
    expect(counts.total).toBe(6);
    expect(counts.to_email).toBe(1);
    expect(counts.emailed).toBe(4);
    expect(counts.replied).toBe(3);
    expect(counts.address_in).toBe(2);
    expect(counts.needs_answer).toBe(1);
    expect(counts.address_review).toBe(1);
    expect(counts.stuck).toBe(1);
  });

  it("only accepts known filter keys", () => {
    expect(isCreatorFilterKey("emailed")).toBe(true);
    expect(isCreatorFilterKey("toString")).toBe(false);
    expect(isCreatorFilterKey(undefined)).toBe(false);
  });
});

describe("to-do rules", () => {
  it("needs an answer only when their message is newest and nobody decided", () => {
    expect(needsAnswer({ replyDecision: null, latestMessageDirection: "inbound" })).toBe(true);
    expect(needsAnswer({ replyDecision: "yes", latestMessageDirection: "inbound" })).toBe(false);
    expect(needsAnswer({ replyDecision: null, latestMessageDirection: "outbound" })).toBe(false);
  });

  it("an address confirmed later settles the check", () => {
    expect(addressToCheck({ shippingSnapshots: [{ isActive: false, confirmedAt: null }] })).toBe(true);
    expect(
      addressToCheck({
        shippingSnapshots: [
          { isActive: false, confirmedAt: null },
          { isActive: true, confirmedAt: new Date() },
        ],
      }),
    ).toBe(false);
  });
});

describe("where everyone is now", () => {
  it("stages add up to everyone on the main path", () => {
    const stages = countStages([
      creator({ lifecycleStatus: "ready" }),
      creator({ lifecycleStatus: "address_review" }),
      creator({ lifecycleStatus: "address_confirmed" }),
      creator({ lifecycleStatus: "posted", postCount: 1 }),
      creator({ lifecycleStatus: "opted_out" }),
    ]);
    const onPath = CURRENT_STAGES.reduce((sum, stage) => sum + countCurrentStage(stages, stage.stages), 0);
    expect(onPath).toBe(4);
    const addressIn = CURRENT_STAGES.find((s) => s.label === "Address received");
    expect(countCurrentStage(stages, addressIn?.stages ?? [])).toBe(2);
  });
});

describe("needs-you queries", () => {
  it("counts threads whose newest message is from the creator", async () => {
    mocks.threadFindMany.mockResolvedValue([
      { messages: [{ direction: "inbound" }] },
      { messages: [{ direction: "outbound" }] },
      { messages: [] },
      { messages: [{ direction: "inbound" }] },
    ]);
    await expect(countNeedsAnswer("brand-1")).resolves.toBe(2);
    expect(mocks.threadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { brandId: "brand-1", campaignCreator: { replyDecision: null } } }),
    );
  });

  it("stuck creators skip anyone another Home row already covers", async () => {
    const campaign = { id: "c1", name: "Spring" };
    const base = {
      lifecycleStatus: "outreach_sent",
      updatedAt: new Date("2026-01-01"),
      replyDecision: null,
      campaign,
      creator: { name: "A", instagramHandle: null },
      conversationThread: null,
      shippingSnapshots: [],
      shopifyOrder: null,
    };
    mocks.ccFindMany.mockResolvedValue([
      { ...base, id: "quiet" },
      { ...base, id: "reply", conversationThread: { messages: [{ direction: "inbound" }] } },
      { ...base, id: "address", shippingSnapshots: [{ isActive: false, confirmedAt: null }] },
      { ...base, id: "order", shopifyOrder: { status: "draft_created" } },
    ]);
    const now = new Date("2026-02-01T00:00:00Z");
    const stuck = await findStuckCreators("brand-1", { campaignId: "c1", now });
    expect(stuck.map((s) => s.id)).toEqual(["quiet"]);

    const where = mocks.ccFindMany.mock.calls[0][0].where;
    expect(where.campaign).toEqual({ brandId: "brand-1", status: "active", id: "c1" });
    expect(where.lifecycleStatus.notIn).toContain("ready");
    expect(where.updatedAt.lt).toEqual(new Date("2026-01-29T00:00:00Z"));
  });

  it("groups written-but-unsent first emails by campaign, biggest first", async () => {
    const a = { id: "a", name: "Alpha" };
    const b = { id: "b", name: "Beta" };
    mocks.ccFindMany.mockResolvedValue([{ campaign: a }, { campaign: b }, { campaign: b }]);
    await expect(findOutreachWaitingToSend("brand-1")).resolves.toEqual([
      { campaignId: "b", campaignName: "Beta", count: 2 },
      { campaignId: "a", campaignName: "Alpha", count: 1 },
    ]);
    expect(mocks.ccFindMany.mock.calls[0][0].where).toEqual({
      campaign: { brandId: "brand-1", status: { in: ["draft", "active", "paused"] } },
      lifecycleStatus: "ready",
      aiDrafts: { some: { type: "outreach", status: "draft" } },
    });
  });
});

describe("status words", () => {
  it("filters and Results rows use the shared STAGE_DISPLAY labels", () => {
    expect(CREATOR_FILTERS.needs_answer.label).toBe(STAGE_DISPLAY.needs_answer.label);
    expect(CREATOR_FILTERS.address_review.label).toBe(STAGE_DISPLAY.address_to_check.label);
    expect(CREATOR_FILTERS.said_no.label).toBe("Said no");
    expect(CURRENT_STAGES.map((row) => row.label)).toEqual(CURRENT_STAGES.map((row) => STAGE_DISPLAY[row.display].label));
    expect(CURRENT_STAGES.map((row) => row.label)).not.toContain("Replied, no address yet");
  });
});
