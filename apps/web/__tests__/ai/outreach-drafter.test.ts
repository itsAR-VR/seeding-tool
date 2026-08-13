import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateDraftParams } from "@/lib/ai/outreach-drafter";

// ── Hoisted mock ───────────────────────────────────────────
const createMock = vi.fn();

vi.mock("openai", () => {
  function MockOpenAI() {
    return {
      chat: {
        completions: {
          create: createMock,
        },
      },
    };
  }
  return { default: MockOpenAI };
});

vi.mock("@/lib/ai/config", () => ({
  AI_MODEL: "test-model",
}));

// ── Factories ──────────────────────────────────────────────

function makeParams(
  overrides: Partial<GenerateDraftParams> = {},
): GenerateDraftParams {
  return {
    creatorProfile: {
      handle: "beautycreator",
      name: "Jane Smith",
      followerCount: 25000,
      bio: "Beauty and skincare expert",
      niche: "Skincare",
    },
    campaign: {
      name: "Summer Glow Campaign",
      description: "Promote our new SPF moisturizer line",
      products: [
        {
          name: "SPF 50 Moisturizer",
          description: "Lightweight daily SPF moisturizer",
          productUrl: "https://brand.com/spf50",
          retailValue: 3500,
        },
      ],
    },
    persona: {
      id: "test-persona",
      name: "Professional",
      description: "Professional outreach persona",
      tone: "professional",
      systemPrompt: "You are a professional brand outreach manager.",
      exampleMessages: ["Example outreach message here."],
    },
    channel: "email",
    brandName: "Glow Beauty",
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────

describe("generateOutreachDraft", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    createMock.mockReset();
  });

  it("generates a draft with subject and body for email channel", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content:
              "SUBJECT: Collaboration Opportunity with Glow Beauty\nBODY:\nHi Jane,\n\nWe've been following your skincare content and love your approach.\n\nWe'd love to send you our new SPF 50 Moisturizer to try.\n\nBest,\nGlow Beauty Team",
          },
        },
      ],
      usage: { total_tokens: 150 },
    });

    const { generateOutreachDraft } = await import(
      "@/lib/ai/outreach-drafter"
    );
    const draft = await generateOutreachDraft(makeParams());

    expect(draft.subject).toBe(
      "Collaboration Opportunity with Glow Beauty",
    );
    expect(draft.body).toContain("Hi Jane");
    expect(draft.body).toContain("SPF 50 Moisturizer");
    expect(draft.tokens).toBe(150);
  });

  it("returns body-only for DM channel (no subject)", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content:
              "Hey Jane! Love your skincare content. We'd love to send you our new SPF moisturizer to try!",
          },
        },
      ],
      usage: { total_tokens: 45 },
    });

    const { generateOutreachDraft } = await import(
      "@/lib/ai/outreach-drafter"
    );
    const draft = await generateOutreachDraft(
      makeParams({ channel: "instagram_dm" }),
    );

    expect(draft.subject).toBeUndefined();
    expect(draft.body).toContain("skincare");
    expect(draft.tokens).toBe(45);
  });

  it("uses channel-specific max_completion_tokens", async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: "SUBJECT: Test\nBODY:\nTest body" } }],
      usage: { total_tokens: 10 },
    });

    const { generateOutreachDraft } = await import(
      "@/lib/ai/outreach-drafter"
    );
    await generateOutreachDraft(makeParams({ channel: "email" }));

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        max_completion_tokens: 800,
      }),
    );

    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: "Hey! Quick DM." } }],
      usage: { total_tokens: 10 },
    });

    await generateOutreachDraft(makeParams({ channel: "instagram_dm" }));

    expect(createMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        max_completion_tokens: 300,
      }),
    );
  });

  it("includes product context in the prompt", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        { message: { content: "SUBJECT: Test\nBODY:\nHi there" } },
      ],
      usage: { total_tokens: 10 },
    });

    const { generateOutreachDraft } = await import(
      "@/lib/ai/outreach-drafter"
    );
    await generateOutreachDraft(
      makeParams({
        campaign: {
          name: "Test Campaign",
          products: [
            {
              name: "Premium Serum",
              description: "Anti-aging face serum",
              productUrl: "https://brand.com/serum",
              retailValue: 8900,
            },
          ],
        },
      }),
    );

    // Verify user prompt includes product details
    const callArgs = createMock.mock.calls[0][0];
    const userMessage = callArgs.messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMessage.content).toContain("Premium Serum");
    expect(userMessage.content).toContain("$89.00");
    expect(userMessage.content).toContain("https://brand.com/serum");
    expect(userMessage.content).toContain("Anti-aging face serum");
  });

  it("includes brand name in prompt", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        { message: { content: "SUBJECT: Hey!\nBODY:\nBody text" } },
      ],
      usage: { total_tokens: 10 },
    });

    const { generateOutreachDraft } = await import(
      "@/lib/ai/outreach-drafter"
    );
    await generateOutreachDraft(makeParams({ brandName: "Acme Corp" }));

    const callArgs = createMock.mock.calls[0][0];
    const userMessage = callArgs.messages.find(
      (m: { role: string }) => m.role === "user",
    );
    expect(userMessage.content).toContain("Acme Corp");
  });

  it("handles email response without SUBJECT/BODY format gracefully", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "subject: Quick collab idea\nHere is the body of the email.",
          },
        },
      ],
      usage: { total_tokens: 30 },
    });

    const { generateOutreachDraft } = await import(
      "@/lib/ai/outreach-drafter"
    );
    const draft = await generateOutreachDraft(makeParams({ channel: "email" }));

    // Fallback parsing: first line has "subject:" prefix
    expect(draft.subject).toBe("Quick collab idea");
    expect(draft.body).toContain("body of the email");
  });

  it("defaults to 0 tokens when usage is missing", async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: "Hey! Quick message." } }],
      usage: undefined,
    });

    const { generateOutreachDraft } = await import(
      "@/lib/ai/outreach-drafter"
    );
    const draft = await generateOutreachDraft(
      makeParams({ channel: "instagram_dm" }),
    );

    expect(draft.tokens).toBe(0);
  });

  it("includes persona system prompt and example messages", async () => {
    createMock.mockResolvedValueOnce({
      choices: [{ message: { content: "SUBJECT: Hi\nBODY:\nHello" } }],
      usage: { total_tokens: 10 },
    });

    const customPersona = {
      id: "custom-1",
      name: "Custom",
      description: "Custom persona",
      tone: "casual" as const,
      systemPrompt: "You are a super casual outreach writer.",
      exampleMessages: ["Hey! Collab?", "Yo check this out"],
    };

    const { generateOutreachDraft } = await import(
      "@/lib/ai/outreach-drafter"
    );
    await generateOutreachDraft(makeParams({ persona: customPersona }));

    const callArgs = createMock.mock.calls[0][0];
    const systemMessage = callArgs.messages.find(
      (m: { role: string }) => m.role === "system",
    );
    expect(systemMessage.content).toContain(
      "You are a super casual outreach writer.",
    );
    expect(systemMessage.content).toContain("Example 1:");
    expect(systemMessage.content).toContain("Hey! Collab?");
    expect(systemMessage.content).toContain("Example 2:");
  });

  it("handles empty choices array", async () => {
    createMock.mockResolvedValueOnce({
      choices: [],
      usage: { total_tokens: 0 },
    });

    const { generateOutreachDraft } = await import(
      "@/lib/ai/outreach-drafter"
    );
    const draft = await generateOutreachDraft(
      makeParams({ channel: "instagram_dm" }),
    );

    expect(draft.body).toBe("");
    expect(draft.tokens).toBe(0);
  });
});
