import { describe, expect, it } from "vitest";
import {
  CREATOR_FILTERS,
  CREATOR_STAGES,
  CURRENT_STAGES,
  OFF_PATH_STAGES,
  countCampaignCreators,
  countCurrentStage,
  countOrders,
  countStages,
  countStepsReached,
  creatorStage,
  everAddressIn,
  postCountsByCreator,
  type CountableCreator,
} from "@/lib/stats/campaign-counts";
import { STAGE_DISPLAY } from "@/lib/stats/stage-display";

/** A creator whose orders and posts were loaded (none by default). */
function creator(overrides: Partial<CountableCreator> = {}): CountableCreator {
  return { reviewStatus: "approved", lifecycleStatus: "ready", orderStatus: null, postCount: 0, ...overrides };
}

describe("creatorStage", () => {
  it("a cancelled order is Order cancelled, not Address in and not an order made", () => {
    const c = creator({ lifecycleStatus: "address_confirmed", orderStatus: "cancelled" });
    expect(creatorStage(c)).toBe("order_cancelled");
    expect(STAGE_DISPLAY[creatorStage(c)].label).toBe("Order cancelled");
    expect(everAddressIn(c)).toBe(false);
    expect(CREATOR_FILTERS.order_made.match(c)).toBe(false);
    expect(countStepsReached([c])).toMatchObject({ ordersMade: 0, ordersCancelled: 1 });
  });

  it("said no by reply or by opting out is Said no", () => {
    expect(creatorStage(creator({ lifecycleStatus: "replied", replyDecision: "no" }))).toBe("said_no");
    expect(creatorStage(creator({ lifecycleStatus: "opted_out" }))).toBe("said_no");
  });

  it("an order that isn't cancelled is Order made, whatever the stored step says", () => {
    expect(creatorStage(creator({ lifecycleStatus: "address_confirmed", orderStatus: "draft_created" }))).toBe(
      "order_made",
    );
    expect(creatorStage(creator({ lifecycleStatus: "order_created", orderStatus: "shipped" }))).toBe("shipped");
    expect(creatorStage(creator({ lifecycleStatus: "delivered", orderStatus: "created" }))).toBe("delivered");
  });

  it("any post means Posted, even if the stored step is behind", () => {
    expect(creatorStage(creator({ lifecycleStatus: "address_confirmed", orderStatus: "created", postCount: 1 }))).toBe(
      "posted",
    );
    expect(creatorStage(creator({ lifecycleStatus: "completed", postCount: 2 }))).toBe("done");
  });

  it("a stored order or post step with nothing on record doesn't count as one", () => {
    expect(creatorStage(creator({ lifecycleStatus: "order_created" }))).toBe("address_in");
    expect(creatorStage(creator({ lifecycleStatus: "posted" }))).toBe("address_in");
  });

  it("trusts the stored step when orders and posts weren't loaded", () => {
    expect(creatorStage({ reviewStatus: "approved", lifecycleStatus: "posted" })).toBe("posted");
    expect(creatorStage({ reviewStatus: "approved", lifecycleStatus: "order_created" })).toBe("order_made");
  });

  it("review comes before progress, and early steps follow the stored status", () => {
    expect(creatorStage(creator({ reviewStatus: "pending" }))).toBe("needs_review");
    expect(creatorStage(creator({ reviewStatus: "declined" }))).toBe("not_a_fit");
    expect(creatorStage(creator({ reviewStatus: "deferred" }))).toBe("maybe_later");
    expect(creatorStage(creator())).toBe("ready");
    expect(creatorStage(creator({ lifecycleStatus: "outreach_sent" }))).toBe("emailed");
    expect(creatorStage(creator({ lifecycleStatus: "replied" }))).toBe("replied");
    expect(creatorStage(creator({ lifecycleStatus: "address_review" }))).toBe("address_to_check");
    expect(creatorStage(creator({ lifecycleStatus: "stalled", replyDecision: "later" }))).toBe("not_now");
  });

  it("every stage is either a Results row or in the note underneath, exactly once", () => {
    const shown = [...CURRENT_STAGES.flatMap((s) => s.stages), ...OFF_PATH_STAGES];
    expect([...shown].sort()).toEqual([...CREATOR_STAGES].sort());
  });
});

describe("Results matches the Orders and Posts tabs", () => {
  // The reported case: one creator with an order and a post, stored step still "address_confirmed".
  const creators = [
    creator({ lifecycleStatus: "address_confirmed", orderStatus: "created", postCount: 1 }),
    creator({ lifecycleStatus: "outreach_sent" }),
    creator({ lifecycleStatus: "address_confirmed", orderStatus: "cancelled" }),
  ];

  it("counts orders made and posted creators from orders and posts", () => {
    const steps = countStepsReached(creators);
    expect(steps.ordersMade).toBe(countOrders([{ status: "created" }, { status: "cancelled" }]).made);
    expect(steps.ordersMade).toBe(1);
    expect(steps.posted).toBe(1);
  });

  it("puts each creator in one current stage", () => {
    const stages = countStages(creators);
    expect(stages.posted).toBe(1);
    expect(stages.order_cancelled).toBe(1);
    expect(stages.address_in).toBe(0);
    const total = CREATOR_STAGES.reduce((sum, s) => sum + countCurrentStage(stages, [s]), 0);
    expect(total).toBe(creators.length);
  });

  it("filter chips agree", () => {
    const counts = countCampaignCreators(creators);
    expect(counts.order_made).toBe(1);
    expect(counts.posted).toBe(1);
    expect(counts.order_cancelled).toBe(1);
    expect(counts.address_in).toBe(1);
  });
});

describe("helpers", () => {
  it("countOrders leaves cancelled orders out of orders made", () => {
    expect(countOrders([{ status: "draft_created" }, { status: "cancelled" }, { status: "shipped" }])).toEqual({
      made: 2,
      cancelled: 1,
    });
  });

  it("postCountsByCreator counts posts per creator and skips unmatched posts", () => {
    const counts = postCountsByCreator([{ creatorId: "a" }, { creatorId: "a" }, { creatorId: null }, { creatorId: "b" }]);
    expect(counts.get("a")).toBe(2);
    expect(counts.get("b")).toBe(1);
    expect(counts.size).toBe(2);
  });
});
