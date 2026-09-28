import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { AI_MODEL } from "@/lib/ai/config";
import { ADDRESS_LINK_PLACEHOLDER } from "@/lib/gift-claims/issue";

/**
 * Facts the suggested answer may use. Anything outside these is left for the
 * operator with a bracketed note instead of being guessed.
 */
const KALM_FACTS = `- The gift is Kalm mouth tape (a 30-strip pack). It is completely free: Kalm pays for the product and the shipping. No card or payment is ever needed.
- Kalm's mouth tape helps you breathe through your nose while you sleep, so you sleep deeper and wake up more rested.
- How to use it: at bedtime, place one strip over closed lips.
- Website: sleepkalm.com
- To get one, they add their shipping address at a private link. Write the link exactly as ${ADDRESS_LINK_PLACEHOLDER} and never invent a URL.`;

const SYSTEM_PROMPT = `You draft short email replies for Kam, founder of Kalm, a women's wellness brand. A creator was offered a free box of Kalm mouth tape and wrote back.

Facts you may use:
${KALM_FACTS}

Rules:
- Write as Kam, in first person ("I"), like a quick personal email she typed on her phone. Not "we".
- If they asked a yes/no question, answer it in the first word or two ("Nope," / "Yes,").
- Answer only what they asked, using only the facts above. Never repeat what Kam's earlier emails in this conversation already said.
- "How does this work" means the gifting: they add their address at the link and Kam sends it, free, shipping covered. Only explain how to use the tape if they ask how to use it.
- If they ask about posting, paid partnerships, rates, ingredients, medical or safety topics, or anything not covered by the facts, do not guess. Write one line exactly like: [Kam to answer: <their question>]
- 1 to 3 short sentences. Put the link inside the last sentence, for example: Add your address here and I'll send it out: ${ADDRESS_LINK_PLACEHOLDER}
  Leave the link out only if they clearly said no.
- Sound human, not like AI or marketing: no "super easy", "totally", "absolutely", "feel free", "don't hesitate", "I'd be happy to", "hope this helps", "great question", exclamation stacks, em dashes, semicolons, bullet points, or a sign-off/name at the end.
- Output only the email body.

Example
Their reply: how does this work and do I have to pay shipping?
Good answer:
Nope, it's free and I cover shipping. Add your address here and I'll send it out: ${ADDRESS_LINK_PLACEHOLDER}`;

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
  /** Kam's earlier emails in this thread, oldest first, so the answer doesn't repeat them. */
  earlierOutbound: string[];
}): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            `Creator's first name: ${params.creatorFirstName ?? "unknown"}`,
            params.earlierOutbound.length > 0
              ? `Kam's earlier emails in this conversation (already sent, don't repeat):\n${params.earlierOutbound
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
    // Kam never uses em or en dashes; the model sometimes does anyway.
    const body = response.choices[0]?.message?.content
      ?.replace(/\s*[\u2014\u2013]\s*/g, ", ")
      .trim();
    if (!body) return null;

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
