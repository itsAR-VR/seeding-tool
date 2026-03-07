import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { classifyReply, extractAddress, generateDraft } from "@/lib/inbox/ai";

/**
 * Inngest function: Process an inbound Gmail reply.
 *
 * Listens on "gmail/message.received" and:
 * 1. Classifies the reply with AI
 * 2. If address detected: extracts address, creates ShippingAddressSnapshot
 * 3. If positive/question: generates AI draft
 * 4. If negative: creates intervention for manual review
 * 5. Low confidence (< 0.7): always creates Intervention
 *
 * // INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.
 * // INVARIANT: OpenAI failures create Interventions, never propagate as 500s.
 */
export const processReply = inngest.createFunction(
  {
    id: "process-gmail-reply",
    name: "Process Gmail Reply",
    retries: 2,
  },
  { event: "gmail/message.received" },
  async ({ event }) => {
    const { threadId, messageId, brandId, campaignCreatorId } = event.data;

    // Fetch the message
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      return { status: "skipped", reason: "Message not found" };
    }

    // 1. Classify the reply
    const classification = await classifyReply(
      { body: message.body, subject: message.subject },
      brandId,
      campaignCreatorId
    );

    // Update message with classification
    await prisma.message.update({
      where: { id: messageId },
      data: {
        classification: classification.intent,
        confidence: classification.confidence,
      },
    });

    // 5. Low confidence — always create intervention regardless of intent
    if (classification.confidence < 0.7) {
      await prisma.interventionCase.create({
        data: {
          type: "unclear_reply",
          status: "open",
          priority: "normal",
          title: "Low confidence reply classification",
          description: `Reply classified as "${classification.intent}" with confidence ${classification.confidence.toFixed(2)}. Manual review recommended.\n\nMessage: "${message.body.slice(0, 300)}..."`,
          brandId,
          campaignCreatorId,
        },
      });
      return { status: "intervention", reason: "low_confidence" };
    }

    // 2. Address intent — extract address
    if (classification.intent === "address") {
      const address = await extractAddress(message.body, brandId, campaignCreatorId);

      if (address) {
        await prisma.shippingAddressSnapshot.create({
          data: {
            ...address,
            source: "ai_extracted",
            isActive: false, // Requires human confirmation
            campaignCreatorId,
          },
        });

        await prisma.campaignCreator.update({
          where: { id: campaignCreatorId },
          data: {
            lifecycleStatus: "address_confirmed",
            lastReplyAt: new Date(),
          },
        });
      }

      return { status: "processed", intent: "address" };
    }

    // 3. Positive or question — generate draft
    if (
      classification.intent === "positive" ||
      classification.intent === "question"
    ) {
      const thread = await prisma.conversationThread.findUnique({
        where: { id: threadId },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
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
            messages: thread.messages,
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
          // INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.
          await prisma.aIDraft.create({
            data: {
              type: "reply",
              status: "draft",
              subject: message.subject
                ? `Re: ${message.subject.replace(/^Re:\s*/i, "")}`
                : undefined,
              body: draftBody,
              campaignCreatorId,
            },
          });
        }

        // Update lifecycle
        if (classification.intent === "positive") {
          await prisma.campaignCreator.update({
            where: { id: campaignCreatorId },
            data: {
              lifecycleStatus: "replied",
              lastReplyAt: new Date(),
            },
          });
        }
      }

      return { status: "processed", intent: classification.intent };
    }

    // 4. Negative — intervention for manual review
    if (classification.intent === "negative") {
      await prisma.interventionCase.create({
        data: {
          type: "manual_review",
          status: "open",
          priority: "normal",
          title: "Creator declined or opted out",
          description: `Creator reply classified as negative. Review and update lifecycle status.\n\nMessage: "${message.body.slice(0, 300)}..."`,
          brandId,
          campaignCreatorId,
        },
      });

      await prisma.campaignCreator.update({
        where: { id: campaignCreatorId },
        data: {
          lifecycleStatus: "replied",
          lastReplyAt: new Date(),
        },
      });

      return { status: "intervention", intent: "negative" };
    }

    return { status: "processed", intent: "other" };
  }
);
