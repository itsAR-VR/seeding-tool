import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/outreach/send-pipeline", () => ({ sendOutreachBatch: vi.fn() }));
import { spacedSendTimes, MIN_GAP_MS, MAX_GAP_MS } from "@/lib/outreach/queue";

describe("spaced outreach sending", () => {
  it("starts now and spaces each email 3 minutes apart", () => {
    const start = new Date("2026-10-07T14:00:00Z");
    let i = 0;
    const seq = [0, 1, 0.5, 0.25];
    const times = spacedSendTimes(5, start, () => seq[i++ % seq.length]);
    expect(times[0].getTime()).toBe(start.getTime());
    for (let k = 1; k < times.length; k++) {
      const gap = times[k].getTime() - times[k - 1].getTime();
      expect(gap).toBeGreaterThanOrEqual(MIN_GAP_MS);
      expect(gap).toBeLessThanOrEqual(MAX_GAP_MS);
      expect(gap).toBe(3 * 60_000);
    }
  });
});
