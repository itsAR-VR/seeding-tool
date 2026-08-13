/**
 * Suggested Discovery — vision classification.
 *
 * Primary niche-match decision: an OpenAI vision call over the profile
 * screenshot plus the extracted profile fields. Returns null when no
 * API key is configured so callers can fall back to text matching.
 *
 * `buildVerdictPrompt` and `parseVerdictJson` are pure and unit-tested;
 * `classifyCandidate` accepts an injected client for the same reason.
 */

import OpenAI from "openai";
import { AI_MODEL } from "@/lib/ai/config";
import {
  CANONICAL_DISCOVERY_CATEGORIES,
  isCanonicalDiscoveryCategory,
} from "@/lib/categories/catalog";
import { log } from "@/lib/logger";
import type { MatchVerdict, SuggestedProfile } from "./types";

export function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export function buildVerdictPrompt(niche: string): string {
  const categories = CANONICAL_DISCOVERY_CATEGORIES.filter((c) => c !== "Other").join(
    ", "
  );
  return [
    "You are screening Instagram creator profiles for an influencer seeding program.",
    "",
    `Target niche: ${niche}`,
    "",
    "Decide whether this profile is a good niche match for gifting the brand's product.",
    "Judge on: bio/category text, visible content themes, audience signals. Ignore follower count alone.",
    "",
    "Respond with ONLY a JSON object, no prose:",
    '{ "match": boolean, "confidence": number 0..1, "tags": string[], "reason": string }',
    "",
    `tags must be chosen from: ${categories}. Pick 1-3, most specific first.`,
    "reason: one short sentence an operator would read in a review queue.",
  ].join("\n");
}

function buildProfileContext(profile: SuggestedProfile): string {
  const lines = [
    `Handle: @${profile.handle}`,
    profile.displayName ? `Name: ${profile.displayName}` : null,
    profile.category ? `Instagram category: ${profile.category}` : null,
    profile.followers !== null ? `Followers: ${profile.followers}` : null,
    profile.externalUrl ? `External link: ${profile.externalUrl}` : null,
    profile.isVerified ? "Verified: yes" : null,
    profile.bio ? `Bio:\n${profile.bio}` : null,
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Defensive parse of the model's JSON reply. Tolerates code fences and
 * surrounding prose; returns null on anything unrecoverable.
 */
export function parseVerdictJson(raw: string): MatchVerdict | null {
  const cleaned = raw
    .replace(/```(?:json)?/gi, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  const tags = Array.isArray(record.tags)
    ? record.tags
        .filter((tag): tag is string => typeof tag === "string")
        .filter(isCanonicalDiscoveryCategory)
        .slice(0, 3)
    : [];

  const confidence =
    typeof record.confidence === "number" && Number.isFinite(record.confidence)
      ? Math.min(1, Math.max(0, record.confidence))
      : 0.5;

  return {
    match: record.match === true,
    confidence,
    tags,
    reason: typeof record.reason === "string" ? record.reason.trim().slice(0, 280) : "",
    source: "vision",
  };
}

export interface ClassifyCandidateInput {
  niche: string;
  profile: SuggestedProfile;
  /** PNG bytes of the profile screenshot, when captured. */
  screenshot?: Buffer | null;
  /** Test seam — defaults to the env-configured client. */
  client?: OpenAI | null;
}

export async function classifyCandidate(
  input: ClassifyCandidateInput
): Promise<MatchVerdict | null> {
  const client = input.client === undefined ? getOpenAIClient() : input.client;
  if (!client) return null;

  const userContent: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: `Profile data:\n${buildProfileContext(input.profile)}`,
    },
  ];

  if (input.screenshot) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: `data:image/png;base64,${input.screenshot.toString("base64")}`,
      },
    });
  }

  try {
    const response = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: buildVerdictPrompt(input.niche) },
        { role: "user", content: userContent },
      ],
      max_completion_tokens: 400,
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    return parseVerdictJson(raw);
  } catch (error) {
    log("warn", "suggested_discovery.vision_failed", {
      handle: input.profile.handle,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
