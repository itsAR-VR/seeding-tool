import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const handlers: Record<string, Function> = {};

  return {
    handlers,
    createFunction: vi.fn(
      (config: { id: string }, _trigger: unknown, handler: Function) => {
        handlers[config.id] = handler;
        return handler;
      },
    ),
    campaignCreatorFindUnique: vi.fn(),
    mentionAssetFindFirst: vi.fn(),
    reminderScheduleUpdateMany: vi.fn(),
    campaignCreatorUpdate: vi.fn(),
    outreachTemplateFindFirst: vi.fn(),
    interventionCaseCreate: vi.fn(),
    getFeatureFlags: vi.fn(),
    isSuppressed: vi.fn(),
    isInEarlyWarmup: vi.fn(),
    sendEmail: vi.fn(),
    buildUnsubscribeUrl: vi.fn(),
    renderBaseTemplate: vi.fn(),
  };
});

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: mocks.createFunction,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    campaignCreator: {
      findUnique: mocks.campaignCreatorFindUnique,
      update: mocks.campaignCreatorUpdate,
    },
    mentionAsset: {
      findFirst: mocks.mentionAssetFindFirst,
    },
    reminderSchedule: {
      updateMany: mocks.reminderScheduleUpdateMany,
    },
    outreachTemplate: {
      findFirst: mocks.outreachTemplateFindFirst,
    },
    interventionCase: {
      create: mocks.interventionCaseCreate,
    },
  },
}));

vi.mock("@/lib/feature-flags", () => ({
  getFeatureFlags: mocks.getFeatureFlags,
}));

vi.mock("@/lib/compliance/suppression", () => ({
  isSuppressed: mocks.isSuppressed,
}));

vi.mock("@/lib/outreach/warmup", () => ({
  isInEarlyWarmup: mocks.isInEarlyWarmup,
}));

vi.mock("@/lib/gmail/send", () => ({
  sendEmail: mocks.sendEmail,
  buildUnsubscribeUrl: mocks.buildUnsubscribeUrl,
}));

vi.mock("@/lib/outreach/templates/base", () => ({
  renderBaseTemplate: mocks.renderBaseTemplate,
}));

import "@/lib/inngest/functions/mention-check";

function getHandler() {
  const handler = mocks.handlers["handle-reminder-send"];
  if (!handler) {
    throw new Error("handle-reminder-send handler not captured");
  }
  return handler;
}

function makeCampaignCreator() {
  return {
    id: "cc-1",
    lifecycleStatus: "ready",
    creator: {
      name: "Jane Creator",
      email: "jane@example.com",
    },
    campaign: {
      name: "Glow Campaign",
      brand: {
        name: "Glow Beauty",
        settings: { maxFollowUps: 3 },
        emailAliases: [{ id: "alias-1", isPrimary: true }],
      },
    },
    conversationThread: {
      id: "thread-1",
      externalThreadId: "gmail-thread-1",
    },
  };
}

describe("handleReminderSend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getFeatureFlags.mockResolvedValue({ reminderEmailEnabled: true });
    mocks.campaignCreatorFindUnique.mockResolvedValue(makeCampaignCreator());
    mocks.mentionAssetFindFirst.mockResolvedValue(null);
    mocks.isSuppressed.mockResolvedValue(false);
    mocks.isInEarlyWarmup.mockReturnValue(false);
    mocks.outreachTemplateFindFirst.mockResolvedValue({
      id: "template-1",
      subject: "Reminder for {{campaign_name}}",
      body: "Hi {{creator_name}}, reminder #{{reminder_number}} about {{campaign_name}}.",
    });
    mocks.buildUnsubscribeUrl.mockReturnValue("https://unsubscribe.test");
    mocks.renderBaseTemplate.mockReturnValue("<html>wrapped</html>");
    mocks.sendEmail.mockResolvedValue({});
  });

  it("skips immediately when reminder emails are disabled", async () => {
    mocks.getFeatureFlags.mockResolvedValueOnce({ reminderEmailEnabled: false });

    const handler = getHandler();
    const result = await handler({
      event: { data: { campaignCreatorId: "cc-1", brandId: "brand-1", reminderNumber: 1 } },
    });

    expect(result).toEqual({
      status: "skipped",
      reason: "reminder_email_disabled",
    });
    expect(mocks.campaignCreatorFindUnique).not.toHaveBeenCalled();
  });

  it("marks a creator posted and cancels reminders when a mention already exists", async () => {
    mocks.mentionAssetFindFirst.mockResolvedValueOnce({ id: "mention-1" });

    const handler = getHandler();
    const result = await handler({
      event: { data: { campaignCreatorId: "cc-1", brandId: "brand-1", reminderNumber: 1 } },
    });

    expect(result).toEqual({ status: "mention_detected", mentionId: "mention-1" });
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
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("suppresses reminder sends for suppressed recipients", async () => {
    mocks.isSuppressed.mockResolvedValueOnce(true);

    const handler = getHandler();
    const result = await handler({
      event: { data: { campaignCreatorId: "cc-1", brandId: "brand-1", reminderNumber: 2 } },
    });

    expect(result).toEqual({
      status: "suppressed",
      email: "jane@example.com",
    });
    expect(mocks.reminderScheduleUpdateMany).toHaveBeenCalledWith({
      where: { campaignCreatorId: "cc-1", status: "pending" },
      data: {
        status: "suppressed",
        cancelReason: "Recipient is suppressed",
      },
    });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("sends plain text only during early warmup", async () => {
    mocks.isInEarlyWarmup.mockReturnValueOnce(true);

    const handler = getHandler();
    const result = await handler({
      event: { data: { campaignCreatorId: "cc-1", brandId: "brand-1", reminderNumber: 1 } },
    });

    expect(result).toEqual({ status: "sent", reminderNumber: 1 });
    expect(mocks.sendEmail).toHaveBeenCalledWith({
      aliasId: "alias-1",
      to: "jane@example.com",
      subject: "Reminder for Glow Campaign",
      body: "Hi Jane Creator, reminder #1 about Glow Campaign.",
      bodyHtml: undefined,
      threadId: "thread-1",
      externalThreadId: "gmail-thread-1",
    });
    expect(mocks.reminderScheduleUpdateMany).toHaveBeenCalledWith({
      where: { campaignCreatorId: "cc-1", status: "pending" },
      data: {
        status: "sent",
        sentAt: expect.any(Date),
      },
    });
  });
});
