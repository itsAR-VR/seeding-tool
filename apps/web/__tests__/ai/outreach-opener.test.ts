import { describe, it, expect, vi } from "vitest";
vi.mock("openai", () => ({ default: class {} }));
import { tidyOpener, OPENER_RULES } from "@/lib/ai/outreach-drafter";

describe("outreach opener rules", () => {
  it("uses fitness, fashion and wellness wording", () => {
    expect(tidyOpener("Hi A,\n\nI love your strength training content!")).toContain("I love your fitness content!");
    expect(tidyOpener("I love your movement content!")).toBe("I love your fitness content!");
    expect(tidyOpener("I love your style content!")).toBe("I love your fashion content!");
    expect(tidyOpener("I love your style and travel content!")).toBe("I love your fashion and travel content!");
    expect(tidyOpener("I love your midlife wellness content!")).toBe("I love your wellness content!");
    expect(tidyOpener("I love your body confidence content!")).toBe("I love your wellness content!");
    expect(tidyOpener("I love your mom content!")).toBe("I love your content about motherhood!");
  });
  it("tells the writer the rules", () => {
    expect(OPENER_RULES).toContain("I love your <topic> content!");
    expect(OPENER_RULES).toContain("motherhood");
    expect(OPENER_RULES).toContain("body confidence");
  });
});

describe("nicheFromNotes", () => {
  it("reads only the topics from a CSV note, in the opener's words", async () => {
    const { nicheFromNotes } = await import("@/lib/ai/outreach-drafter");
    const note = "Kalm Mind | Core 35-65 | Prior: never contacted | Topics: mom, founder, wellness | Band: 5k-50k";
    expect(nicheFromNotes(note)).toBe("motherhood, business, wellness");
    expect(nicheFromNotes("no topics here")).toBeNull();
    expect(nicheFromNotes(null)).toBeNull();
  });
});
