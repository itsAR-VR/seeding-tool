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

describe("classifyWithLLMFallback", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    createMock.mockReset();
  });

  it("returns keyword result unchanged when confidence is not low", async () => {
    const { classifyWithLLMFallback } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const keywordResult = makeKeywordResult({
      canonicalCategory: "Beauty",
      confidence: "high",
    });
    const result = await classifyWithLLMFallback(
      "beauty creator bio",
      keywordResult,
    );
    expect(result).toEqual(keywordResult);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("calls LLM and returns classified result on low confidence", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '[{"index":0,"category":"Tech","confidence":"high"}]',
          },
        },
      ],
    });

    const { classifyWithLLMFallback } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const keywordResult = makeKeywordResult();
    const result = await classifyWithLLMFallback(
      "Software engineer building tools",
      keywordResult,
    );

    expect(result.canonicalCategory).toBe("Tech");
    expect(result.confidence).toBe("high");
    expect(result.matchedKeywords).toContain("llm:Tech");
  });

  it("falls back to keyword result on API failure", async () => {
    createMock.mockRejectedValueOnce(new Error("API timeout"));

    const { classifyWithLLMFallback } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const keywordResult = makeKeywordResult();
    const result = await classifyWithLLMFallback(
      "mysterious bio text",
      keywordResult,
    );

    expect(result).toEqual(keywordResult);
  });

  it("falls back to keyword result when OPENAI_API_KEY is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const { classifyWithLLMFallback } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const keywordResult = makeKeywordResult();
    const result = await classifyWithLLMFallback(
      "mysterious bio text",
      keywordResult,
    );

    expect(result).toEqual(keywordResult);
  });

  it("rejects invalid categories from LLM response", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content:
              '[{"index":0,"category":"NotACategory","confidence":"high"}]',
          },
        },
      ],
    });

    const { classifyWithLLMFallback } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const keywordResult = makeKeywordResult();
    const result = await classifyWithLLMFallback("some bio", keywordResult);

    // Invalid category is rejected, falls back to keyword result
    expect(result.canonicalCategory).toBe("Other");
  });
});

describe("classifyBatchWithLLM", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    createMock.mockReset();
  });

  it("sends one prompt for up to 10 bios", async () => {
    const bios = Array.from({ length: 8 }, (_, i) => `Creator bio ${i}`);
    const results = bios.map(() => makeKeywordResult());

    const responseItems = bios.map((_, i) => ({
      index: i,
      category: "Beauty",
      confidence: "medium",
    }));

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify(responseItems),
          },
        },
      ],
    });

    const { classifyBatchWithLLM } = await import(
      "@/lib/creator-search/classification-llm"
    );
    await classifyBatchWithLLM(bios, results);

    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("passes through entries with non-low confidence unchanged", async () => {
    const bios = ["beauty guru", "random person"];
    const results = [
      makeKeywordResult({
        canonicalCategory: "Beauty",
        confidence: "high",
      }),
      makeKeywordResult({ confidence: "low" }),
    ];

    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '[{"index":0,"category":"Tech","confidence":"high"}]',
          },
        },
      ],
    });

    const { classifyBatchWithLLM } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const output = await classifyBatchWithLLM(bios, results);

    // First entry unchanged (was high confidence)
    expect(output[0].canonicalCategory).toBe("Beauty");
    // Second entry classified by LLM
    expect(output[1].canonicalCategory).toBe("Tech");
  });

  it("returns keyword results array when all have non-low confidence", async () => {
    const bios = ["beauty bio"];
    const results = [
      makeKeywordResult({
        canonicalCategory: "Beauty",
        confidence: "high",
      }),
    ];

    const { classifyBatchWithLLM } = await import(
      "@/lib/creator-search/classification-llm"
    );
    const output = await classifyBatchWithLLM(bios, results);

    expect(output).toEqual(results);
    expect(createMock).not.toHaveBeenCalled();
  });
});
