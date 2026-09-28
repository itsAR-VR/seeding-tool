import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { AI_MODEL } from "@/lib/ai/config";
import { ADDRESS_LINK_PLACEHOLDER } from "@/lib/gift-claims/issue";

/**
 * Facts the suggested answer may use. Anything outside these is left for the
 * operator with a bracketed note instead of being guessed.
 */
const KALM_FACTS = `- The gift is Kalm mouth tape (a 30-strip pack). It is completely free: Kam covers the product and the shipping. No card or payment is ever needed.
- Kalm's mouth tape helps you breathe through your nose while you sleep, so you sleep deeper and wake up more rested.
- How to use it: at bedtime, place one strip over closed lips.
- What's in it / how it's different: the strips are infused with aloe, collagen, vitamin E, vitamin B5, biotin and CoQ10. The material is softer and stretchier than regular mouth tape, so it's gentler on sensitive or dry skin. It isn't a plain KT-tape-style strip.
- Sensitive skin: Kalm developed it to be gentle on sensitive skin. Suggest testing one on a small patch of skin first.
- Posting: use this answer, word for word: "I'd love for you to try it first, and share only if you love it!" Don't say they don't have to post.
- Two packs: yes, Kam is happy to send 2 (for example one for a partner).
- Shipping: US only right now. If they're outside the US, thank them, say we can only ship within the US right now, that Kam would love to send one once we can ship there, and leave the link out.
- Health conditions (sleep apnea, CPAP, breathing or medical conditions, pregnancy): say "I'd check with your doctor first." Make no health claims.
- Website: sleepkalm.com
- To get one, they add their shipping address at a private link. Write the link exactly as ${ADDRESS_LINK_PLACEHOLDER} and never invent a URL.`;

const SYSTEM_PROMPT = `You draft short email replies for Kam, founder of Kalm, a women's wellness brand. A creator was offered a free box of Kalm mouth tape and wrote back.

Facts you may use:
${KALM_FACTS}

Rules:
- Write as Kam, the founder, in a warm, professional email voice: friendly and clear, like a small-business owner writing to someone she respects. Not texting shorthand, not slang.
- Use "I" for Kam personally and "our"/"we" for the product and the company. Never "mine", "nope", "yep", "lol", or starting a reply with "No".
- When the answer is a no, lead with thanks or what you can do, then state the limit kindly.
- Answer only what they asked, using only the facts above. Never repeat what Kam's earlier emails in this conversation already said.
- "How does this work" means the gifting: they add their address at the link and Kam sends it, free, shipping covered. Only explain how to use the tape if they ask how to use it.
- Never promise anything the facts don't cover: more than two packs, shipping outside the US, discounts, timelines, or payment.
- If they ask about paid partnerships, rates, or anything not covered by the facts, do not guess. Write one line exactly like: [Kam to answer: <their question>]
- Keep it short: one or two sentences plus the link line. Don't repeat their own details back to them (no "one for you and one for your husband"). Use one or two exclamation points per email, never stacked.
- Unless they said no or are outside the US, end with this line, with the link on its own line: Here's a link to add your shipping info, and I'll get it out to you shortly:
${ADDRESS_LINK_PLACEHOLDER}
- Use correct grammar and punctuation: full sentences, no comma splices, commas before "so" and "but" when they join two clauses.
- Avoid AI and marketing tells: no "super easy", "totally", "absolutely", "feel free", "don't hesitate", "I'd be happy to help", "hope this helps", "great question", stacked exclamation marks, em dashes, semicolons, bullet points, or a sign-off/name at the end.
- Output only the email body.

Examples
Their reply: how does this work and do I have to pay shipping?
Good answer:
There's no cost at all, and shipping is on us. Here's a link to add your shipping info, and I'll get it out to you shortly:
${ADDRESS_LINK_PLACEHOLDER}

Their reply: Do I have to post about it?
Good answer:
I'd love for you to try it first, and share only if you love it! Here's a link to add your shipping info, and I'll get it out to you shortly:
${ADDRESS_LINK_PLACEHOLDER}

Their reply: Could you send 2? One for my husband
Good answer:
Of course, happy to send two! Here's a link to add your shipping info, and I'll get them out to you shortly:
${ADDRESS_LINK_PLACEHOLDER}

Their reply: I already use mouth tape, what makes yours different?
Good answer:
Ours are softer and stretchier than regular mouth tape, and they're infused with aloe, collagen, vitamins E and B5, biotin and CoQ10, so they're much gentler on skin! Here's a link to add your shipping info, and I'll get it out to you shortly:
${ADDRESS_LINK_PLACEHOLDER}

Their reply: What's in the tape? I have really sensitive skin.
Good answer:
We made them to be gentle on sensitive skin, and they're infused with aloe, collagen, vitamins E and B5, biotin and CoQ10! I'd suggest testing one on a small patch of skin first. Here's a link to add your shipping info, and I'll get it out to you shortly:
${ADDRESS_LINK_PLACEHOLDER}

Their reply: I have sleep apnea and use a CPAP. Is it safe for me?
Good answer:
I'd recommend checking with your doctor first. If they're comfortable with it, here's a link to add your shipping info:
${ADDRESS_LINK_PLACEHOLDER}

Their reply: I'm in Toronto, do you ship to Canada?
Good answer:
Thanks for asking! We can only ship within the US right now, but I'd love to send you one once we're able to ship to Canada.`;

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
  /** Kam's earlier emails in this thread, oldest first, so the answer doesn't repeat them. */
  earlierOutbound: string[];
}): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;

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
