import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { isSuppressed } from "@/lib/compliance/suppression";

/**
 * Inngest function: Handle reminder/send events.
 *
 * Checks if creator has posted (MentionAsset exists), then:
 * - If mentioned: update lifecycle to "posted", stop reminders
 * - If not: send reminder email if under maxFollowUps limit
 *
 * // INVARIANT: Suppressed recipients never receive email — checked before every send
 * // INVARIANT: Reminder cadence uses BrandSettings values, never hardcoded
 */
export const handleReminderSend = inngest.createFunction(
  {
    id: "handle-reminder-send",
    name: "Handle Reminder Send",
    retries: 2,
  },
  { event: "reminder/send" },
  async ({ event }) => {
    const { campaignCreatorId, brandId, reminderNumber } = event.data as {
      campaignCreatorId: string;
      brandId: string;
      reminderNumber: number;
      orderId: string;
    };

    // Fetch campaign creator with details
    const campaignCreator = await prisma.campaignCreator.findUnique({
      where: { id: campaignCreatorId },
      include: {
        creator: true,
        campaign: {
          include: {
            brand: {
              include: {
                settings: true,
                emailAliases: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
        },
        conversationThread: true,
      },
    });

    if (!campaignCreator) {
      return { status: "skipped", reason: "Campaign creator not found" };
    }

    // Check lifecycle — skip if already done
    if (
      ["posted", "completed", "opted_out", "stalled"].includes(
        campaignCreator.lifecycleStatus
      )
    ) {
      return {
        status: "skipped",
        reason: `Creator lifecycle is ${campaignCreator.lifecycleStatus}`,
      };
    }

    // 1. Check if creator has posted (MentionAsset exists)
    const mention = await prisma.mentionAsset.findFirst({
      where: { campaignCreatorId },
    });

    if (mention) {
      // Creator posted! Update lifecycle and cancel remaining reminders
      await prisma.campaignCreator.update({
        where: { id: campaignCreatorId },
        data: { lifecycleStatus: "posted" },
      });

      await prisma.reminderSchedule.updateMany({
        where: {
          campaignCreatorId,
          status: "pending",
        },
        data: {
          status: "cancelled",
          cancelReason: "Creator posted — mention detected",
        },
      });

      return { status: "mention_detected", mentionId: mention.id };
    }

    // 2. Check maxFollowUps limit
    // INVARIANT: Reminder cadence uses BrandSettings values, never hardcoded
    const settings = campaignCreator.campaign.brand.settings;
    const maxFollowUps = settings?.maxFollowUps ?? 3;

    if (reminderNumber > maxFollowUps) {
      return { status: "skipped", reason: "Max follow-ups exceeded" };
    }

    // 3. Check suppression before sending
    const creatorEmail = campaignCreator.creator.email;
    if (!creatorEmail) {
      return { status: "skipped", reason: "No email for creator" };
    }

    // INVARIANT: Suppressed recipients never receive email — checked before every send
    if (await isSuppressed(creatorEmail)) {
      // Mark reminder as suppressed
      await prisma.reminderSchedule.updateMany({
        where: {
          campaignCreatorId,
          status: "pending",
        },
        data: {
          status: "suppressed",
          cancelReason: "Recipient is suppressed",
        },
      });

      return { status: "suppressed", email: creatorEmail };
    }

    // 4. Find a reminder template
    const template = await prisma.outreachTemplate.findFirst({
      where: {
        brandId,
        type: "reminder",
      },
    });

    if (!template) {
      // Create intervention — no reminder template configured
      await prisma.interventionCase.create({
        data: {
          type: "manual_review",
          status: "open",
          priority: "normal",
          title: "No reminder template configured",
          description: `Reminder #${reminderNumber} for creator ${campaignCreator.creator.name || creatorEmail} could not be sent: no reminder template found.`,
          brandId,
          campaignCreatorId,
        },
      });

      return { status: "error", reason: "No reminder template" };
    }

    // 5. Send the reminder via Gmail
    const alias = campaignCreator.campaign.brand.emailAliases[0];
    if (!alias) {
      return { status: "error", reason: "No default email alias" };
    }

    try {
      const { sendEmail } = await import("@/lib/gmail/send");

      const subject = template.subject
        .replace("{{creator_name}}", campaignCreator.creator.name || "there")
        .replace("{{campaign_name}}", campaignCreator.campaign.name);

      const body = template.body
        .replace("{{creator_name}}", campaignCreator.creator.name || "there")
        .replace("{{campaign_name}}", campaignCreator.campaign.name)
        .replace("{{reminder_number}}", String(reminderNumber));

      await sendEmail({
        aliasId: alias.id,
        to: creatorEmail,
        subject,
        body,
        threadId: campaignCreator.conversationThread?.id,
        externalThreadId:
          campaignCreator.conversationThread?.externalThreadId || undefined,
      });

      // Update reminder schedule
      await prisma.reminderSchedule.updateMany({
        where: {
          campaignCreatorId,
          status: "pending",
        },
        data: {
          status: "sent",
          sentAt: new Date(),
        },
      });

      return { status: "sent", reminderNumber };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Unknown error";

      // Create intervention for send failure
      await prisma.interventionCase.create({
        data: {
          type: "auth_failure",
          status: "open",
          priority: "high",
          title: `Reminder email send failed`,
          description: `Reminder #${reminderNumber} for ${creatorEmail} failed: ${errMsg}`,
          brandId,
          campaignCreatorId,
        },
      });

      return { status: "error", reason: errMsg };
    }
  }
);
