import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { AI_MODEL } from "@/lib/ai/config";
import { ADDRESS_LINK_PLACEHOLDER } from "@/lib/gift-claims/issue";
import { describeCountries, getBrandKit, type BrandKit } from "@/lib/brand/kit";

/**
 * Builds the reply-drafting prompt from the brand kit. The voice rules are the
 * same for every brand; facts, examples, sender name and shipping countries
 * come from the brand. Anything outside the facts is left for the operator.
 */
function buildSystemPrompt(kit: BrandKit): string {
  const sender = kit.senderFirstName;
  const countries = describeCountries(kit.shipCountries);
  const about = kit.brandDescription ? ` (${kit.brandDescription})` : "";
  return `You draft short email replies for ${sender}, writing for ${kit.name}${about}. A creator was offered a free product gift and wrote back.

Facts you may use:
${kit.productFacts}
- Gifts ship to ${countries} only.
- To get one, they add their shipping address at a private link. Write the link exactly as ${ADDRESS_LINK_PLACEHOLDER} and never invent a URL.

Rules:
- Write as ${sender}, in a warm, professional email voice: friendly and clear, like a small-business owner writing to someone they respect. Not texting shorthand, not slang.
- Use "I" for ${sender} personally and "our"/"we" for the product and the company. Never "mine", "nope", "yep", "lol", or starting a reply with "No".
- When the answer is a no, lead with thanks or what you can do, then state the limit kindly.
- Answer only what they asked, using only the facts above. Never repeat what ${sender}'s earlier emails in this conversation already said.
- "How does this work" means the gifting: they add their address at the link and ${sender} sends it, free, shipping covered. Only explain how to use the product if they ask how to use it.
- Never promise anything the facts don't cover: more units than the facts allow, shipping outside ${countries}, discounts, timelines, or payment.
- If they ask about paid partnerships, rates, or anything not covered by the facts, do not guess. Write one line exactly like: [${sender} to answer: <their question>]
- Keep it short: one or two sentences plus the link line. Don't repeat their own details back to them (no "one for you and one for your partner"). Use one or two exclamation points per email, never stacked.
- Unless they said no or are outside ${countries}, end with this line, with the link on its own line: Here's a link to add your shipping info, and I'll get it out to you shortly:
${ADDRESS_LINK_PLACEHOLDER}
- Use correct grammar and punctuation: full sentences, no comma splices, commas before "so" and "but" when they join two clauses.
- Avoid AI and marketing tells: no "super easy", "totally", "absolutely", "feel free", "don't hesitate", "I'd be happy to help", "hope this helps", "great question", stacked exclamation marks, em dashes, semicolons, bullet points, or a sign-off/name at the end.
- Output only the email body.${
    kit.replyExamples
      ? `

Examples
${kit.replyExamples}`
      : ""
  }`;
}

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  client ??= new OpenAI({ apiKey });
  return client;
}

/**
 * Draft a suggested answer to a creator's question and store it as a pending
 * reply draft for the operator to edit and send. Never sends anything.
 * Returns the draft body, or null when AI is unavailable or fails.
 */
export async function createSuggestedReply(params: {
  campaignCreatorId: string;
  creatorFirstName: string | null;
  inboundBody: string;
  inboundSubject: string | null;
  /** When the reply being answered arrived; used to avoid drafting it twice. */
  inboundAt: Date;
  /** The brand's earlier emails in this thread, oldest first, so the answer doesn't repeat them. */
  earlierOutbound: string[];
}): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;

  // AI answers only for brands that have told us their product facts.
  const owner = await prisma.campaignCreator.findUnique({
    where: { id: params.campaignCreatorId },
    select: { campaign: { select: { brandId: true } } },
  });
  const kit = owner ? await getBrandKit(owner.campaign.brandId) : null;
  if (!kit?.productFacts) return null;

  const alreadyDrafted = async () =>
    prisma.aIDraft.findFirst({
      where: {
        campaignCreatorId: params.campaignCreatorId,
        type: "reply",
        status: { not: "discarded" },
        createdAt: { gte: params.inboundAt },
      },
      select: { id: true },
    });
  if (await alreadyDrafted()) return null;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt(kit) },
        {
          role: "user",
          content: [
            `Creator's first name: ${params.creatorFirstName ?? "unknown"}`,
            params.earlierOutbound.length > 0
              ? `${kit.senderFirstName}'s earlier emails in this conversation (already sent, don't repeat):\n${params.earlierOutbound
                  .map((b, i) => `--- Email ${i + 1} ---\n${b.slice(0, 1500)}`)
                  .join("\n")}`
              : "",
            `Their reply:\n${params.inboundBody.slice(0, 2000)}`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    });
    // Creator emails never use em or en dashes; the model sometimes does anyway.
    const body = response.choices[0]?.message?.content
      ?.replace(/\s*[\u2014\u2013]\s*/g, ", ")
      .trim();
    if (!body) return null;

    // Another sync may have drafted this reply while the model was writing.
    if (await alreadyDrafted()) return null;

    await prisma.aIDraft.create({
      data: {
        type: "reply",
        status: "draft",
        subject: params.inboundSubject
          ? `Re: ${params.inboundSubject.replace(/^re:\s*/i, "")}`
          : null,
        body,
        campaignCreatorId: params.campaignCreatorId,
      },
    });
    return body;
  } catch (error) {
    log("warn", "inbox.suggest_reply_failed", {
      campaignCreatorId: params.campaignCreatorId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
