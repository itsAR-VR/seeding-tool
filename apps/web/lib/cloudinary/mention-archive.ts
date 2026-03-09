import { prisma } from "@/lib/prisma";
import { uploadFromUrl } from "@/lib/cloudinary/client";
import { log } from "@/lib/logger";

/**
 * Archive mention media to Cloudinary.
 *
 * Downloads media from a MentionAsset's mediaUrl and uploads to Cloudinary,
 * ensuring mention media persists even if Instagram/social URLs expire.
 *
 * Since we cannot modify the prisma schema, the Cloudinary URL is stored
 * in the MentionAsset's mediaUrl field (replacing the original social URL).
 * The original URL is preserved in the asset's tags for reference.
 *
 * @param mentionAssetId - The MentionAsset ID to archive
 * @returns The Cloudinary secure URL, or null if archiving failed
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
    log("warn", "cloudinary.archive.not_found", { mentionAssetId });
    return null;
  }

  // Skip if already archived to Cloudinary
  if (mentionAsset.mediaUrl.includes("res.cloudinary.com")) {
    log("info", "cloudinary.archive.already_archived", {
      mentionAssetId,
      url: mentionAsset.mediaUrl,
    });
    return mentionAsset.mediaUrl;
  }

  const originalUrl = mentionAsset.mediaUrl;

  log("info", "cloudinary.archive.starting", {
    mentionAssetId,
    platform: mentionAsset.platform,
    originalUrl,
  });

  try {
    // Determine resource type from mention type
    const resourceType =
      mentionAsset.type === "video" || mentionAsset.type === "reel"
        ? "video"
        : "image";

    // Build a descriptive public ID
    const creatorName =
      mentionAsset.campaignCreator?.creator?.name?.replace(/\W+/g, "-") ??
      "unknown";
    const campaignName =
      mentionAsset.campaignCreator?.campaign?.name?.replace(/\W+/g, "-") ??
      "general";

    const result = await uploadFromUrl(originalUrl, {
      folder: `seed-scale/mentions/${campaignName}`,
      resourceType: resourceType as "image" | "video",
      tags: [
        mentionAsset.platform,
        mentionAsset.type ?? "post",
        creatorName,
        `original:${originalUrl}`,
      ],
    });

    // Update MentionAsset mediaUrl to the Cloudinary URL
    await prisma.mentionAsset.update({
      where: { id: mentionAssetId },
      data: { mediaUrl: result.secure_url },
    });

    log("info", "cloudinary.archive.success", {
      mentionAssetId,
      cloudinaryUrl: result.secure_url,
      publicId: result.public_id,
    });

    return result.secure_url;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    log("error", "cloudinary.archive.failed", {
      mentionAssetId,
      originalUrl,
      error: errMsg,
    });
    return null;
  }
}
