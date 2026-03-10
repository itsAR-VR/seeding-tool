import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const unref = vi.fn();
  const spawn = vi.fn(() => ({ unref }));
  const updateMany = vi.fn();

  return { updateMany, unref, spawn };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    creatorSearchJob: {
      updateMany: mocks.updateMany,
    },
  },
}));

vi.mock("node:child_process", () => ({
  spawn: mocks.spawn,
}));

import { scheduleLocalCreatorSearchJob } from "@/lib/creator-search/local-fallback";

describe("scheduleLocalCreatorSearchJob", () => {
  beforeEach(() => {
    mocks.updateMany.mockReset();
    mocks.spawn.mockClear();
    mocks.unref.mockClear();
    delete process.env.VERCEL;
    delete process.env.CREATOR_SEARCH_DISABLE_INLINE_FALLBACK;
  });

  it("spawns at most once when repeated pending-job polls race for the same job", async () => {
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const input = {
      jobId: "job_123",
      brandId: "brand_123",
      campaignId: null,
    };

    await expect(scheduleLocalCreatorSearchJob(input)).resolves.toBe(true);
    await expect(scheduleLocalCreatorSearchJob(input)).resolves.toBe(false);

    expect(mocks.spawn).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: "job_123",
          brandId: "brand_123",
          status: "pending",
        }),
      })
    );
  });

  it("clears the reservation when the child process cannot be spawned", async () => {
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    mocks.spawn.mockImplementationOnce(() => {
      throw new Error("spawn failed");
    });

    await expect(
      scheduleLocalCreatorSearchJob({
        jobId: "job_456",
        brandId: "brand_456",
        campaignId: "campaign_456",
      })
    ).rejects.toThrow("spawn failed");

    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: {
          startedAt: null,
        },
      })
    );
  });
});
