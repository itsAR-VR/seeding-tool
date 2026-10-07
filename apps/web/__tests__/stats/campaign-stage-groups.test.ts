import { describe, expect, it } from "vitest";
import {
  STAGE_GROUPS,
  countStageGroups,
  groupForFilter,
} from "@/app/(platform)/campaigns/[campaignId]/_components/stage-groups";
import { STAGE_DISPLAY, type DisplayStage } from "@/lib/stats/stage-display";

const ALL_STAGES = Object.keys(STAGE_DISPLAY) as DisplayStage[];

describe("Overview stage groups", () => {
  it("puts every stage in exactly one group", () => {
    for (const stage of ALL_STAGES) {
      expect(STAGE_GROUPS.filter((g) => g.stages.includes(stage))).toHaveLength(1);
    }
  });

  it("adds up to everyone", () => {
    const counts = countStageGroups(ALL_STAGES);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(ALL_STAGES.length);
  });

  it("maps old ?filter= keys to groups and leaves stuck alone", () => {
    expect(groupForFilter("needs_you")?.key).toBe("needs_you");
    expect(groupForFilter("needs_answer")?.key).toBe("needs_you");
    expect(groupForFilter("to_email")?.key).toBe("needs_you");
    expect(groupForFilter("address_in")?.key).toBe("needs_you");
    expect(groupForFilter("order_cancelled")?.key).toBe("needs_you");
    expect(groupForFilter("shipped")?.key).toBe("waiting");
    expect(groupForFilter("posted")?.key).toBe("done");
    expect(groupForFilter("declined")?.key).toBe("said_no");
    expect(groupForFilter("stuck")).toBeNull();
    expect(groupForFilter(undefined)).toBeNull();
  });
});
