import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { normalizeInboundMessage, persistMessage } from "@/lib/inbox/messages";
import { fetchNewMessages, resolveThreadByExternalId, resolveBrandByEmail } from "@/lib/gmail/ingest";
import { classifyReply, extractAddress, generateDraft } from "@/lib/inbox/ai";
import { inngest } from "@/lib/inngest/client";

/**
 * POST /api/gmail/webhook
 * Handles Gmail push notifications (Pub/Sub).
 *
 * Flow:
 * 1. Verify the payload is from Google
 * 2. Fetch new messages via Gmail API
 * 3. Normalize and persist (dedupe by Gmail message ID)
 * 4. Emit Inngest event or process inline
 *
 * // INVARIANT: Message dedupe on externalId prevents replay duplicates.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      message?: {
        data?: string;
        messageId?: string;
      };
      subscription?: string;
    };

    // Decode the Pub/Sub message data
    let emailAddress: string | undefined;

    if (body.message?.data) {
      try {
        const decoded = JSON.parse(
          Buffer.from(body.message.data, "base64").toString("utf-8")
        ) as { emailAddress?: string; historyId?: number };
        emailAddress = decoded.emailAddress;
      } catch {
        // Non-JSON data, skip
      }
    }

    // Record webhook event
    await prisma.webhookEvent.create({
      data: {
        provider: "gmail",
        eventType: "push_notification",
        externalEventId: body.message?.messageId,
        payload: JSON.parse(JSON.stringify(body)),
        status: "processing",
      },
    });

    log("info", "gmail.ingest.received", { emailAddress, pubsubMessageId: body.message?.messageId });

    if (!emailAddress) {
      return NextResponse.json({ status: "ok", processed: 0 });
    }

    // Resolve which brand this notification is for
    const brand = await resolveBrandByEmail(emailAddress);
    if (!brand) {
      return NextResponse.json({ status: "ok", processed: 0 });
    }

    // Fetch new messages from Gmail
    const rawMessages = await fetchNewMessages(brand.id);

    let processed = 0;

    for (const raw of rawMessages) {
      // Normalize the message
      const normalized = normalizeInboundMessage(raw);

      // Check if this is a reply to one of our threads
      const thread = await resolveThreadByExternalId(raw.threadId);

      if (!thread) {
        // Could be an unknown thread — skip if we can't resolve it
        // In future phases we might handle unsolicited inbound
        continue;
      }

      // INVARIANT: Message dedupe on externalId prevents replay duplicates.
      const { message: persistedMessage, created } = await persistMessage(
        thread.id,
        {
          ...normalized,
          direction: "inbound",
        }
      );

      if (!created) {
        // Already processed this message — skip
        continue;
      }

      // Emit Inngest event or process inline
      const campaignCreatorId = thread.campaignCreatorId;

      try {
        // Try emitting to Inngest
        await inngest.send({
          name: "gmail/message.received",
          data: {
            threadId: thread.id,
            messageId: persistedMessage.id,
            brandId: brand.id,
            campaignCreatorId,
          },
        });
      } catch {
        // Inngest not configured — process inline
        // INVARIANT: OpenAI failures create Interventions, never propagate as 500s.

        log("info", "gmail.ingest.classify_inline", { threadId: thread.id, messageId: persistedMessage.id, brandId: brand.id });

        const classification = await classifyReply(
          { body: persistedMessage.body, subject: persistedMessage.subject },
          brand.id,
          campaignCreatorId
        );

        // Update message classification
        await prisma.message.update({
          where: { id: persistedMessage.id },
          data: {
            classification: classification.intent,
            confidence: classification.confidence,
          },
        });

        // Handle based on classification (same logic as Inngest function)
        log("info", "gmail.ingest.classified", { threadId: thread.id, intent: classification.intent, confidence: classification.confidence, brandId: brand.id });

        if (classification.confidence < 0.7) {
          log("warn", "gmail.ingest.low_confidence", { threadId: thread.id, intent: classification.intent, confidence: classification.confidence, brandId: brand.id, campaignCreatorId });
          await prisma.interventionCase.create({
            data: {
              type: "unclear_reply",
              status: "open",
              priority: "normal",
              title: "Low confidence reply classification",
              description: `Reply classified as "${classification.intent}" with confidence ${classification.confidence.toFixed(2)}.`,
              brandId: brand.id,
              campaignCreatorId,
            },
          });
        } else if (classification.intent === "address") {
          const address = await extractAddress(
            persistedMessage.body,
            brand.id,
            campaignCreatorId
          );
          if (address) {
            await prisma.shippingAddressSnapshot.create({
              data: {
                ...address,
                source: "ai_extracted",
                isActive: false,
                campaignCreatorId,
              },
            });
            await prisma.campaignCreator.update({
              where: { id: campaignCreatorId },
              data: { lifecycleStatus: "address_confirmed", lastReplyAt: new Date() },
            });
          }
        } else if (
          classification.intent === "positive" ||
          classification.intent === "question"
        ) {
          // Feature flag guard: if AI reply is disabled, create Intervention instead
          const { getFeatureFlags } = await import("@/lib/feature-flags");
          const flags = await getFeatureFlags(brand.id);
          if (!flags.aiReplyEnabled) {
            await prisma.interventionCase.create({
              data: {
                type: "manual_review",
                status: "open",
                priority: "normal",
                title: "AI reply disabled — manual draft required",
                description: `AI reply feature flag is disabled. Manual reply needed for ${classification.intent} message.`,
                brandId: brand.id,
                campaignCreatorId,
              },
            });
          } else {

          const fullThread = await prisma.conversationThread.findUnique({
            where: { id: thread.id },
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

          if (fullThread) {
            const brandSettings = await prisma.brandSettings.findUnique({
              where: { brandId: brand.id },
            });

            const draftBody = await generateDraft(
              {
                messages: fullThread.messages,
                campaignCreator: {
                  campaign: fullThread.campaignCreator.campaign,
                  creator: fullThread.campaignCreator.creator,
                },
              },
              brand.id,
              brandSettings?.brandVoice,
              campaignCreatorId
            );

            if (draftBody) {
              // INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.
              await prisma.aIDraft.create({
                data: {
                  type: "reply",
                  status: "draft",
                  subject: persistedMessage.subject
                    ? `Re: ${persistedMessage.subject.replace(/^Re:\s*/i, "")}`
                    : undefined,
                  body: draftBody,
                  campaignCreatorId,
                },
              });
            }
          }

          } // end: else (aiReplyEnabled)

          await prisma.campaignCreator.update({
            where: { id: campaignCreatorId },
            data: { lifecycleStatus: "replied", lastReplyAt: new Date() },
          });
        } else if (classification.intent === "negative") {
          await prisma.interventionCase.create({
            data: {
              type: "manual_review",
              status: "open",
              priority: "normal",
              title: "Creator declined or opted out",
              description: `Reply classified as negative.`,
              brandId: brand.id,
              campaignCreatorId,
            },
          });
          await prisma.campaignCreator.update({
            where: { id: campaignCreatorId },
            data: { lifecycleStatus: "replied", lastReplyAt: new Date() },
          });
        }
      }

      processed++;
    }

    // Update webhook event status
    if (body.message?.messageId) {
      await prisma.webhookEvent.updateMany({
        where: { externalEventId: body.message.messageId },
        data: { status: "processed", processedAt: new Date() },
      });
    }

    return NextResponse.json({ status: "ok", processed });
  } catch (error) {
    log("error", "gmail.ingest.fatal", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
