import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GmailNotConnectedError } from "@/lib/outreach/errors";
import { ShopifyNotConnectedError } from "@/lib/shopify/client";
import { UnipileNotConnectedError } from "@/lib/unipile/client";

/**
 * A brand-new company on day one has nothing connected: no Gmail, Shopify,
 * Instagram, or Apify key. These routes must answer with a plain 4xx message
 * that says what to connect, never a 500, and must never read another
 * company's data.
 */

const mocks = vi.hoisted(() => ({
  membership: {
    id: "mem-1",
    role: "owner",
    userId: "user-1",
    brandId: "brand-new",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  getFeatureFlags: vi.fn(),
  sendEmail: vi.fn(),
  sendOutreachBatch: vi.fn(),
  syncProducts: vi.fn(),
  getProducts: vi.fn(),
  completeDraftOrder: vi.fn(),
  checkDailyLimit: vi.fn(),
  getOrCreateChat: vi.fn(),
  sendDm: vi.fn(),
  validateInstagramCreators: vi.fn(),
  recordCreatorDiscoveryTouch: vi.fn(),
  inngestSend: vi.fn(),
  prisma: {
    conversationThread: { findFirst: vi.fn(), update: vi.fn() },
    emailAlias: { findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    message: { findFirst: vi.fn() },
    aIDraft: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    activityLog: { create: vi.fn() },
    campaignCreator: { findMany: vi.fn(), findUnique: vi.fn() },
    campaign: { findUnique: vi.fn() },
    interventionCase: { create: vi.fn() },
    mentionAsset: { findMany: vi.fn() },
    brandConnection: { findFirst: vi.fn(), update: vi.fn() },
    creatorSearchResult: { findFirst: vi.fn(), findUnique: vi.fn() },
    creator: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    creatorProfile: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/integrations/brand-access", () => ({
  getCurrentBrandMembership: vi.fn(async () => mocks.membership),
  getAuthorizedCampaign: vi.fn(async () => ({ id: "camp-1", brandId: mocks.membership.brandId })),
  requireWriteAccess: vi.fn((m: unknown) => m),
  BrandAccessError: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/feature-flags", () => ({ getFeatureFlags: mocks.getFeatureFlags }));
vi.mock("@/lib/gmail/send", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/outreach/send-pipeline", () => ({ sendOutreachBatch: mocks.sendOutreachBatch }));
vi.mock("@/lib/shopify/products", () => ({
  syncProducts: mocks.syncProducts,
  getProducts: mocks.getProducts,
}));
vi.mock("@/lib/shopify/orders", () => ({ completeDraftOrder: mocks.completeDraftOrder }));
vi.mock("@/lib/shopify/webhooks", () => ({ registerWebhooks: vi.fn() }));
vi.mock("@/lib/seeding/outcome-recorder", () => ({ recordOutcomeEvent: vi.fn() }));
vi.mock("@/lib/unipile/dms", () => ({
  checkDailyLimit: mocks.checkDailyLimit,
  getOrCreateChat: mocks.getOrCreateChat,
  sendDm: mocks.sendDm,
}));
vi.mock("@/lib/instagram/validator", () => ({
  validateInstagramCreators: mocks.validateInstagramCreators,
}));
vi.mock("@/lib/creator-search/provenance", () => ({
  recordCreatorDiscoveryTouch: mocks.recordCreatorDiscoveryTouch,
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: mocks.inngestSend } }));
vi.mock("@/lib/inbox/learned-replies", () => ({ learnFromSentReply: vi.fn(async () => undefined) }));

function post(body: unknown, url = "http://localhost/api/test") {
  return new NextRequest(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const thread = {
  id: "thread-1",
  brandId: "brand-new",
  campaignCreatorId: "cc-1",
  externalThreadId: null,
  unipileChatId: null,
  messages: [],
  campaignCreator: { creator: { email: "creator@example.com", instagramHandle: "creator" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getFeatureFlags.mockResolvedValue({ shopifyOrderEnabled: true, unipileDmEnabled: true });
});

describe("day one: no Gmail", () => {
  it("inbox reply says to connect Gmail when there is no inbox to send from", async () => {
    mocks.prisma.conversationThread.findFirst.mockResolvedValue(thread);
    mocks.prisma.emailAlias.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/inbox/[threadId]/reply/route");

    const res = await POST(post({ body: "Thanks!" }), { params: Promise.resolve({ threadId: "thread-1" }) });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Connect Gmail in Settings > Connections to send emails.");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    // The thread lookup is scoped to the caller's company.
    expect(mocks.prisma.conversationThread.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "thread-1", brandId: "brand-new" }) })
    );
  });

  it("inbox send turns a missing Gmail sign-in into a 400, not a 500", async () => {
    mocks.prisma.conversationThread.findFirst.mockResolvedValue(thread);
    mocks.prisma.aIDraft.findFirst.mockResolvedValue({ id: "draft-1", subject: "Hi", body: "Hello", bodyHtml: null });
    mocks.prisma.message.findFirst.mockResolvedValue(null);
    mocks.sendEmail.mockRejectedValue(new GmailNotConnectedError());
    const { POST } = await import("@/app/api/inbox/[threadId]/send/route");

    const res = await POST(post({ draftId: "draft-1", aliasId: "alias-x" }), {
      params: Promise.resolve({ threadId: "thread-1" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Connect Gmail");
  });

  it("inbox send without any inbox asks to connect Gmail before trying", async () => {
    mocks.prisma.conversationThread.findFirst.mockResolvedValue(thread);
    mocks.prisma.aIDraft.findFirst.mockResolvedValue({ id: "draft-1", subject: "Hi", body: "Hello", bodyHtml: null });
    mocks.prisma.message.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/inbox/[threadId]/send/route");

    const res = await POST(post({ draftId: "draft-1" }), { params: Promise.resolve({ threadId: "thread-1" }) });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Connect Gmail");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("outreach send stops early with a plain message when no Gmail is connected", async () => {
    mocks.prisma.campaignCreator.findMany.mockResolvedValue([{ id: "cc-1" }]);
    mocks.prisma.emailAlias.count.mockResolvedValue(0);
    const { POST } = await import("@/app/api/outreach/send/route");

    const res = await POST(
      post({ drafts: [{ campaignCreatorId: "cc-1", creatorId: "c-1", channel: "email", body: "Hi" }] })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Connect Gmail in Settings > Connections to send emails.");
    expect(mocks.sendOutreachBatch).not.toHaveBeenCalled();
    expect(mocks.prisma.emailAlias.count).toHaveBeenCalledWith({ where: { brandId: "brand-new" } });
  });
});

describe("day one: no Shopify", () => {
  it("product sync says to connect Shopify instead of failing", async () => {
    mocks.syncProducts.mockRejectedValue(new ShopifyNotConnectedError());
    const { POST } = await import("@/app/api/products/sync/route");

    const res = await POST(post({}, "http://localhost/api/products/sync"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Connect Shopify in Settings > Connections");
  });

  it("completing an order without Shopify is a 400 and opens no 'order failed' case", async () => {
    mocks.prisma.campaign.findUnique.mockResolvedValue({ id: "camp-1", brandId: "brand-new" });
    mocks.completeDraftOrder.mockRejectedValue(new ShopifyNotConnectedError());
    const { POST } = await import("@/app/api/campaigns/[campaignId]/creators/[creatorId]/order/route");

    const res = await POST(new NextRequest("http://localhost/api/test", { method: "POST" }), {
      params: Promise.resolve({ campaignId: "camp-1", creatorId: "creator-1" }),
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Connect Shopify");
    expect(mocks.prisma.interventionCase.create).not.toHaveBeenCalled();
  });

  it("explains how to turn gift orders on when the feature is off", async () => {
    mocks.getFeatureFlags.mockResolvedValue({ shopifyOrderEnabled: false });
    const { POST } = await import("@/app/api/campaigns/[campaignId]/creators/[creatorId]/order/route");

    const res = await POST(new NextRequest("http://localhost/api/test", { method: "POST" }), {
      params: Promise.resolve({ campaignId: "camp-1", creatorId: "creator-1" }),
    });

    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain("Settings > Features");
  });
});

describe("day one: no Instagram messages", () => {
  it("sending a DM says to connect Instagram messages", async () => {
    mocks.prisma.conversationThread.findFirst.mockResolvedValue(thread);
    mocks.checkDailyLimit.mockResolvedValue({ allowed: true, sent: 0, limit: 20 });
    mocks.getOrCreateChat.mockRejectedValue(new UnipileNotConnectedError());
    const { POST } = await import("@/app/api/inbox/[threadId]/send-dm/route");

    const res = await POST(post({ message: "Hi!" }), { params: Promise.resolve({ threadId: "thread-1" }) });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("Connect Instagram messages");
  });
});

describe("cross-company safety", () => {
  it("mentions without a campaign only list the caller's company", async () => {
    mocks.prisma.mentionAsset.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/mentions/route");

    const res = await GET(new NextRequest("http://localhost/api/mentions"));

    expect(res.status).toBe(200);
    expect(mocks.prisma.mentionAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignCreator: { campaign: { brandId: "brand-new" } } },
      })
    );
  });

  it("mentions for a campaign are still scoped to the caller's company", async () => {
    mocks.prisma.mentionAsset.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/mentions/route");

    await GET(new NextRequest("http://localhost/api/mentions?campaignId=camp-other"));

    expect(mocks.prisma.mentionAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignCreator: { campaign: { brandId: "brand-new", id: "camp-other" } } },
      })
    );
  });

  it("creator import only reads search results from the caller's own searches", async () => {
    mocks.validateInstagramCreators.mockResolvedValue([
      { handle: "creator", status: "valid", followerCount: 1200, url: "https://instagram.com/creator" },
    ]);
    mocks.prisma.creatorSearchResult.findFirst.mockResolvedValue(null);
    mocks.prisma.creator.findFirst.mockResolvedValue({ id: "creator-1", name: "C", email: null });
    mocks.prisma.creator.update.mockResolvedValue({});
    mocks.prisma.creatorProfile.upsert.mockResolvedValue({});
    const { POST } = await import("@/app/api/creators/import/route");

    const res = await POST(post({ rows: [{ username: "creator", searchResultId: "result-of-other-company" }] }));

    expect(res.status).toBe(200);
    expect(mocks.prisma.creatorSearchResult.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.creatorSearchResult.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "result-of-other-company", searchJob: { brandId: "brand-new" } },
      })
    );
  });
});
