import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { archiveMentionMedia } from "@/lib/mentions/media-archive";

/**
 * Inngest function: Archive mention media to Supabase Storage.
 *
 * Triggered by:
 * 1. "mention/media.archive" event — immediately after a new MentionAsset is created
 * 2. Daily cron — catch any MentionAssets that failed initial archival
 *
 * Retries on failure since Instagram URLs might be temporarily unavailable.
 */
export const mentionMediaArchive = inngest.createFunction(
  {
    id: "mention-media-archive",
    name: "Mention Media Archive",
    retries: 3,
    concurrency: [{ limit: 5 }],
  },
  { event: "mention/media.archive" },
  async ({ event, step }) => {
    const { mentionAssetId } = event.data;

    const result = await step.run("archive-media", async () => {
      const archivedUrl = await archiveMentionMedia(mentionAssetId);
      return { mentionAssetId, archivedUrl, archived: !!archivedUrl };
    });

    return result;
  }
);

/**
 * Daily cron: Backfill any MentionAssets missing archived media.
 *
 * Finds MentionAssets where mediaUrl still points to external sources
 * (not Supabase Storage or Cloudinary) and queues them for archival.
 */
export const mentionMediaArchiveCron = inngest.createFunction(
  {
    id: "mention-media-archive-cron",
    name: "Mention Media Archive Cron",
    retries: 1,
    concurrency: [{ limit: 1 }],
  },
  { cron: "0 4 * * *" }, // Daily at 4 AM
  async ({ step }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

    // Find unarchived mention assets
    const unarchived = await step.run("find-unarchived", async () => {
      const assets = await prisma.mentionAsset.findMany({
        where: {
          NOT: [
            { mediaUrl: { contains: supabaseUrl || "supabase.co/storage" } },
            { mediaUrl: { contains: "res.cloudinary.com" } },
          ],
        },
        select: { id: true },
        take: 100, // Process in batches to avoid timeouts
      });

      return assets.map((a) => a.id);
    });

    if (unarchived.length === 0) {
      return { status: "no_unarchived", count: 0 };
    }

    // Archive each one
    let archived = 0;
    let failed = 0;

    for (const mentionAssetId of unarchived) {
      const result = await step.run(
        `archive-${mentionAssetId}`,
        async () => {
          const url = await archiveMentionMedia(mentionAssetId);
          return { success: !!url };
        }
      );

      if (result.success) {
        archived++;
      } else {
        failed++;
      }
    }

    return {
      status: "completed",
      total: unarchived.length,
      archived,
      failed,
    };
  }
);
