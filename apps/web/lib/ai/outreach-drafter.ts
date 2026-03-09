/**
 * Context-aware AI outreach draft generation using OpenAI.
 */
import OpenAI from "openai";
import type { OutreachPersona } from "./personas";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
  tokens: number;
};

/**
 * Build the user prompt with all context for draft generation.
 */
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
      : `This is an email. Include a compelling subject line. Can be 3-5 paragraphs. Be thorough but not verbose.`;

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
- Personalize the message to this specific creator
- Mention the product(s) naturally, don't just list them
- Make it feel genuine, not templated
- ${channel === "instagram_dm" ? "Keep it under 300 characters if possible" : "Keep the email concise but complete"}
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

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    max_tokens: channel === "instagram_dm" ? 300 : 800,
  });

  const content = completion.choices[0]?.message?.content ?? "";
  const totalTokens = completion.usage?.total_tokens ?? 0;

  // Parse subject + body for email
  if (channel === "email") {
    const subjectMatch = content.match(/^SUBJECT:\s*(.+?)$/m);
    const bodyMatch = content.match(/BODY:\s*\n([\s\S]+)$/m);

    if (subjectMatch && bodyMatch) {
      return {
        subject: subjectMatch[1].trim(),
        body: bodyMatch[1].trim(),
        tokens: totalTokens,
      };
    }

    // Fallback: try to split on first line
    const lines = content.split("\n");
    const firstLine = lines[0]?.trim() ?? "";
    if (firstLine.toLowerCase().startsWith("subject:")) {
      return {
        subject: firstLine.replace(/^subject:\s*/i, "").trim(),
        body: lines.slice(1).join("\n").trim(),
        tokens: totalTokens,
      };
    }
  }

  return {
    body: content.trim(),
    tokens: totalTokens,
  };
}
