import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { classifyReply, extractAddress, generateDraft } from "@/lib/inbox/ai";
import { getFeatureFlags } from "@/lib/feature-flags";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";

/**
 * Inngest function: Process an inbound Instagram DM reply.
 *
 * Listens on "unipile/message.received" and:
 * 1. Loads message, filters outbound echo
 * 2. Detects media-only messages (empty body)
 * 3. Classifies the reply with AI (DM-specific prompt)
 * 4. Records outcome event
 * 5. If address detected: extracts address, creates ShippingAddressSnapshot
 * 6. If positive: updates lifecycle (forward-only)
 * 7. If negative/low-confidence: creates InterventionCase
 * 8. If aiReplyEnabled: generates AI draft
 *
 * // INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.
 * // INVARIANT: OpenAI failures create Interventions, never propagate as 500s.
 * // INVARIANT: Lifecycle status only moves forward, never regresses.
 */
export const processDmReply = inngest.createFunction(
  {
    id: "process-dm-reply",
    name: "Process DM Reply",
    retries: 2,
  },
  { event: "unipile/message.received" },
  async ({ event }) => {
    const { threadId, messageId, brandId, campaignCreatorId } = event.data;

    // 1. Load the message by ID
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return { status: "skipped", reason: "message_not_found" };
    }

    // 2. Filter outbound echo — Unipile webhooks fire for brand's own sent messages
    if (message.direction !== "inbound") {
      return { status: "skipped", reason: "outbound_echo" };
    }

    // 3. Detect media-only messages (empty body but message exists)
    if (!message.body || message.body.trim() === "") {
      await prisma.interventionCase.create({
        data: {
          type: "media_message",
          status: "open",
          priority: "normal",
          title: "DM contains media attachment — requires manual review",
          description:
            "DM contains media attachment (possibly address screenshot) — requires manual review.",
          brandId,
          campaignCreatorId,
        },
      });
      return { status: "intervention", reason: "media_only" };
    }

    // 4. Load last 5 thread messages for DM context
    const threadMessages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const contextMessages = [...threadMessages].reverse();

    // 5. Classify the reply with DM-specific channel
    const classification = await classifyReply(
      { body: message.body, subject: null },
      brandId,
      campaignCreatorId,
      "instagram_dm"
    );

    // Update message with classification
    await prisma.message.update({
      where: { id: messageId },
      data: {
        classification: classification.intent,
        confidence: classification.confidence,
      },
    });

    // 6. Record outcome event after classification
    await recordOutcomeEvent({
      campaignCreatorId,
      event: {
        type: "reply_received",
        replyType: classification.intent,
      },
    });

    // 7. Low confidence — always create intervention regardless of intent
    if (classification.confidence < 0.7) {
      await prisma.interventionCase.create({
        data: {
          type: "unclear_reply",
          status: "open",
          priority: "normal",
          title: "Low confidence DM classification",
          description: `DM classified as "${classification.intent}" with confidence ${classification.confidence.toFixed(2)}. Manual review recommended.\n\nMessage: "${message.body.slice(0, 300)}..."`,
          brandId,
          campaignCreatorId,
        },
      });
      return { status: "intervention", reason: "low_confidence" };
    }

    // 8. Address intent — extract address
    if (classification.intent === "address") {
      const address = await extractAddress(
        message.body,
        brandId,
        campaignCreatorId
      );

      if (address) {
        await prisma.shippingAddressSnapshot.create({
          data: {
            ...address,
            source: "ai_extracted",
            isActive: false, // Requires human confirmation
            campaignCreatorId,
          },
        });

        // Forward-only lifecycle guard: never regress status
        const advanced = await prisma.campaignCreator.updateMany({
          where: {
            id: campaignCreatorId,
            lifecycleStatus: {
              in: ["outreach_sent", "ready", "replied"],
            },
          },
          data: {
            lifecycleStatus: "address_confirmed",
            lastReplyAt: new Date(),
          },
        });

        // Outcome feed parity with the Gmail path — DM-origin address
        // confirmations must also populate CampaignOutcome.
        if (advanced.count > 0) {
          await recordOutcomeEvent({
            campaignCreatorId,
            event: { type: "address_confirmed" },
          });
        }
      }

      return { status: "processed", intent: "address" };
    }

    // 9. Positive — update lifecycle (forward-only guard)
    if (classification.intent === "positive") {
      // Forward-only: only advance if currently at outreach_sent or ready
      await prisma.campaignCreator.updateMany({
        where: {
          id: campaignCreatorId,
          lifecycleStatus: { in: ["outreach_sent", "ready"] },
        },
        data: {
          lifecycleStatus: "replied",
          lastReplyAt: new Date(),
        },
      });
    }

    // 10. Negative or question — create intervention for human review
    if (
      classification.intent === "negative" ||
      classification.intent === "question"
    ) {
      await prisma.interventionCase.create({
        data: {
          type: "manual_review",
          status: "open",
          priority: "normal",
          title:
            classification.intent === "negative"
              ? "Creator declined or opted out via DM"
              : "Creator has questions via DM",
          description: `DM classified as "${classification.intent}" with confidence ${classification.confidence.toFixed(2)}.\n\nMessage: "${message.body.slice(0, 300)}..."`,
          brandId,
          campaignCreatorId,
        },
      });

      if (classification.intent === "negative") {
        // Forward-only: only set replied if currently before it
        await prisma.campaignCreator.updateMany({
          where: {
            id: campaignCreatorId,
            lifecycleStatus: { in: ["outreach_sent", "ready"] },
          },
          data: {
            lifecycleStatus: "replied",
            lastReplyAt: new Date(),
          },
        });
        return { status: "intervention", intent: "negative" };
      }
    }

    // 11. Generate AI draft if enabled (for positive, question, or other intents)
    if (
      classification.intent === "positive" ||
      classification.intent === "question"
    ) {
      const flags = await getFeatureFlags(brandId);
      if (!flags.aiReplyEnabled) {
        return {
          status: "processed",
          intent: classification.intent,
          draft: "skipped_ai_disabled",
        };
      }

      const thread = await prisma.conversationThread.findUnique({
        where: { id: threadId },
        include: {
          campaignCreator: {
            include: {
              creator: true,
              campaign: { select: { id: true, name: true } },
            },
          },
        },
      });

      if (thread) {
        const brandSettings = await prisma.brandSettings.findUnique({
          where: { brandId },
        });

        const draftBody = await generateDraft(
          {
            messages: contextMessages.map((m) => ({
              direction: m.direction,
              body: m.body,
            })),
            campaignCreator: {
              campaign: thread.campaignCreator.campaign,
              creator: thread.campaignCreator.creator,
            },
          },
          brandId,
          brandSettings?.brandVoice,
          campaignCreatorId
        );

        if (draftBody) {
          // INVARIANT: AI drafts are NEVER auto-sent.
          await prisma.aIDraft.create({
            data: {
              type: "reply",
              status: "draft",
              body: draftBody,
              campaignCreatorId,
            },
          });
        }
      }
    }

    return { status: "processed", intent: classification.intent };
  }
);
