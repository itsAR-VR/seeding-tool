import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { fetchNewMessages, resolveThreadByExternalId } from "@/lib/gmail/ingest";
import { normalizeInboundMessage, persistMessage } from "@/lib/inbox/messages";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";
import { classifyReply } from "@/lib/inbox/ai";
import { aiLabelingEnabled } from "@/lib/inbox/decision";

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
          await prisma.message.update({
            where: { id: message.id },
            data: { classification: guess.intent, confidence: guess.confidence },
          });
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

  return { processed, inboxes: aliases.length, errors };
}
