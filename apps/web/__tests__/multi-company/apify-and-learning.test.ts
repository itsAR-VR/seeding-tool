import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = {
  brand: { findUnique: vi.fn() },
  message: { findFirst: vi.fn() },
  learnedReply: { create: vi.fn(), findMany: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/encryption", () => ({ decrypt: (v: string) => `plain:${v}` }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APIFY_API_TOKEN = "shared-token";
});

describe("per-company Apify keys", () => {
  it("uses the company's own key first", async () => {
    mockPrisma.brand.findUnique.mockResolvedValue({ apifyTokenEnc: "enc", useSharedApify: true });
    const { resolveApifyToken } = await import("@/lib/apify/token");
    expect(await resolveApifyToken("b1")).toBe("plain:enc");
  });

  it("uses the shared key only when an admin allowed it", async () => {
    mockPrisma.brand.findUnique.mockResolvedValue({ apifyTokenEnc: null, useSharedApify: true });
    const { resolveApifyToken } = await import("@/lib/apify/token");
    expect(await resolveApifyToken("b1")).toBe("shared-token");
  });

  it("refuses when a company has neither", async () => {
    mockPrisma.brand.findUnique.mockResolvedValue({ apifyTokenEnc: null, useSharedApify: false });
    const { resolveApifyToken, ApifyKeyMissingError } = await import("@/lib/apify/token");
    await expect(resolveApifyToken("b1")).rejects.toBeInstanceOf(ApifyKeyMissingError);
  });

  it("scopes the token to the running work", async () => {
    mockPrisma.brand.findUnique.mockResolvedValue({ apifyTokenEnc: "enc", useSharedApify: false });
    const { withBrandApify, currentApifyToken } = await import("@/lib/apify/token");
    expect(await withBrandApify("b1", async () => currentApifyToken())).toBe("plain:enc");
    expect(() => currentApifyToken()).toThrow();
  });
});

describe("learning from sent replies", () => {
  it("saves the reply paired with the creator's latest message, for that brand only", async () => {
    mockPrisma.message.findFirst.mockResolvedValue({ body: "Do I have to post?" });
    const { learnFromSentReply } = await import("@/lib/inbox/learned-replies");
    await learnFromSentReply({ brandId: "b1", threadId: "t1", answer: "I'd love for you to try it first!" });
    expect(mockPrisma.message.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { threadId: "t1", direction: "inbound" } }),
    );
    expect(mockPrisma.learnedReply.create).toHaveBeenCalledWith({
      data: { brandId: "b1", question: "Do I have to post?", answer: "I'd love for you to try it first!" },
    });
  });

  it("skips replies too short to teach anything", async () => {
    const { learnFromSentReply } = await import("@/lib/inbox/learned-replies");
    await learnFromSentReply({ brandId: "b1", threadId: "t1", answer: "Thanks!" });
    expect(mockPrisma.learnedReply.create).not.toHaveBeenCalled();
  });

  it("only reads examples from the asking brand", async () => {
    mockPrisma.learnedReply.findMany.mockResolvedValue([]);
    const { learnedExamplesFor } = await import("@/lib/inbox/learned-replies");
    await learnedExamplesFor("b2");
    expect(mockPrisma.learnedReply.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { brandId: "b2" } }));
  });
});
