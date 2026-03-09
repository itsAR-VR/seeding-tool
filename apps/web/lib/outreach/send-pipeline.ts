/**
 * Multi-channel outreach send pipeline.
 *
 * Routes drafted outreach messages to the appropriate channel:
 * - email → Gmail API (via lib/gmail/send.ts)
 * - instagram_dm → Unipile API (via lib/unipile/send-dm.ts)
 *
 * INVARIANT: AI drafts are NEVER auto-sent. This pipeline fires
 * only on explicit human action (Send button click).
 */

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail/send";
import { getUnipileClient } from "@/lib/unipile/client";
import { sendInstagramDM } from "@/lib/unipile/send-dm";

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
  status: "sent" | "failed" | "no_contact_info" | "skipped";
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

    // Load creator details
    const creator = await prisma.creator.findUnique({
      where: { id: draft.creatorId },
      select: {
        id: true,
        email: true,
        instagramHandle: true,
        name: true,
      },
    });

    if (!creator) {
      results.push({
        ...draft,
        status: "failed",
        error: "Creator not found",
      });
      continue;
    }

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
        // Create conversation thread
        const thread = await prisma.conversationThread.create({
          data: {
            brandId,
            campaignCreatorId: draft.campaignCreatorId,
            channel: "email",
            status: "open",
          },
        });

        // Send via Gmail
        await sendEmail({
          aliasId: emailAliasId,
          to: creator.email,
          subject: draft.subject || "Collaboration opportunity",
          body: draft.body,
          threadId: thread.id,
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
        results.push({
          ...draft,
          status: "failed",
          error: err instanceof Error ? err.message : "Email send failed",
        });
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

        // Create conversation thread
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
