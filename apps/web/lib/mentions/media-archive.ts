import { prisma } from "@/lib/prisma";
import { uploadMentionMedia } from "@/lib/supabase/storage";
import { log } from "@/lib/logger";

/**
 * Archive mention media to Supabase Storage (primary) and optionally Cloudinary (CDN).
 *
 * Downloads media from the original social URL and uploads to Supabase Storage,
 * ensuring mention media persists even if Instagram/social URLs expire.
 *
 * The original URL is replaced with the archived Supabase URL in the mediaUrl field.
 * If CLOUDINARY_CLOUD_NAME is configured, also uploads to Cloudinary for CDN/transforms.
 *
 * @param mentionAssetId - The MentionAsset ID to archive
 * @returns The archived URL, or null if archiving failed
 */
export async function archiveMentionMedia(
  mentionAssetId: string
): Promise<string | null> {
  const mentionAsset = await prisma.mentionAsset.findUnique({
    where: { id: mentionAssetId },
    include: {
      campaignCreator: {
        include: {
          creator: true,
          campaign: true,
        },
      },
    },
  });

  if (!mentionAsset) {
    log("warn", "media-archive.not_found", { mentionAssetId });
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // Skip if already archived (URL points to Supabase or Cloudinary)
  if (
    mentionAsset.mediaUrl.includes(supabaseUrl) ||
    mentionAsset.mediaUrl.includes("res.cloudinary.com")
  ) {
    log("info", "media-archive.already_archived", {
      mentionAssetId,
      url: mentionAsset.mediaUrl,
    });
    return mentionAsset.mediaUrl;
  }

  const originalUrl = mentionAsset.mediaUrl;
  const brandId = mentionAsset.campaignCreator?.campaign?.brandId ?? "unknown";
  const campaignId = mentionAsset.campaignCreator?.campaign?.id ?? "unlinked";

  log("info", "media-archive.starting", {
    mentionAssetId,
    platform: mentionAsset.platform,
    originalUrl,
    brandId,
    campaignId,
  });

  try {
    // Primary: Upload to Supabase Storage
    const archivedUrl = await uploadMentionMedia(
      mentionAssetId,
      originalUrl,
      brandId,
      campaignId
    );

    // Update MentionAsset mediaUrl to the archived URL
    await prisma.mentionAsset.update({
      where: { id: mentionAssetId },
      data: { mediaUrl: archivedUrl },
    });

    log("info", "media-archive.supabase_success", {
      mentionAssetId,
      archivedUrl,
    });

    // Optional: Also upload to Cloudinary for CDN/transforms
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const { uploadFromUrl } = await import("@/lib/cloudinary/client");

        const creatorName =
          mentionAsset.campaignCreator?.creator?.name?.replace(/\W+/g, "-") ??
          "unknown";
        const campaignName =
          mentionAsset.campaignCreator?.campaign?.name?.replace(/\W+/g, "-") ??
          "general";

        const resourceType =
          mentionAsset.type === "video" || mentionAsset.type === "reel"
            ? "video"
            : "image";

        await uploadFromUrl(originalUrl, {
          folder: `seed-scale/mentions/${campaignName}`,
          resourceType: resourceType as "image" | "video",
          publicId: mentionAssetId,
          tags: [
            mentionAsset.platform,
            mentionAsset.type ?? "post",
            creatorName,
            `original:${originalUrl}`,
          ],
        });

        log("info", "media-archive.cloudinary_success", { mentionAssetId });
      } catch (cloudinaryError) {
        // Cloudinary is optional — log but don't fail
        const errMsg =
          cloudinaryError instanceof Error
            ? cloudinaryError.message
            : "Unknown error";
        log("warn", "media-archive.cloudinary_failed", {
          mentionAssetId,
          error: errMsg,
        });
      }
    }

    return archivedUrl;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    log("error", "media-archive.failed", {
      mentionAssetId,
      originalUrl,
      error: errMsg,
    });
    return null;
  }
}
