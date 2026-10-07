/**
 * Context-aware AI outreach draft generation using OpenAI.
 */
import OpenAI from "openai";
import type { OutreachPersona } from "./personas";
import { AI_MODEL } from "@/lib/ai/config";

// Created lazily: constructing the client without a key throws, which would
// crash the whole route module instead of just this code path.
let openaiClient: OpenAI | null = null;
function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI drafting is not configured (OPENAI_API_KEY missing)");
  }
  openaiClient ??= new OpenAI({ apiKey });
  return openaiClient;
}

export type CreatorProfile = {
  handle: string;
  name?: string | null;
  followerCount?: number | null;
  bio?: string | null;
  niche?: string | null;
};

export type CampaignInfo = {
  name: string;
  description?: string | null;
  products: Array<{
    name: string;
    description?: string | null;
    productUrl?: string | null;
    retailValue?: number | null; // cents
  }>;
};

export type DraftChannel = "email" | "instagram_dm";

export type GenerateDraftParams = {
  creatorProfile: CreatorProfile;
  campaign: CampaignInfo;
  persona: OutreachPersona;
  channel: DraftChannel;
  additionalContext?: string;
  brandName?: string;
};

export type GeneratedDraft = {
  subject?: string;
  body: string;
  bodyHtml?: string;
  tokens: number;
};

/**
 * Build the user prompt with all context for draft generation.
 */
/**
 * How every outreach email opens. Kam's rule (Oct 2026): a short, plain
 * compliment reads like a person; a detailed one ("I love how you help
 * overstimulated moms...") reads like AI read their bio.
 */
export const OPENER_RULES = `- After the greeting, open with ONE short line in exactly this shape: "I love your <topic> content!" where <topic> is 1 to 3 everyday words for what they post (for example: fitness, fashion, wellness, nutrition, beauty, sleep, health, running, gut health, hormone health).
- For moms, write "I love your content about motherhood!" (or "...about motherhood and business!" if they also run a business). Never "mom content".
- Word choices: say "fitness" (never "strength", "strength training" or "movement"), "fashion" (never "style"), "wellness" (never "midlife wellness"). Never say "body confidence".
- Never write a detailed compliment about their mission or who they help (no "I love how you help...").`;

/**
 * Topics saved in a creator's notes by a CSV import ("Topics: mom, founder"),
 * as words the opener rules understand. Used when there's no bio or category,
 * so the opener still says what they post about. Only the topics are read;
 * the rest of the note (internal tags, history) never reaches the email.
 */
export function nicheFromNotes(notes: string | null | undefined): string | null {
  const raw = notes?.match(/Topics:\s*([^|\n]+)/i)?.[1];
  if (!raw) return null;
  const topics = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (topics.length === 0) return null;
  const words = topics.map((t) => (t === "mom" || t === "moms" ? "motherhood" : t === "founder" ? "business" : t));
  return [...new Set(words)].join(", ");
}

/** Safety net for the opener rules when the model slips. */
export function tidyOpener(body: string): string {
  return body
    .replace(/I love your (strength training|strength|movement) content!/g, "I love your fitness content!")
    .replace(/I love your style( and [a-z ]+)? content!/g, (_m, rest: string | undefined) => `I love your fashion${rest ?? ""} content!`)
    .replace(/I love your midlife wellness content!/g, "I love your wellness content!")
    .replace(/I love your mom content!/g, "I love your content about motherhood!")
    .replace(/I love your body confidence content!/g, "I love your wellness content!");
}

