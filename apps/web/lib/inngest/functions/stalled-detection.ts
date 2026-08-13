import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";

/**
 * Inngest cron function: Detect stalled creators.
 *
 * Runs daily at 5 AM UTC. Finds CampaignCreators stuck in "delivered"
 * status past the reminder window with all reminders exhausted and
 * no mention posted. Transitions them to "stalled".
 *
 * // INVARIANT: Re-checks MentionAsset inside transaction (race condition guard)
 * // INVARIANT: Uses BrandSettings.reminderWindowDays (first-class column, default 14)
 * // INVARIANT: Verifies ALL reminders are terminal AND count >= maxFollowUps
 */
export const stalledDetection = inngest.createFunction(
  {
    id: "stalled-detection",
    name: "Detect Stalled Creators",
    retries: 2,
  },
  { cron: "0 5 * * *" },
  async ({ step }) => {
    const stalledCounts: Record<string, number> = {};

    // Fetch all brands with their settings
    const brands = await step.run("fetch-brands", async () => {
      return prisma.brand.findMany({
        include: { settings: true },
      });
    });

    for (const brand of brands) {
      const reminderWindowDays = brand.settings?.reminderWindowDays ?? 14;
      const maxFollowUps = brand.settings?.maxFollowUps ?? 3;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - reminderWindowDays);

      const candidates = await step.run(
        `fetch-candidates-${brand.id}`,
        async () => {
          return prisma.campaignCreator.findMany({
            where: {
              lifecycleStatus: "delivered",
              campaign: { brandId: brand.id },
              updatedAt: { lt: cutoff },
            },
            select: { id: true },
          });
        }
      );

      let brandStalledCount = 0;

      for (const candidate of candidates) {
        const transitioned = await step.run(
          `check-stalled-${candidate.id}`,
          async () => {
            return prisma.$transaction(async (tx) => {
              // Re-verify no mention appeared (race condition guard)
              const mentionExists = await tx.mentionAsset.findFirst({
                where: { campaignCreatorId: candidate.id },
              });
              if (mentionExists) return false;

              // Verify all reminders exhausted
              const reminderSchedules = await tx.reminderSchedule.findMany({
                where: { campaignCreatorId: candidate.id },
              });

              const allTerminal = reminderSchedules.every((r) =>
                ["sent", "cancelled", "suppressed"].includes(r.status)
              );
              const remindersExhausted =
                allTerminal && reminderSchedules.length >= maxFollowUps;

              if (!remindersExhausted) return false;

              // Re-verify lifecycle is still "delivered" (could have changed)
              const current = await tx.campaignCreator.findUnique({
                where: { id: candidate.id },
                select: { lifecycleStatus: true },
              });
              if (current?.lifecycleStatus !== "delivered") return false;

              await tx.campaignCreator.update({
                where: { id: candidate.id },
                data: { lifecycleStatus: "stalled" },
              });

              return true;
            });
          }
        );

        if (transitioned) {
          brandStalledCount++;

          // Record outcome event outside transaction (non-critical)
          try {
            await recordOutcomeEvent({
              campaignCreatorId: candidate.id,
              event: {
                type: "stalled",
                reason: "All reminders exhausted with no mention posted",
              },
            });
          } catch (err) {
            log("error", "stalled.outcome_event_failed", {
              campaignCreatorId: candidate.id,
              error: err instanceof Error ? err.message : "Unknown error",
            });
          }
        }
      }

      if (brandStalledCount > 0) {
        stalledCounts[brand.id] = brandStalledCount;
        log("info", "stalled.brand_summary", {
          brandId: brand.id,
          stalledCount: brandStalledCount,
        });
      }
    }

    const totalStalled = Object.values(stalledCounts).reduce(
      (sum, c) => sum + c,
      0
    );

    log("info", "stalled.detection_complete", {
      totalStalled,
      brandCount: Object.keys(stalledCounts).length,
    });

    return {
      status: "completed",
      totalStalled,
      stalledCounts,
    };
  }
);
