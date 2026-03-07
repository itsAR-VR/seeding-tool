import { prisma } from "@/lib/prisma";

export type InboundMessagePayload = {
  externalMessageId: string;
  fromAddress: string;
  toAddress: string;
  subject?: string;
  body: string;
  bodyHtml?: string;
  receivedAt?: Date;
};

/**
 * Normalize a raw inbound message into a standard payload.
 * Strips quoted text patterns for cleaner classification.
 */
export function normalizeInboundMessage(raw: {
  id: string;
  from: string;
  to: string;
  subject?: string;
  body?: string;
  bodyHtml?: string;
  internalDate?: string;
}): InboundMessagePayload {
  let body = raw.body ?? "";

  // Strip common quoted text patterns
  body = body
    .replace(/On .+ wrote:\s*$/gm, "")
    .replace(/^>.*$/gm, "")
    .replace(/--\s*\nSent from .+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    externalMessageId: raw.id,
    fromAddress: raw.from,
    toAddress: raw.to,
    subject: raw.subject,
    body,
    bodyHtml: raw.bodyHtml,
    receivedAt: raw.internalDate
      ? new Date(parseInt(raw.internalDate))
      : undefined,
  };
}

/**
 * Persist a message to a thread.
 * // INVARIANT: Message dedupe on externalId prevents replay duplicates.
 * Uses externalMessageId as the dedupe key — calling this twice with the
 * same externalMessageId will return the existing message without creating
 * a duplicate.
 */
export async function persistMessage(
  threadId: string,
  payload: InboundMessagePayload & {
    direction: "inbound" | "outbound";
    classification?: string;
    confidence?: number;
  }
) {
  // INVARIANT: Message dedupe on externalId prevents replay duplicates.
  if (payload.externalMessageId) {
    const existing = await prisma.message.findUnique({
      where: { externalMessageId: payload.externalMessageId },
    });
    if (existing) {
      return { message: existing, created: false };
    }
  }

  const message = await prisma.message.create({
    data: {
      threadId,
      direction: payload.direction,
      channel: "email",
      fromAddress: payload.fromAddress,
      toAddress: payload.toAddress,
      subject: payload.subject,
      body: payload.body,
      bodyHtml: payload.bodyHtml,
      externalMessageId: payload.externalMessageId,
      classification: payload.classification,
      confidence: payload.confidence,
    },
  });

  // Update thread timestamp
  await prisma.conversationThread.update({
    where: { id: threadId },
    data: { updatedAt: new Date() },
  });

  return { message, created: true };
}
