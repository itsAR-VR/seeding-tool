import { describe, expect, it, vi, beforeEach } from "vitest";
import type { DiscoveryClassification } from "@/lib/creator-search/classification";

const createMock = vi.fn();

function MockOpenAI() {
  return {
    chat: {
      completions: {
        create: createMock,
      },
    },
  };
}

vi.mock("openai", () => ({
  default: MockOpenAI,
}));

vi.mock("@/lib/ai/config", () => ({
  AI_MODEL: "test-model",
}));

vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}));

function makeKeywordResult(
  overrides: Partial<DiscoveryClassification> = {},
): DiscoveryClassification {
  return {
    canonicalCategory: "Other",
    rawSourceCategory: null,
    confidence: "low",
    matchedKeywords: [],
    expandedCategories: [],
    languageDetected: null,
    topicSignals: [],
    ...overrides,
  };
}

describe("classifyBatchWithLLM — extended coverage", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    createMock.mockReset();
  });

  it("classifies a batch of 10 low-confidence bios in a single LLM call", async () => {
    const bios = Array.from({ length: 10 }, (_, i) => `Creator bio ${i}`);
    const results = bios.map(() => makeKeywordResult());

    const responseItems = bios.map((_, i) => ({
      index: i,
      category: "Beauty",
      confidence: "high",
    }));

    createMock.mockResolvedValueOnce({
      choices: [
        { message: { content: JSON.stringify(responseItems) } },
      ],
    });

    const { classifyBatchWithLLM } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const output = await classifyBatchWithLLM(bios, results);

    // Should use exactly one LLM call for 10 bios (batch limit)
    expect(createMock).toHaveBeenCalledTimes(1);
    // All 10 should be classified as Beauty
    for (const result of output) {
      expect(result.canonicalCategory).toBe("Beauty");
      expect(result.confidence).toBe("high");
    }
  });

  it("rejects invalid category and falls back to keyword result for that entry", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { index: 0, category: "NotARealCategory", confidence: "high" },
              { index: 1, category: "Tech", confidence: "medium" },
            ]),
          },
        },
      ],
    });

    const bios = ["ambiguous creator", "tech guru"];
    const results = [makeKeywordResult(), makeKeywordResult()];

    const { classifyBatchWithLLM } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const output = await classifyBatchWithLLM(bios, results);

    // Index 0: invalid category rejected, stays as keyword result "Other"
    expect(output[0].canonicalCategory).toBe("Other");
    // Index 1: valid category accepted
    expect(output[1].canonicalCategory).toBe("Tech");
    expect(output[1].confidence).toBe("medium");
    expect(output[1].matchedKeywords).toContain("llm:Tech");
  });

  it("falls back to all keyword results when API call throws", async () => {
    createMock.mockRejectedValueOnce(new Error("Rate limit exceeded"));

    const bios = ["bio one", "bio two", "bio three"];
    const kwResults = bios.map((_, i) =>
      makeKeywordResult({
        canonicalCategory: i === 0 ? "Beauty" : "Other",
        confidence: "low",
      }),
    );

    const { classifyBatchWithLLM } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const output = await classifyBatchWithLLM(bios, kwResults);

    // All results should be the original keyword results
    expect(output[0].canonicalCategory).toBe("Beauty");
    expect(output[1].canonicalCategory).toBe("Other");
    expect(output[2].canonicalCategory).toBe("Other");
  });

  it("handles malformed JSON response gracefully", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        { message: { content: "This is not JSON at all" } },
      ],
    });

    const bios = ["some bio"];
    const kwResults = [makeKeywordResult()];

    const { classifyBatchWithLLM } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const output = await classifyBatchWithLLM(bios, kwResults);

    // Falls back to keyword result
    expect(output[0].canonicalCategory).toBe("Other");
    expect(output[0].confidence).toBe("low");
  });

  it("handles empty choices array from LLM", async () => {
    createMock.mockResolvedValueOnce({
      choices: [],
    });

    const bios = ["test bio"];
    const kwResults = [makeKeywordResult()];

    const { classifyBatchWithLLM } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const output = await classifyBatchWithLLM(bios, kwResults);

    // No content from LLM, falls back to keyword result
    expect(output[0]).toEqual(kwResults[0]);
  });

  it("rejects items with out-of-range index", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { index: 99, category: "Beauty", confidence: "high" },
              { index: 0, category: "Tech", confidence: "medium" },
            ]),
          },
        },
      ],
    });

    const bios = ["bio"];
    const kwResults = [makeKeywordResult()];

    const { classifyBatchWithLLM } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const output = await classifyBatchWithLLM(bios, kwResults);

    // Index 99 is out of range, so only index 0 is valid
    expect(output[0].canonicalCategory).toBe("Tech");
  });

  it("single bio via classifyWithLLMFallback classified correctly", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '[{"index":0,"category":"Health & Wellness","confidence":"high"}]',
          },
        },
      ],
    });

    const { classifyWithLLMFallback } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const result = await classifyWithLLMFallback(
      "Yoga instructor and wellness coach helping people find balance",
      makeKeywordResult(),
    );

    expect(result.canonicalCategory).toBe("Health & Wellness");
    expect(result.confidence).toBe("high");
    expect(result.matchedKeywords).toContain("llm:Health & Wellness");
  });

  it("rejects response items with invalid confidence values", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { index: 0, category: "Beauty", confidence: "very_high" },
            ]),
          },
        },
      ],
    });

    const bios = ["beauty bio"];
    const kwResults = [makeKeywordResult()];

    const { classifyBatchWithLLM } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const output = await classifyBatchWithLLM(bios, kwResults);

    // Invalid confidence "very_high" rejected, falls back
    expect(output[0].canonicalCategory).toBe("Other");
  });
});
