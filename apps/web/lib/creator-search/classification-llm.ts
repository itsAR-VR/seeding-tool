/**
 * LLM-based classification fallback for ambiguous creator bios.
 *
 * Separated from classification.ts to keep the hot sync path independent
 * of async OpenAI calls. The orchestrator calls these when keyword
 * classification returns confidence === "low".
 */
import OpenAI from "openai";
import {
  CANONICAL_DISCOVERY_CATEGORIES,
  isCanonicalDiscoveryCategory,
} from "@/lib/categories/catalog";
import { AI_MODEL } from "@/lib/ai/config";
import { log } from "@/lib/logger";
import type { DiscoveryClassification } from "@/lib/creator-search/classification";

const LLM_BATCH_SIZE = 10;

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

function buildClassificationPrompt(bios: readonly string[]): string {
  const categoryList = CANONICAL_DISCOVERY_CATEGORIES.filter(
    (c) => c !== "Other"
  ).join(", ");

  const entries = bios
    .map((bio, index) => `${index}: ${bio.slice(0, 300)}`)
    .join("\n");

  return [
    "Classify each creator bio into exactly one category from this list:",
    categoryList,
    "",
    'If none fit, use "Other".',
    "",
    "Bios:",
    entries,
    "",
    "Return ONLY a JSON array of objects, one per bio, in order:",
    '[{"index":0,"category":"...","confidence":"high"|"medium"|"low"}, ...]',
  ].join("\n");
}

type LLMClassificationItem = {
  index: number;
  category: string;
  confidence: "high" | "medium" | "low";
};

function parseLLMResponse(
  raw: string,
  batchSize: number,
): LLMClassificationItem[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter(
      (item): item is LLMClassificationItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.index === "number" &&
        item.index >= 0 &&
        item.index < batchSize &&
        typeof item.category === "string" &&
        isCanonicalDiscoveryCategory(item.category) &&
        (item.confidence === "high" ||
          item.confidence === "medium" ||
          item.confidence === "low")
    );
}

/**
 * Classify a single bio with LLM when keyword confidence is low.
 * Returns the original keyword result on API failure or missing key.
 */
export async function classifyWithLLMFallback(
  text: string,
  keywordResult: DiscoveryClassification,
): Promise<DiscoveryClassification> {
  if (keywordResult.confidence !== "low") {
    return keywordResult;
  }

  const results = await classifyBatchWithLLM([text], [keywordResult]);
  return results[0];
}

/**
 * Batch-classify up to 10 bios in a single LLM call.
 * Entries with confidence !== "low" are passed through unchanged.
 * On failure, all entries fall back to their keyword results.
 */
export async function classifyBatchWithLLM(
  bios: readonly string[],
  keywordResults: readonly DiscoveryClassification[],
): Promise<DiscoveryClassification[]> {
  const lowIndices: number[] = [];
  const lowBios: string[] = [];

  for (let i = 0; i < keywordResults.length; i++) {
    if (keywordResults[i].confidence === "low" && bios[i]) {
      lowIndices.push(i);
      lowBios.push(bios[i]);
    }
  }

  if (lowIndices.length === 0) {
    return [...keywordResults];
  }

  const client = getOpenAIClient();
  if (!client) {
    log("warn", "classification.llm.no_api_key", {
      count: lowIndices.length,
    });
    return [...keywordResults];
  }

  const results = [...keywordResults];

  for (let offset = 0; offset < lowBios.length; offset += LLM_BATCH_SIZE) {
    const batchBios = lowBios.slice(offset, offset + LLM_BATCH_SIZE);
    const batchOriginalIndices = lowIndices.slice(
      offset,
      offset + LLM_BATCH_SIZE,
    );

    try {
      const response = await client.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a creator bio classifier. Return only valid JSON.",
          },
          {
            role: "user",
            content: buildClassificationPrompt(batchBios),
          },
        ],
        temperature: 0,
        max_tokens: 512,
      });

      const content = response.choices[0]?.message?.content ?? "";
      const items = parseLLMResponse(content, batchBios.length);

      for (const item of items) {
        const originalIndex = batchOriginalIndices[item.index];
        if (originalIndex === undefined) {
          continue;
        }
        const base = keywordResults[originalIndex];
        results[originalIndex] = {
          ...base,
          canonicalCategory: item.category as DiscoveryClassification["canonicalCategory"],
          confidence: item.confidence,
          matchedKeywords: [...base.matchedKeywords, `llm:${item.category}`],
        };
      }

      log("info", "classification.llm.batch_success", {
        batchSize: batchBios.length,
        classified: items.length,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown LLM error";
      log("error", "classification.llm.batch_failed", {
        batchSize: batchBios.length,
        error: message,
      });
      // Fall back to keyword results (already in results array)
    }
  }

  return results;
}
