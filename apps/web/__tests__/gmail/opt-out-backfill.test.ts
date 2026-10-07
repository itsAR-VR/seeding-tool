import { beforeEach, describe, expect, it, vi } from "vitest";
import { isStoredOptOut } from "@/lib/inbox/opt-out";

const mocks = vi.hoisted(() => ({
  threadFindMany: vi.fn(),
  threadUpdate: vi.fn(),
  messageUpdate: vi.fn(),
  ccUpdate: vi.fn(),
  draftUpdateMany: vi.fn(),
  addSuppression: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    conversationThread: { findMany: mocks.threadFindMany, update: mocks.threadUpdate },
    message: { update: mocks.messageUpdate },
    campaignCreator: { update: mocks.ccUpdate },
    aIDraft: { updateMany: mocks.draftUpdateMany },
  },
}));
vi.mock("@/lib/compliance/suppression", () => ({ addSuppression: mocks.addSuppression }));
vi.mock("@/lib/logger", () => ({ log: vi.fn() }));
vi.mock("@/lib/gmail/ingest", () => ({ fetchNewMessages: vi.fn(), resolveThreadByExternalId: vi.fn() }));
vi.mock("@/lib/inbox/messages", () => ({ normalizeInboundMessage: vi.fn(), persistMessage: vi.fn() }));
vi.mock("@/lib/seeding/outcome-recorder", () => ({ recordOutcomeEvent: vi.fn() }));
vi.mock("@/lib/inbox/ai", () => ({ classifyReply: vi.fn() }));
vi.mock("@/lib/inbox/suggest-reply", () => ({ createSuggestedReply: vi.fn() }));

import { backfillOptOuts } from "@/lib/gmail/sync";

type Latest = {
  id: string;
  direction: string;
  body: string;
  classification: string | null;
  confidence: number | null;
  fromAddress: string | null;
};

function thread(id: string, latest: Latest | null, email: string | null = `${id}@example.com`) {
  return {
    id,
    campaignCreatorId: `cc-${id}`,
    campaignCreator: { creator: { email } },
    messages: latest ? [latest] : [],
  };
}

function inbound(id: string, body: string, extra: Partial<Latest> = {}): Latest {
  return { id, direction: "inbound", body, classification: null, confidence: null, fromAddress: null, ...extra };
}

describe("isStoredOptOut", () => {
  it("matches a plain old opt-out reply", () => {
    expect(isStoredOptOut(inbound("m", "Please take me off your list, thanks"))).toBe(true);
  });

  it("ignores our own messages and ambiguous replies", () => {
    expect(isStoredOptOut({ ...inbound("m", "unsubscribe"), direction: "outbound" })).toBe(false);
    expect(isStoredOptOut(inbound("m", "Can you remove me? Maybe later works"))).toBe(false);
    expect(isStoredOptOut(null)).toBe(false);
  });

  it("respects a stored AI label that disagrees", () => {
    expect(isStoredOptOut(inbound("m", "Remove me", { classification: "positive", confidence: 0.9 }))).toBe(false);
    expect(isStoredOptOut(inbound("m", "Remove me", { classification: "negative", confidence: 0.9 }))).toBe(true);
  });
});

describe("backfillOptOuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only looks at undecided email threads of the brand", async () => {
    mocks.threadFindMany.mockResolvedValue([]);
    await backfillOptOuts("brand-1");
    expect(mocks.threadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { brandId: "brand-1", channel: "email", campaignCreator: { replyDecision: null } },
      })
    );
  });

  it("handles old opt-outs and leaves everything else for a person", async () => {
    mocks.threadFindMany.mockResolvedValue([
      thread("a", inbound("m-a", "Please take me off your list, thanks")),
      thread("b", inbound("m-b", "Sounds great, what do I need to do?")),
      thread("c", { ...inbound("m-c", "unsubscribe"), direction: "outbound" }),
      thread("d", inbound("m-d", "STOP", { fromAddress: "Dee <Dee@Example.com>" }), null),
      thread("e", null),
    ]);

    const handled = await backfillOptOuts("brand-1");

    expect(handled).toBe(2);
    expect(mocks.ccUpdate).toHaveBeenCalledTimes(2);
    expect(mocks.ccUpdate).toHaveBeenCalledWith({
      where: { id: "cc-a" },
      data: expect.objectContaining({ replyDecision: "no", lifecycleStatus: "opted_out" }),
    });
    expect(mocks.messageUpdate).toHaveBeenCalledWith({
      where: { id: "m-a" },
      data: expect.objectContaining({ classification: "unsubscribe" }),
    });
    expect(mocks.threadUpdate).toHaveBeenCalledWith({ where: { id: "a" }, data: { status: "closed" } });
    expect(mocks.addSuppression).toHaveBeenCalledWith("a@example.com", "REPLY_OPTOUT", "brand-1");
    // No creator email on file: falls back to the sender's address.
    expect(mocks.addSuppression).toHaveBeenCalledWith("dee@example.com", "REPLY_OPTOUT", "brand-1");
  });

  it("does nothing on a second run once threads have a decision", async () => {
    mocks.threadFindMany.mockResolvedValue([]);
    expect(await backfillOptOuts("brand-1")).toBe(0);
    expect(mocks.ccUpdate).not.toHaveBeenCalled();
    expect(mocks.addSuppression).not.toHaveBeenCalled();
  });
});
