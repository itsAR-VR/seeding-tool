import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { fetchNewMessages, resolveThreadByExternalId } from "@/lib/gmail/ingest";
import { normalizeInboundMessage, persistMessage } from "@/lib/inbox/messages";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";
import { classifyReply } from "@/lib/inbox/ai";
import { aiLabelingEnabled } from "@/lib/inbox/decision";
import { createSuggestedReply } from "@/lib/inbox/suggest-reply";
import { isClearOptOut, isStoredOptOut, OPT_OUT_CLASSIFICATION, type ReplyGuess } from "@/lib/inbox/opt-out";
import { addSuppression } from "@/lib/compliance/suppression";
import {
  AUTO_DIRECTION,
  AUTO_REPLY_CLASSIFICATION,
  BOUNCE_CLASSIFICATION,
  HUMAN_REPLY_CLASSIFICATION,
  bouncedAddresses,
  isAutoReply,
  isBounce,
} from "@/lib/inbox/auto-messages";

/** How far back each sync looks for creator replies. */
const SYNC_QUERY = "in:inbox newer_than:7d";

/** Lifecycle states a first reply should move forward to "replied". */
const PRE_REPLY_STATES = new Set(["ready", "outreach_sent"]);

/**
 * A reply that plainly asks to stop being emailed is handled for the operator:
 * marked "no", the address goes on this brand's do-not-send list, and any
 * drafted reply is thrown away. The thread's "They said yes" undoes it.
 */
async function handleOptOut(input: {
  brandId: string;
  messageId: string;
  threadId: string;
  campaignCreatorId: string;
  email: string | null;
  confidence: number;
}): Promise<void> {
  const now = new Date();
  await prisma.message.update({
    where: { id: input.messageId },
    data: { classification: OPT_OUT_CLASSIFICATION, confidence: Math.max(input.confidence, 0.95) },
  });
  await prisma.campaignCreator.update({
    where: { id: input.campaignCreatorId },
    // aiSuggestion stays empty: nobody decided, so it doesn't count toward AI accuracy.
    data: { replyDecision: "no", replyDecidedAt: now, lifecycleStatus: "opted_out" },
  });
  await prisma.conversationThread.update({
    where: { id: input.threadId },
    data: { status: "closed" },
  });
  await prisma.aIDraft.updateMany({
    where: { campaignCreatorId: input.campaignCreatorId, status: { in: ["draft", "approved"] } },
    data: { status: "discarded" },
  });
  if (input.email) await addSuppression(input.email, "REPLY_OPTOUT", input.brandId);
  log("info", "gmail.sync.opt_out_handled", {
    brandId: input.brandId,
    campaignCreatorId: input.campaignCreatorId,
  });
}

type RawMail = Awaited<ReturnType<typeof fetchNewMessages>>[number];

/**
 * A bounce: the address didn't work. Each creator we emailed there is marked
 * "Email bounced" (next step: find another email), the bounce is kept on their
 * conversation, unsent drafts are dropped, and the address goes on the
 * do-not-send list so nothing else is sent to it.
 */
async function handleBounce(brandId: string, raw: RawMail): Promise<boolean> {
  const addresses = bouncedAddresses(raw);
  if (addresses.length === 0) return false;
  const matches = await prisma.campaignCreator.findMany({
    where: {
      campaign: { brandId },
      lifecycleStatus: { notIn: ["ready", "bounced"] },
      creator: { OR: addresses.map((a) => ({ email: { equals: a, mode: "insensitive" as const } })) },
    },
    select: {
      id: true,
      creator: { select: { email: true } },
      conversationThread: { select: { id: true } },
    },
  });
  if (matches.length === 0) return false;

  let stored = false;
  for (const cc of matches) {
    if (cc.creator.email) await addSuppression(cc.creator.email, "BOUNCE", brandId);
    // addSuppression marks them opted out; "bounced" is the truer word and has its own next step.
    await prisma.campaignCreator.update({ where: { id: cc.id }, data: { lifecycleStatus: "bounced" } });
    await prisma.aIDraft.updateMany({
      where: { campaignCreatorId: cc.id, status: { in: ["draft", "approved"] } },
      data: { status: "discarded" },
    });
    if (!stored && cc.conversationThread) {
      await persistMessage(cc.conversationThread.id, {
        ...normalizeInboundMessage(raw),
        direction: AUTO_DIRECTION,
        classification: BOUNCE_CLASSIFICATION,
      });
      stored = true;
    }
  }
  log("info", "gmail.sync.bounce_handled", { brandId, creators: matches.length });
  return true;
}

