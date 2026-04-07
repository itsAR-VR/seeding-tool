/**
 * Multi-channel outreach send pipeline.
 *
 * Routes drafted outreach messages to the appropriate channel:
 * - email → Gmail API (via lib/gmail/send.ts)
 * - instagram_dm → Unipile API (via lib/unipile/send-dm.ts)
 *
 * INVARIANT: AI drafts are NEVER auto-sent. This pipeline fires
 * only on explicit human action (Send button click).
 *
 * SAFETY INVARIANTS (enforced in this pipeline):
 * 1. Creator is ALWAYS loaded via the validated CampaignCreator record —
 *    never via the untrusted draft.creatorId alone (RC-3).
 * 2. draft.creatorId must match CampaignCreator.creatorId in DB (RC-4).
 * 3. ConversationThread existence is checked BEFORE any send (RC-2 idempotency).
 * 4. Exact handle verification is enforced inside sendInstagramDM (RC-1).
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail/send";
import { getUnipileClient } from "@/lib/unipile/client";
import { sendInstagramDM } from "@/lib/unipile/send-dm";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";
import { DailyLimitExceededError } from "@/lib/outreach/errors";

export type DraftToSend = {
  campaignCreatorId: string;
  creatorId: string;
  channel: "email" | "instagram_dm";
  subject?: string;
  body: string;
};

export type SendResult = {
  campaignCreatorId: string;
  creatorId: string;
  channel: string;
  status: "sent" | "failed" | "no_contact_info" | "skipped" | "daily_limit_reached";
  error?: string;
};

const DELAY_BETWEEN_SENDS_MS = 1_000;

/**
 * Send a batch of outreach messages across channels.
 *
 * - Creates ConversationThread + Message records for tracking
 * - Updates CampaignCreator lifecycle to outreach_sent
 * - Respects rate limits with inter-send delays
 */
