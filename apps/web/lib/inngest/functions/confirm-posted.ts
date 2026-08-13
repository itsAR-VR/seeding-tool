import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";

/**
 * Inngest function: Confirm posted creator → completed.
 *
 * After a mention is attributed (lifecycle = "posted"), waits 7 days
 * then confirms the post is still valid and transitions to "completed".
 *
 * // INVARIANT: Re-checks lifecycle is still "posted" after sleep
 * // INVARIANT: Re-checks MentionAsset still exists (not deleted)
 */
export const confirmPosted = inngest.createFunction(
  {
    id: "confirm-posted-completion",
    name: "Confirm Posted → Completed",
    retries: 2,
  },
  { event: "mention/posted.confirm" },
  async ({ event, step }) => {
    const { campaignCreatorId, mentionAssetId } = event.data;

    // Wait 7 days for the post to stabilize
    await step.sleep("wait-7-days", "7d");

    // Re-check lifecycle status
    const currentStatus = await step.run("check-lifecycle", async () => {
      const cc = await prisma.campaignCreator.findUnique({
        where: { id: campaignCreatorId },
        select: { lifecycleStatus: true },
      });
      return cc?.lifecycleStatus ?? "unknown";
    });

    if (currentStatus !== "posted") {
      log("info", "confirm-posted.skipped", {
        campaignCreatorId,
        currentStatus,
        reason: "Lifecycle changed during wait period",
      });
      return {
        status: "skipped",
        reason: `Lifecycle is ${currentStatus}, not posted`,
      };
    }

    // Verify MentionAsset still exists
    const mentionExists = await step.run("check-mention", async () => {
      const mention = await prisma.mentionAsset.findUnique({
        where: { id: mentionAssetId },
      });
      return !!mention;
    });

    if (!mentionExists) {
      log("info", "confirm-posted.skipped", {
        campaignCreatorId,
        mentionAssetId,
        reason: "MentionAsset no longer exists",
      });
      return {
        status: "skipped",
        reason: "MentionAsset deleted",
      };
    }

    // Transition to completed
    await step.run("transition-to-completed", async () => {
      await prisma.campaignCreator.update({
        where: { id: campaignCreatorId },
        data: { lifecycleStatus: "completed" },
      });
    });

    await step.run("record-outcome", async () => {
      await recordOutcomeEvent({
        campaignCreatorId,
        event: { type: "completed" },
      });
    });

    log("info", "confirm-posted.completed", { campaignCreatorId });

    return { status: "completed", campaignCreatorId };
  }
);