function buildUserPrompt(params: GenerateDraftParams): string {
  const { creatorProfile, campaign, channel, additionalContext, brandName } =
    params;

  const productLines = campaign.products
    .map((p) => {
      const value = p.retailValue ? ` (value: $${(p.retailValue / 100).toFixed(2)})` : "";
      const url = p.productUrl ? ` — ${p.productUrl}` : "";
      return `  - ${p.name}${value}${url}${p.description ? `: ${p.description}` : ""}`;
    })
    .join("\n");

  const creatorInfo = [
    `Handle: @${creatorProfile.handle}`,
    creatorProfile.name ? `Name: ${creatorProfile.name}` : null,
    creatorProfile.followerCount
      ? `Followers: ${creatorProfile.followerCount.toLocaleString()}`
      : null,
    creatorProfile.bio ? `Bio: ${creatorProfile.bio}` : null,
    creatorProfile.niche ? `Niche: ${creatorProfile.niche}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const channelInstructions =
    channel === "instagram_dm"
      ? `This is an Instagram DM. Keep it SHORT (2-4 sentences max). No subject line needed. Be casual and direct.`
      : `This is an email. Include a short, lowercase-friendly subject line (a few words, like "better sleep, on us").`;

  return `Generate an outreach message for the following creator and campaign.

CREATOR:
${creatorInfo}

BRAND: ${brandName || "Our brand"}

CAMPAIGN: ${campaign.name}
${campaign.description ? `Description: ${campaign.description}` : ""}

PRODUCTS:
${productLines || "  (No specific products listed)"}

CHANNEL: ${channel}
${channelInstructions}

${additionalContext ? `ADDITIONAL CONTEXT / TALKING POINTS:\n${additionalContext}` : ""}

IMPORTANT:
${OPENER_RULES}
- Then say who you are and what the product does in one or two plain sentences, and offer to send it for free.
- Mention the product(s) naturally, don't just list them
- Sound like a founder writing one email by hand: short sentences, no hype, no em dashes, no "I hope this finds you well"
- ${channel === "instagram_dm" ? "Keep it under 300 characters if possible" : "Keep the email to 3 or 4 short paragraphs"}
- For email, format the response as:
  SUBJECT: <subject line>
  BODY:
  <email body>
- For DM, just return the message text directly`;
}

/**
 * Generate an outreach draft using OpenAI.
 */
export async function generateOutreachDraft(
  params: GenerateDraftParams
): Promise<GeneratedDraft> {
  const { persona, channel } = params;

  const systemPrompt = `${persona.systemPrompt}

${
  persona.exampleMessages.length > 0
    ? `Here are example messages in this style:\n${persona.exampleMessages.map((m, i) => `Example ${i + 1}:\n${m}`).join("\n\n")}`
    : ""
}`;

  const userPrompt = buildUserPrompt(params);

  // Reasoning models (gpt-5, o-series) count their thinking against the cap. A tight
  // cap used to be spent entirely on thinking, leaving an empty email, so the cap is
  // roomy and the thinking is kept short.
  const reasoning = /^(gpt-5|o\d)/.test(AI_MODEL);
  const completion = await getOpenAI().chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_completion_tokens: 4000,
    ...(reasoning ? { reasoning_effort: "low" as const } : {}),
  });

  const content = completion.choices[0]?.message?.content ?? "";
  if (!content.trim()) {
    // Never hand back (or save) an empty email; the caller shows "Couldn't write this email".
    throw new Error(`Empty draft from ${AI_MODEL} (finish: ${completion.choices[0]?.finish_reason ?? "unknown"})`);
  }
  const totalTokens = completion.usage?.total_tokens ?? 0;

  // Parse subject + body for email
  if (channel === "email") {
    const subjectMatch = content.match(/^SUBJECT:\s*(.+?)$/m);
    const bodyMatch = content.match(/BODY:\s*\n([\s\S]+)$/m);

    if (subjectMatch && bodyMatch) {
      return {
        subject: subjectMatch[1].trim(),
        body: tidyOpener(bodyMatch[1].trim()),
        tokens: totalTokens,
      };
    }

    // Fallback: try to split on first line
    const lines = content.split("\n");
    const firstLine = lines[0]?.trim() ?? "";
    if (firstLine.toLowerCase().startsWith("subject:")) {
      return {
        subject: firstLine.replace(/^subject:\s*/i, "").trim(),
        body: tidyOpener(lines.slice(1).join("\n").trim()),
        tokens: totalTokens,
      };
    }
  }

  return {
    body: tidyOpener(content.trim()),
    tokens: totalTokens,
  };
}
