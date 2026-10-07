import { describe, expect, it } from "vitest";
import { CREATOR_STAGES, type CountableCreator } from "@/lib/stats/campaign-counts";
import {
  DISPLAY_STAGE_ORDER,
  STAGE_DISPLAY,
  countDisplayStages,
  displayStage,
  stageNextStep,
} from "@/lib/stats/stage-display";

function creator(overrides: Partial<CountableCreator> = {}): CountableCreator {
  return { reviewStatus: "approved", lifecycleStatus: "ready", orderStatus: null, postCount: 0, ...overrides };
}

describe("stage display", () => {
  it("has words and a tone for every stage, and every stage has a chip", () => {
    for (const stage of CREATOR_STAGES) expect(STAGE_DISPLAY[stage]).toBeDefined();
    expect(new Set(DISPLAY_STAGE_ORDER.map((s) => s.stage))).toEqual(new Set(Object.keys(STAGE_DISPLAY)));
  });

  it("splits replies into needs an answer, said yes, and replied", () => {
    expect(displayStage(creator({ lifecycleStatus: "replied", latestMessageDirection: "inbound" }))).toBe("needs_answer");
    expect(displayStage(creator({ lifecycleStatus: "replied", replyDecision: "yes" }))).toBe("said_yes");
    expect(displayStage(creator({ lifecycleStatus: "replied", latestMessageDirection: "outbound" }))).toBe("replied");
    expect(displayStage(creator({ lifecycleStatus: "outreach_sent" }))).toBe("emailed");
    expect(STAGE_DISPLAY.replied.tone).toBe("waiting");
    expect(STAGE_DISPLAY.address_in.label).toBe("Address received");
  });

  it("chip counts add up to everyone", () => {
    const list = [
      creator(),
      creator({ lifecycleStatus: "outreach_sent" }),
      creator({ lifecycleStatus: "replied", latestMessageDirection: "inbound" }),
      creator({ lifecycleStatus: "replied", replyDecision: "no" }),
      creator({ lifecycleStatus: "address_confirmed" }),
      creator({ lifecycleStatus: "posted", postCount: 1 }),
    ];
    const counts = countDisplayStages(list.map(displayStage));
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(list.length);
    expect(counts.needs_answer).toBe(1);
    expect(counts.said_no).toBe(1);
  });

  it("gives a specific next step per stage", () => {
    const ctx = { campaignId: "c1", campaignCreatorId: "cc1", threadId: "t1" };
    expect(stageNextStep("needs_answer", ctx)).toEqual({ label: "Answer them", href: "/inbox/t1" });
    expect(stageNextStep("emailed", ctx)).toEqual({ label: "Waiting on them", href: null });
    expect(stageNextStep("address_in", ctx)?.label).toBe("Finish order");
    expect(stageNextStep("order_made", ctx)?.label).toBe("Ship in Shopify");
    expect(stageNextStep("posted", ctx)).toEqual({ label: "Request rights", href: "/content" });
    expect(stageNextStep("said_no", ctx)).toBeNull();
  });
});
