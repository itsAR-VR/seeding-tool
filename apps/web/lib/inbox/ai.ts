import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

type ClassificationResult = {
  intent: "positive" | "negative" | "address" | "question" | "other";
  confidence: number;
};

type ExtractedAddress = {
  fullName: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
};

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

/**
 * Create an intervention case when AI processing fails or is unavailable.
 * // INVARIANT: OpenAI failures create Interventions, never propagate as 500s.
 */
async function createAIIntervention(
  brandId: string,
  title: string,
  description: string,
  campaignCreatorId?: string
) {
  return prisma.interventionCase.create({
    data: {
      type: "manual_review",
      status: "open",
      priority: "normal",
      title,
      description,
      brandId,
      campaignCreatorId,
    },
  });
}

/**
 * Classify an inbound reply message using AI.
 * // INVARIANT: OpenAI failures create Interventions, never propagate as 500s.
 */
export async function classifyReply(
  message: { body: string; subject?: string | null },
  brandId: string,
  campaignCreatorId?: string
): Promise<ClassificationResult> {
  const client = getOpenAIClient();

  if (!client) {
    await createAIIntervention(
      brandId,
      "AI classification unavailable",
      `OpenAI API key not configured. Manual review required for message: "${message.body.slice(0, 200)}..."`,
      campaignCreatorId
    );
    return { intent: "other", confidence: 0 };
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are an email classifier for a creator seeding platform. 
Classify the creator's reply into one of these intents:
- "positive": Creator is interested, willing to participate
- "negative": Creator declines, not interested, opts out
- "address": Creator is providing their shipping address
- "question": Creator has questions about the campaign/product
- "other": Anything else (auto-replies, irrelevant content)

Respond with JSON: { "intent": string, "confidence": number (0-1) }`,
        },
        {
          role: "user",
          content: `Subject: ${message.subject ?? "(none)"}\n\nBody:\n${message.body}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(content) as ClassificationResult;

    // Record AI artifact
    await prisma.aIArtifact.create({
      data: {
        type: "classification",
        input: { subject: message.subject, body: message.body.slice(0, 500) },
        output: parsed,
        model: "gpt-4o-mini",
        tokens: response.usage?.total_tokens,
      },
    });

    return {
      intent: parsed.intent,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
    };
  } catch (error) {
    // INVARIANT: OpenAI failures create Interventions, never propagate as 500s.
    await createAIIntervention(
      brandId,
      "AI classification failed",
      `Error classifying reply: ${error instanceof Error ? error.message : "Unknown error"}. Message: "${message.body.slice(0, 200)}..."`,
      campaignCreatorId
    );
    return { intent: "other", confidence: 0 };
  }
}

/**
 * Extract a structured shipping address from a message body.
 * // INVARIANT: OpenAI failures create Interventions, never propagate as 500s.
 */
export async function extractAddress(
  messageBody: string,
  brandId: string,
  campaignCreatorId?: string
): Promise<ExtractedAddress | null> {
  const client = getOpenAIClient();

  if (!client) {
    await createAIIntervention(
      brandId,
      "AI address extraction unavailable",
      `OpenAI API key not configured. Manual address extraction required for: "${messageBody.slice(0, 200)}..."`,
      campaignCreatorId
    );
    return null;
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Extract a shipping address from the following message. 
Return JSON: { "fullName": string|null, "line1": string|null, "line2": string|null, "city": string|null, "state": string|null, "postalCode": string|null, "country": string|null, "phone": string|null }
If no address is found, return all null values.`,
        },
        {
          role: "user",
          content: messageBody,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(content) as ExtractedAddress;

    // Record AI artifact
    await prisma.aIArtifact.create({
      data: {
        type: "extraction",
        input: { body: messageBody.slice(0, 500) },
        output: parsed,
        model: "gpt-4o-mini",
        tokens: response.usage?.total_tokens,
      },
    });

    // Check if we actually got an address
    if (!parsed.line1 && !parsed.city) {
      return null;
    }

    return parsed;
  } catch (error) {
    // INVARIANT: OpenAI failures create Interventions, never propagate as 500s.
    await createAIIntervention(
      brandId,
      "AI address extraction failed",
      `Error extracting address: ${error instanceof Error ? error.message : "Unknown error"}`,
      campaignCreatorId
    );
    return null;
  }
}

/**
 * Generate a draft reply for a conversation thread.
 * // INVARIANT: OpenAI failures create Interventions, never propagate as 500s.
 * // INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.
 */
export async function generateDraft(
  thread: {
    messages: Array<{ direction: string; body: string; subject?: string | null }>;
    campaignCreator: {
      campaign: { name: string };
      creator: { name?: string | null };
    };
  },
  brandId: string,
  brandVoice?: string | null,
  campaignCreatorId?: string
): Promise<string | null> {
  const client = getOpenAIClient();

  if (!client) {
    await createAIIntervention(
      brandId,
      "AI draft generation unavailable",
      `OpenAI API key not configured. Manual draft required for thread in campaign "${thread.campaignCreator.campaign.name}".`,
      campaignCreatorId
    );
    return null;
  }

  try {
    const conversationContext = thread.messages
      .map((m) => `[${m.direction.toUpperCase()}]: ${m.body}`)
      .join("\n\n---\n\n");

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a brand outreach assistant helping manage creator seeding campaigns.
Campaign: "${thread.campaignCreator.campaign.name}"
Creator: "${thread.campaignCreator.creator.name ?? "Unknown"}"
${brandVoice ? `Brand voice: ${brandVoice}` : "Use a friendly, professional tone."}

Write a concise, natural reply to the creator's last message. Keep it conversational and warm.
Do NOT include subject lines. Only output the email body text.`,
        },
        {
          role: "user",
          content: `Conversation so far:\n\n${conversationContext}\n\nWrite the next reply from the brand.`,
        },
      ],
    });

    const draft = response.choices[0]?.message?.content;
    if (!draft) {
      throw new Error("Empty response from OpenAI");
    }

    // Record AI artifact
    await prisma.aIArtifact.create({
      data: {
        type: "draft",
        input: { messageCount: thread.messages.length },
        output: { draft: draft.slice(0, 500) },
        model: "gpt-4o-mini",
        tokens: response.usage?.total_tokens,
        threadId: undefined, // filled by caller if needed
      },
    });

    return draft;
  } catch (error) {
    // INVARIANT: OpenAI failures create Interventions, never propagate as 500s.
    await createAIIntervention(
      brandId,
      "AI draft generation failed",
      `Error generating draft: ${error instanceof Error ? error.message : "Unknown error"}`,
      campaignCreatorId
    );
    return null;
  }
}
