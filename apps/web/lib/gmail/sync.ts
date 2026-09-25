import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { fetchNewMessages, resolveThreadByExternalId } from "@/lib/gmail/ingest";
import { normalizeInboundMessage, persistMessage } from "@/lib/inbox/messages";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";
import { classifyReply } from "@/lib/inbox/ai";
import { aiLabelingEnabled } from "@/lib/inbox/decision";
import { createSuggestedReply } from "@/lib/inbox/suggest-reply";

/** How far back each sync looks for creator replies. */
const SYNC_QUERY = "in:inbox newer_than:7d";

/** Lifecycle states a first reply should move forward to "replied". */
const PRE_REPLY_STATES = new Set(["ready", "outreach_sent"]);

function bareAddress(header: string): string {
  const match = header.match(/<([^>]+)>/);
  return (match ? match[1] : header).trim().toLowerCase();
}

/**
 * Pull recent replies from every connected Gmail inbox of a brand and attach
 * them to the outreach threads they answer. Pull-based, so it works without a
 * Gmail push (Pub/Sub) subscription. Replies are recorded and the creator is
 * marked "replied"; nothing is sent or classified here.
 */
export async function syncRepliesForBrand(
  brandId: string
): Promise<{ processed: number; inboxes: number; errors: string[] }> {
  const aliases = await prisma.emailAlias.findMany({
    where: { brandId, encryptedRefreshToken: { not: null } },
    select: { address: true },
  });

  let processed = 0;
  const errors: string[] = [];

  for (const alias of aliases) {
    let raws: Awaited<ReturnType<typeof fetchNewMessages>>;
    try {
      raws = await fetchNewMessages(brandId, alias.address, SYNC_QUERY);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("error", "gmail.sync.fetch_failed", { brandId, address: alias.address, error: message });
      errors.push(`${alias.address}: ${message}`);
      continue;
    }

    for (const raw of raws) {
      if (bareAddress(raw.from) === alias.address.toLowerCase()) continue;

      const thread = await resolveThreadByExternalId(raw.threadId);
      if (!thread || thread.brandId !== brandId) continue;

      // INVARIANT: Message dedupe on externalId prevents replay duplicates.
      const { message, created } = await persistMessage(thread.id, {
        ...normalizeInboundMessage(raw),
        direction: "inbound",
      });
      if (!created) continue;

      // AI guess only (shown next to the operator's yes/no buttons); it never acts.
      if (aiLabelingEnabled()) {
        try {
          const guess = await classifyReply(
            { body: message.body, subject: message.subject },
            brandId,
            thread.campaignCreatorId
          );
          // Confidence 0 means the AI call failed (no credit, outage); leave it
          // unlabeled so the next sync retries instead of storing a fake guess.
          if (guess.confidence > 0) {
            await prisma.message.update({
              where: { id: message.id },
              data: { classification: guess.intent, confidence: guess.confidence },
            });
          }
        } catch (error) {
          log("warn", "gmail.sync.classify_failed", {
            messageId: message.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const receivedAt = raw.internalDate ? new Date(parseInt(raw.internalDate)) : new Date();
      await prisma.conversationThread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });

      if (PRE_REPLY_STATES.has(thread.campaignCreator.lifecycleStatus)) {
        await prisma.campaignCreator.update({
          where: { id: thread.campaignCreatorId },
          data: { lifecycleStatus: "replied", lastReplyAt: receivedAt },
        });
        await recordOutcomeEvent({
          campaignCreatorId: thread.campaignCreatorId,
          event: { type: "reply_received", replyType: "unclassified" },
        });
      } else {
        await prisma.campaignCreator.update({
          where: { id: thread.campaignCreatorId },
          data: { lastReplyAt: receivedAt },
        });
      }
      processed++;
    }
  }

  // Label earlier replies that arrived before AI labeling was switched on.
  if (aiLabelingEnabled()) {
    const unlabeled = await prisma.message.findMany({
      where: { direction: "inbound", classification: null, thread: { brandId } },
      select: { id: true, body: true, subject: true, thread: { select: { campaignCreatorId: true } } },
      take: 20,
    });
    for (const message of unlabeled) {
      try {
        const guess = await classifyReply(
          { body: message.body, subject: message.subject },
          brandId,
          message.thread.campaignCreatorId
        );
        if (guess.confidence > 0) {
          await prisma.message.update({
            where: { id: message.id },
            data: { classification: guess.intent, confidence: guess.confidence },
          });
        }
      } catch (error) {
        log("warn", "gmail.sync.backfill_classify_failed", {
          messageId: message.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Draft a suggested answer for any open conversation whose latest reply is a
  // question and that has no suggestion yet. The operator edits and sends it.
  if (aiLabelingEnabled()) {
    const threads = await prisma.conversationThread.findMany({
      where: { brandId, status: "open", channel: "email" },
      select: {
        campaignCreatorId: true,
        campaignCreator: {
          select: { replyDecision: true, creator: { select: { name: true } } },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { direction: true, classification: true, body: true, subject: true, createdAt: true },
        },
      },
    });
    for (const thread of threads) {
      const latest = thread.messages[0];
      if (!latest || latest.direction !== "inbound" || latest.classification !== "question") continue;
      if (thread.campaignCreator.replyDecision === "no") continue;
      const existing = await prisma.aIDraft.findFirst({
        where: {
          campaignCreatorId: thread.campaignCreatorId,
          type: "reply",
          createdAt: { gte: latest.createdAt },
        },
        select: { id: true },
      });
      if (existing) continue;
      await createSuggestedReply({
        campaignCreatorId: thread.campaignCreatorId,
        creatorFirstName: thread.campaignCreator.creator.name?.split(" ")[0] ?? null,
        inboundBody: latest.body,
        inboundSubject: latest.subject,
        earlierOutbound: thread.messages
          .filter((m) => m.direction === "outbound")
          .reverse()
          .map((m) => m.body),
      });
    }
  }

  return { processed, inboxes: aliases.length, errors };
}
