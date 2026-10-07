import { prisma } from "@/lib/prisma";

/** How many of a brand's latest real replies the AI sees as examples. */
export const LEARNED_EXAMPLES_IN_PROMPT = 6;

/**
 * Remember an answer the brand sent to a creator's question, so future
 * suggested replies sound like them. Skips when there's no question to pair it
 * with or the reply is too short to teach anything.
 */
export async function learnFromSentReply(params: { brandId: string; threadId: string; answer: string }) {
  const answer = params.answer.trim();
  if (answer.length < 20) return;

  // The creator message this reply answers: the newest inbound one.
  const question = await prisma.message.findFirst({
    where: { threadId: params.threadId, direction: "inbound" },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  const text = question?.body?.trim();
  if (!text) return;

  await prisma.learnedReply.create({
    data: { brandId: params.brandId, question: text.slice(0, 1500), answer: answer.slice(0, 2000) },
  });
}

/** The brand's latest real replies, formatted as prompt examples (newest first). */
export async function learnedExamplesFor(brandId: string): Promise<string> {
  const rows = await prisma.learnedReply.findMany({
    where: { brandId },
    orderBy: { createdAt: "desc" },
    take: LEARNED_EXAMPLES_IN_PROMPT,
    select: { question: true, answer: true },
  });
  return rows
    .map((r) => `Their reply: ${r.question.slice(0, 600)}\nWhat was actually sent:\n${r.answer}`)
    .join("\n\n");
}
