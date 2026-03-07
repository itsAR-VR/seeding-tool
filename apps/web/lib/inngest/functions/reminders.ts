import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";

/**
 * Inngest function: Schedule post-fulfillment reminder sequence.
 *
 * Listens on "shopify/order.fulfilled" and schedules reminders
 * based on BrandSettings.defaultFollowUpDays and maxFollowUps.
 *
 * // INVARIANT: Reminder cadence uses BrandSettings values, never hardcoded
 */
export const scheduleReminders = inngest.createFunction(
  {
    id: "schedule-post-fulfillment-reminders",
    name: "Schedule Post-Fulfillment Reminders",
    retries: 2,
  },
  { event: "shopify/order.fulfilled" },
  async ({ event, step }) => {
    const { orderId, campaignCreatorId } = event.data as {
      orderId: string;
      campaignCreatorId: string;
    };

    // Fetch campaign creator with brand settings
    const campaignCreator = await step.run(
      "fetch-campaign-creator",
      async () => {
        return prisma.campaignCreator.findUnique({
          where: { id: campaignCreatorId },
          include: {
            campaign: {
              include: {
                brand: {
                  include: { settings: true },
                },
              },
            },
          },
        });
      }
    );

    if (!campaignCreator) {
      return { status: "skipped", reason: "Campaign creator not found" };
    }

    // INVARIANT: Reminder cadence uses BrandSettings values, never hardcoded
    const settings = campaignCreator.campaign.brand.settings;
    const delayDays = settings?.defaultFollowUpDays ?? 3;
    const maxReminders = settings?.maxFollowUps ?? 3;
    const brandId = campaignCreator.campaign.brandId;

    // Create reminder schedule records
    for (let i = 0; i < maxReminders; i++) {
      const reminderNumber = i + 1;
      const daysFromNow = delayDays * reminderNumber;

      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + daysFromNow);

      // Create ReminderSchedule record
      await step.run(`create-reminder-${reminderNumber}`, async () => {
        return prisma.reminderSchedule.create({
          data: {
            type: "post_reminder",
            status: "pending",
            scheduledFor,
            campaignCreatorId,
          },
        });
      });

      // Sleep until the reminder is due
      await step.sleep(
        `wait-for-reminder-${reminderNumber}`,
        `${daysFromNow}d`
      );

      // Check lifecycle status before sending
      const currentStatus = await step.run(
        `check-status-${reminderNumber}`,
        async () => {
          const cc = await prisma.campaignCreator.findUnique({
            where: { id: campaignCreatorId },
            select: { lifecycleStatus: true },
          });
          return cc?.lifecycleStatus || "unknown";
        }
      );

      // Skip if creator has already posted, completed, or opted out
      if (
        ["posted", "completed", "opted_out", "stalled"].includes(currentStatus)
      ) {
        // Cancel remaining reminders
        await step.run(`cancel-remaining-${reminderNumber}`, async () => {
          await prisma.reminderSchedule.updateMany({
            where: {
              campaignCreatorId,
              status: "pending",
            },
            data: {
              status: "cancelled",
              cancelReason: `Creator status: ${currentStatus}`,
            },
          });
        });

        return {
          status: "completed_early",
          reason: `Creator status is ${currentStatus}`,
          remindersSent: i,
        };
      }

      // Check for mentions before sending
      const hasMention = await step.run(
        `check-mention-${reminderNumber}`,
        async () => {
          const mention = await prisma.mentionAsset.findFirst({
            where: { campaignCreatorId },
          });
          return !!mention;
        }
      );

      if (hasMention) {
        // Creator posted — update status and stop reminders
        await step.run(`mark-mentioned-${reminderNumber}`, async () => {
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
        });

        return {
          status: "completed_early",
          reason: "Mention detected",
          remindersSent: i,
        };
      }

      // Send the reminder (emit event for the mention-check/send function)
      await step.run(`emit-reminder-${reminderNumber}`, async () => {
        try {
          await inngest.send({
            name: "reminder/send",
            data: {
              campaignCreatorId,
              brandId,
              reminderNumber,
              orderId,
            },
          });
        } catch {
          console.warn(
            `[reminders] Failed to emit reminder/send event #${reminderNumber}`
          );
        }
      });
    }

    return {
      status: "completed",
      totalReminders: maxReminders,
    };
  }
);