export async function sendOutreachBatch(
  drafts: DraftToSend[],
  brandId: string
): Promise<SendResult[]> {
  const results: SendResult[] = [];

  // Pre-load shared resources
  let unipileClient: Awaited<ReturnType<typeof getUnipileClient>> | null = null;
  let unipileAccountId = "";

  const hasAnyDM = drafts.some((d) => d.channel === "instagram_dm");
  if (hasAnyDM) {
    try {
      unipileClient = await getUnipileClient(brandId);
      unipileAccountId = unipileClient.accountId;
    } catch {
      // Will mark DM drafts as failed below
    }
  }

  // Find email alias for the brand (for Gmail sends)
  let emailAliasId: string | null = null;
  let fromAddress: string | null = null;
  const hasAnyEmail = drafts.some((d) => d.channel === "email");
  if (hasAnyEmail) {
    const alias = await prisma.emailAlias.findFirst({
      where: { brandId, isPrimary: true, isPaused: false },
      orderBy: { updatedAt: "desc" },
    });
    if (alias) {
      emailAliasId = alias.id;
      fromAddress = alias.address;
    }
  }

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];

    // Rate limit: delay between sends (skip first)
    if (i > 0) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_SENDS_MS));
    }

    // ── Load CampaignCreator + creator via validated DB relationship (RC-3 fix) ──
    // We load the creator THROUGH the CampaignCreator record that was already
    // validated to belong to this brand. This means draft.creatorId is only used
    // to cross-check identity — it never drives the actual recipient lookup.
    const campaignCreator = await prisma.campaignCreator.findUnique({
      where: { id: draft.campaignCreatorId },
      select: {
        id: true,
        creatorId: true,
        creator: {
          select: {
            id: true,
            email: true,
            instagramHandle: true,
            name: true,
          },
        },
        conversationThread: {
          select: { id: true, unipileChatId: true, channel: true },
        },
      },
    });

    if (!campaignCreator) {
      results.push({
        ...draft,
        status: "failed",
        error: "CampaignCreator not found",
      });
      continue;
    }

    // ── RC-4: Verify draft.creatorId matches canonical CC.creatorId ──────────
    // Prevents body→creator mismatch when the client submits mis-paired tuples.
    if (campaignCreator.creatorId !== draft.creatorId) {
      console.warn(
        `[send-pipeline] creatorId mismatch: draft says ${draft.creatorId} but CC ${draft.campaignCreatorId} owns creatorId ${campaignCreator.creatorId}. Rejecting.`
      );
      results.push({
        ...draft,
        status: "failed",
        error: `Identity mismatch: draft.creatorId (${draft.creatorId}) does not match CampaignCreator.creatorId (${campaignCreator.creatorId}). Send aborted.`,
      });
      continue;
    }

    // ── RC-2: Idempotency — check thread + outbound message ────────────────
    // Thread exists AND has outbound message → already sent → skip.
    // Thread exists but NO outbound message → prior attempt failed before
    //   sending → delete the empty thread and retry.
    // No thread → new send.
    if (campaignCreator.conversationThread) {
      const existingThread = campaignCreator.conversationThread;
      const hasOutboundMessage = await prisma.message.findFirst({
        where: { threadId: existingThread.id, direction: "outbound" },
        select: { id: true },
      });

      if (hasOutboundMessage) {
        results.push({
          ...draft,
          status: "skipped",
          error: `Already messaged: ConversationThread ${existingThread.id} already has an outbound message. Skipping to prevent duplicate send.`,
        });
        continue;
      }

      // Empty thread from a failed prior attempt — clean up so we can retry
      await prisma.conversationThread.delete({
        where: { id: existingThread.id },
      });
    }

    const creator = campaignCreator.creator;

    if (draft.channel === "email") {
      // --- Email channel ---
      if (!creator.email) {
        results.push({
          ...draft,
          status: "no_contact_info",
          error: "Creator has no email address",
        });
        continue;
      }

      if (!emailAliasId || !fromAddress) {
        results.push({
          ...draft,
          status: "failed",
          error: "No email alias configured. Connect Gmail in Settings.",
        });
        continue;
      }

      try {
        // Create thread BEFORE send — the unique campaignCreatorId constraint
        // acts as the idempotency guard against concurrent duplicate sends.
        const thread = await prisma.conversationThread.create({
          data: {
            brandId,
            campaignCreatorId: draft.campaignCreatorId,
            channel: "email",
            status: "open",
          },
        });

        // Send via Gmail
        const emailResult = await sendEmail({
          aliasId: emailAliasId,
          to: creator.email,
          subject: draft.subject || "Collaboration opportunity",
          body: draft.body,
        });

        // Store gmailThreadId on the ConversationThread for reply ingestion
        if (emailResult.gmailThreadId) {
          await prisma.conversationThread.update({
            where: { id: thread.id },
            data: { externalThreadId: emailResult.gmailThreadId },
          });
        }

        // Persist outbound message linked to the thread
        await prisma.message.create({
          data: {
            threadId: thread.id,
            direction: "outbound",
            channel: "email",
            fromAddress: fromAddress!,
            toAddress: creator.email,
            subject: draft.subject || "Collaboration opportunity",
            body: draft.body,
          },
        });

        // Update lifecycle
        await prisma.campaignCreator.update({
          where: { id: draft.campaignCreatorId },
          data: {
            lifecycleStatus: "outreach_sent",
            outreachCount: { increment: 1 },
            lastOutreachAt: new Date(),
          },
        });
        await recordOutcomeEvent({
          campaignCreatorId: draft.campaignCreatorId,
          event: { type: "outreach_sent", method: "email" },
        });

        // Activity log
        await prisma.activityLog.create({
          data: {
            action: "outreach.sent",
            entityType: "CampaignCreator",
            entityId: draft.campaignCreatorId,
            brandId,
            metadata: { channel: "email", to: creator.email },
          },
        });

        results.push({ ...draft, status: "sent" });
      } catch (err) {
        if (err instanceof DailyLimitExceededError) {
          results.push({
            ...draft,
            status: "daily_limit_reached",
            error: err.message,
          });
        } else {
          results.push({
            ...draft,
            status: "failed",
            error: err instanceof Error ? err.message : "Email send failed",
          });
        }
      }
    } else if (draft.channel === "instagram_dm") {
      // --- Instagram DM channel ---
      if (!creator.instagramHandle) {
        results.push({
          ...draft,
          status: "no_contact_info",
          error: "Creator has no Instagram handle",
        });
        continue;
      }

      if (!unipileClient) {
        results.push({
          ...draft,
          status: "failed",
          error: "Unipile not configured. Connect in Settings → Connections.",
        });
        continue;
      }

      try {
        // RC-1 exact handle verification is enforced inside sendInstagramDM.
        // If Unipile's fuzzy search resolves to a different account, it aborts.
        const dmResult = await sendInstagramDM(
          unipileClient,
          unipileAccountId,
          creator.instagramHandle,
          draft.body
        );

        if (!dmResult.success) {
          results.push({
            ...draft,
            status: "failed",
            error: dmResult.error || "DM send failed",
          });
          continue;
        }

        // Create conversation thread — only reached if send succeeded
        await prisma.conversationThread.create({
          data: {
            brandId,
            campaignCreatorId: draft.campaignCreatorId,
            channel: "instagram_dm",
            status: "open",
            unipileChatId: dmResult.chatId,
          },
        });

        // Update lifecycle
        await prisma.campaignCreator.update({
          where: { id: draft.campaignCreatorId },
          data: {
            lifecycleStatus: "outreach_sent",
            outreachCount: { increment: 1 },
            lastOutreachAt: new Date(),
          },
        });
        await recordOutcomeEvent({
          campaignCreatorId: draft.campaignCreatorId,
          event: { type: "outreach_sent", method: "instagram_dm" },
        });

        // Activity log
        await prisma.activityLog.create({
          data: {
            action: "outreach.sent",
            entityType: "CampaignCreator",
            entityId: draft.campaignCreatorId,
            brandId,
            metadata: {
              channel: "instagram_dm",
              handle: creator.instagramHandle,
            },
          },
        });

        results.push({ ...draft, status: "sent" });
      } catch (err) {
        results.push({
          ...draft,
          status: "failed",
          error: err instanceof Error ? err.message : "DM send failed",
        });
      }
    } else {
      results.push({
        ...draft,
        status: "skipped",
        error: `Unknown channel: ${draft.channel}`,
      });
    }
  }

  return results;
}
