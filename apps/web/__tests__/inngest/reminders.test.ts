import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {};

  return {
    handlers,
    createFunction: vi.fn(
      (config: { id: string }, _trigger: unknown, handler: (...args: unknown[]) => unknown) => {
        handlers[config.id] = handler;
        return handler;
      },
    ),
    campaignCreatorFindUnique: vi.fn(),
    reminderScheduleCreate: vi.fn(),
    reminderScheduleUpdateMany: vi.fn(),
    mentionAssetFindFirst: vi.fn(),
    campaignCreatorUpdate: vi.fn(),
    send: vi.fn(),
  };
});

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: mocks.createFunction,
    send: mocks.send,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaignCreator: {
      findUnique: mocks.campaignCreatorFindUnique,
      update: mocks.campaignCreatorUpdate,
    },
    reminderSchedule: {
      create: mocks.reminderScheduleCreate,
      updateMany: mocks.reminderScheduleUpdateMany,
    },
    mentionAsset: {
      findFirst: mocks.mentionAssetFindFirst,
    },
  },
}));

import "@/lib/inngest/functions/reminders";

function getHandler() {
  const handler = mocks.handlers["schedule-post-fulfillment-reminders"];
  if (!handler) {
    throw new Error("schedule-post-fulfillment-reminders handler not captured");
  }
  return handler;
}

function makeStep() {
  return {
    run: vi.fn((_name: string, fn: (...args: unknown[]) => unknown) => fn()),
    sleep: vi.fn(async () => {}),
  };
}

function makeCampaignCreator() {
  return {
    id: "cc-1",
    campaign: {
      brandId: "brand-1",
      brand: {
        settings: {
          defaultFollowUpDays: 2,
          maxFollowUps: 2,
        },
      },
    },
  };
}

describe("scheduleReminders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates reminder records, sleeps on cadence, and emits reminder events", async () => {
    mocks.campaignCreatorFindUnique
      .mockResolvedValueOnce(makeCampaignCreator())
      .mockResolvedValue({ lifecycleStatus: "ready" });
    mocks.mentionAssetFindFirst.mockResolvedValue(null);

    const handler = getHandler();
    const step = makeStep();
    const result = await handler({
      event: { data: { orderId: "order-1", campaignCreatorId: "cc-1" } },
      step,
    });

    expect(result).toEqual({ status: "completed", totalReminders: 2 });
    expect(mocks.reminderScheduleCreate).toHaveBeenCalledTimes(2);
    expect(step.sleep).toHaveBeenNthCalledWith(1, "wait-for-reminder-1", "2d");
    expect(step.sleep).toHaveBeenNthCalledWith(2, "wait-for-reminder-2", "4d");
    expect(mocks.send).toHaveBeenCalledTimes(2);
    expect(mocks.send).toHaveBeenNthCalledWith(1, {
      name: "reminder/send",
      data: {
        campaignCreatorId: "cc-1",
        brandId: "brand-1",
        reminderNumber: 1,
        orderId: "order-1",
      },
    });
    expect(mocks.send).toHaveBeenNthCalledWith(2, {
      name: "reminder/send",
      data: {
        campaignCreatorId: "cc-1",
        brandId: "brand-1",
        reminderNumber: 2,
        orderId: "order-1",
      },
    });
  });

  it("marks the creator as posted and cancels remaining reminders when a mention appears", async () => {
    mocks.campaignCreatorFindUnique
      .mockResolvedValueOnce(makeCampaignCreator())
      .mockResolvedValue({ lifecycleStatus: "ready" });
    mocks.mentionAssetFindFirst.mockResolvedValueOnce({ id: "mention-1" });

    const handler = getHandler();
    const result = await handler({
      event: { data: { orderId: "order-1", campaignCreatorId: "cc-1" } },
      step: makeStep(),
    });

    expect(result).toEqual({
      status: "completed_early",
      reason: "Mention detected",
      remindersSent: 0,
    });
    expect(mocks.campaignCreatorUpdate).toHaveBeenCalledWith({
      where: { id: "cc-1" },
      data: { lifecycleStatus: "posted" },
    });
    expect(mocks.reminderScheduleUpdateMany).toHaveBeenCalledWith({
      where: { campaignCreatorId: "cc-1", status: "pending" },
      data: {
        status: "cancelled",
        cancelReason: "Creator posted — mention detected",
      },
    });
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("cancels remaining reminders when the lifecycle is already terminal", async () => {
    mocks.campaignCreatorFindUnique
      .mockResolvedValueOnce(makeCampaignCreator())
      .mockResolvedValue({ lifecycleStatus: "posted" });

    const handler = getHandler();
    const result = await handler({
      event: { data: { orderId: "order-1", campaignCreatorId: "cc-1" } },
      step: makeStep(),
    });

    expect(result).toEqual({
      status: "completed_early",
      reason: "Creator status is posted",
      remindersSent: 0,
    });
    expect(mocks.reminderScheduleUpdateMany).toHaveBeenCalledWith({
      where: { campaignCreatorId: "cc-1", status: "pending" },
      data: {
        status: "cancelled",
        cancelReason: "Creator status: posted",
      },
    });
    expect(mocks.mentionAssetFindFirst).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