/** Our latest email in a thread before a given time, for "came back within minutes". */
async function msSinceOurEmail(threadId: string, at: Date): Promise<number | null> {
  const ours = await prisma.message.findFirst({
    where: { threadId, direction: "outbound", createdAt: { lte: at } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return ours ? at.getTime() - ours.createdAt.getTime() : null;
}

/**
 * Auto-replies stored as real replies before detection existed (like a
 * "thanks for your email, I'll get back to you" sent the same minute) are
 * moved out of "Needs your answer". Stored mail has no headers and its
 * createdAt is when the sync saw it, so the window is wider than for new mail.
 */
export async function backfillAutoReplies(brandId: string): Promise<number> {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const candidates = await prisma.message.findMany({
    where: {
      direction: "inbound",
      createdAt: { gte: since },
      thread: { brandId },
      // Spelled out so unlabeled (null) messages are still checked.
      OR: [{ classification: null }, { classification: { not: HUMAN_REPLY_CLASSIFICATION } }],
    },
    select: {
      id: true,
      threadId: true,
      fromAddress: true,
      subject: true,
      body: true,
      createdAt: true,
      thread: { select: { campaignCreatorId: true, campaignCreator: { select: { replyDecision: true } } } },
    },
    take: 200,
  });
  let moved = 0;
  for (const m of candidates) {
    if (m.thread.campaignCreator.replyDecision) continue; // someone already decided; leave it be
    const sinceOurs = await msSinceOurEmail(m.threadId, m.createdAt);
    const auto = isAutoReply(
      { from: m.fromAddress ?? "", subject: m.subject ?? "", body: m.body },
      { sinceOurEmailMs: sinceOurs, withinMs: 20 * 60 * 1000 },
    );
    if (!auto) continue;
    await markAutoReply(m.id, m.threadId, m.thread.campaignCreatorId, m.createdAt);
    moved++;
  }
  return moved;
}

/**
 * Store a message as an auto-reply and undo what treating it as a reply did:
 * the suggested answer drafted for it, and "replied" when it was their only message.
 */
async function markAutoReply(messageId: string, threadId: string, campaignCreatorId: string, at: Date) {
  await prisma.message.update({
    where: { id: messageId },
    data: { direction: AUTO_DIRECTION, classification: AUTO_REPLY_CLASSIFICATION },
  });
  await prisma.aIDraft.updateMany({
    where: { campaignCreatorId, type: "reply", status: "draft", createdAt: { gte: at } },
    data: { status: "discarded" },
  });
  const realReplies = await prisma.message.count({ where: { threadId, direction: "inbound" } });
  if (realReplies === 0) {
    await prisma.campaignCreator.updateMany({
      where: { id: campaignCreatorId, lifecycleStatus: "replied" },
      data: { lifecycleStatus: "outreach_sent", lastReplyAt: null },
    });
  }
}

function bareAddress(header: string): string {
  const match = header.match(/<([^>]+)>/);
  return (match ? match[1] : header).trim().toLowerCase();
}

/**
 * Replies that arrived before opt-outs were handled automatically still sit in
 * "Needs your answer". Apply the same conservative rule to undecided email
 * threads whose latest message is the creator asking to be removed. Safe to
 * run every sync: once handled, a thread has a decision and is skipped.
 */
export async function backfillOptOuts(brandId: string): Promise<number> {
  const threads = await prisma.conversationThread.findMany({
    where: { brandId, channel: "email", campaignCreator: { replyDecision: null } },
    select: {
      id: true,
      campaignCreatorId: true,
      campaignCreator: { select: { creator: { select: { email: true } } } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, direction: true, body: true, classification: true, confidence: true, fromAddress: true },
      },
    },
  });

  let handled = 0;
  for (const thread of threads) {
    const latest = thread.messages[0];
    if (!latest || !isStoredOptOut(latest)) continue;
    try {
      await handleOptOut({
        brandId,
        messageId: latest.id,
        threadId: thread.id,
        campaignCreatorId: thread.campaignCreatorId,
        email:
          thread.campaignCreator.creator.email?.toLowerCase().trim() ||
          (latest.fromAddress ? bareAddress(latest.fromAddress) : null),
        confidence: latest.confidence ?? 0,
      });
      handled++;
    } catch (error) {
      log("error", "gmail.sync.opt_out_backfill_failed", {
        messageId: latest.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return handled;
}

/**
 * Pull recent replies from every connected Gmail inbox of a brand and attach
 * them to the outreach threads they answer. Pull-based, so it works without a
 * Gmail push (Pub/Sub) subscription. Replies are recorded and the creator is
 * marked "replied". Nothing is sent. A reply that clearly asks to be removed
 * is marked "no" and suppressed automatically; everything else waits for the
 * operator.
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

      // A bounce arrives in its own thread from the mail server, so match it by address.
      if (isBounce(raw)) {
        try {
          if (await handleBounce(brandId, raw)) processed++;
        } catch (error) {
          log("error", "gmail.sync.bounce_failed", {
            brandId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        continue;
      }

      const thread = await resolveThreadByExternalId(raw.threadId);
      if (!thread || thread.brandId !== brandId) continue;

      const arrivedAt = raw.internalDate ? new Date(parseInt(raw.internalDate)) : new Date();
      const auto = isAutoReply(raw, { sinceOurEmailMs: await msSinceOurEmail(thread.id, arrivedAt) });

      // INVARIANT: Message dedupe on externalId prevents replay duplicates.
      const { message, created } = await persistMessage(thread.id, {
        ...normalizeInboundMessage(raw),
        direction: auto ? AUTO_DIRECTION : "inbound",
        ...(auto ? { classification: AUTO_REPLY_CLASSIFICATION } : {}),
      });
      if (!created) continue;
      // Kept on the conversation, but it isn't a reply: no "replied", no answer needed.
      if (auto) {
        processed++;
        continue;
      }

      // AI guess only (shown next to the operator's yes/no buttons); it never
      // acts on its own. The one exception is a clear opt-out, handled below.
      let guess: ReplyGuess = null;
      if (aiLabelingEnabled()) {
        try {
          guess = await classifyReply(
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

      if (thread.campaignCreator.replyDecision !== "no" && isClearOptOut(message.body, guess)) {
        try {
          await handleOptOut({
            brandId,
            messageId: message.id,
            threadId: thread.id,
            campaignCreatorId: thread.campaignCreatorId,
            email: thread.campaignCreator.creator.email?.toLowerCase().trim() || bareAddress(raw.from),
            confidence: guess?.confidence ?? 0,
          });
        } catch (error) {
          // Leave it in "Needs your answer" rather than half-handled silently.
          log("error", "gmail.sync.opt_out_failed", {
            messageId: message.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
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

  // Auto-replies saved as replies before detection existed.
  try {
    await backfillAutoReplies(brandId);
  } catch (error) {
    log("error", "gmail.sync.auto_reply_backfill_failed", {
      brandId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Older "take me off your list" replies get the same automatic handling.
  try {
    await backfillOptOuts(brandId);
  } catch (error) {
    log("error", "gmail.sync.opt_out_backfill_failed", {
      brandId,
      error: error instanceof Error ? error.message : String(error),
    });
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
          status: { not: "discarded" },
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
        inboundAt: latest.createdAt,
        earlierOutbound: thread.messages
          .filter((m) => m.direction === "outbound")
          .reverse()
          .map((m) => m.body),
      });
    }
  }

  return { processed, inboxes: aliases.length, errors };
}
