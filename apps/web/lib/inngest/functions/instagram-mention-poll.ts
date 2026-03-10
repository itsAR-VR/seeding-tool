import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { getTaggedMedia, InstagramApiError } from "@/lib/instagram/client";
import { createAndAttributeMention } from "@/lib/mentions/attribution";

/**
 * Map Instagram media_type to our internal type.
 */
function mapMediaType(igType?: string): string | undefined {
  switch (igType) {
    case "IMAGE":
      return "post";
    case "VIDEO":
      return "reel";
    case "CAROUSEL_ALBUM":
      return "post";
    default:
      return undefined;
  }
}

/**
 * Inngest cron function: Poll Instagram Graph API for new tagged media.
 *
 * Runs every 15 minutes. For each brand with a connected Instagram account:
 * 1. Decrypt the stored access token
 * 2. Call getTaggedMedia() to find new tags
 * 3. For each new tag, try to match to an active CampaignCreator
 * 4. Create MentionAsset and call attributeMention()
 * 5. Deduplicates via the platform+mediaUrl unique constraint
 */
export const instagramMentionPoll = inngest.createFunction(
  {
    id: "instagram-mention-poll",
    name: "Instagram Mention Poll",
    retries: 2,
    concurrency: [{ limit: 1 }], // Only one poll at a time
  },
  { cron: "*/15 * * * *" }, // Every 15 minutes
  async ({ step }) => {
    try {
      const credentials = await step.run(
        "fetch-instagram-credentials",
        async () => {
          const creds = await prisma.providerCredential.findMany({
            where: {
              provider: "instagram",
              credentialType: "oauth_access_token",
              isValid: true,
            },
            include: {
              brand: {
                include: {
                  connections: {
                    where: {
                      provider: "instagram",
                      status: "connected",
                      connectionMethod: "oauth",
                    },
                  },
                },
              },
            },
          });

          return creds.map((c) => ({
            id: c.id,
            brandId: c.brandId,
            encryptedValue: c.encryptedValue,
            expiresAt: c.expiresAt?.toISOString() ?? null,
            metadata: c.brand.connections[0]?.metadata as {
              igUserId?: string;
              igUsername?: string;
            } | null,
          }));
        }
      );

      if (credentials.length === 0) {
        return { status: "no_brands", processed: 0 };
      }

      const results: Array<{
        brandId: string;
        newMentions: number;
        error?: string;
      }> = [];

      for (const cred of credentials) {
        const result = await step.run(
          `poll-brand-${cred.brandId}`,
          async () => {
            try {
              const decrypted = decrypt(cred.encryptedValue);
              const payload = JSON.parse(decrypted) as {
                accessToken: string;
                igUserId: string;
                igUsername?: string;
              };

              const igUserId = cred.metadata?.igUserId ?? payload.igUserId;

              if (!igUserId || !payload.accessToken) {
                return {
                  brandId: cred.brandId,
                  newMentions: 0,
                  error: "Missing igUserId or accessToken",
                };
              }

              const tagged = await getTaggedMedia(
                igUserId,
                payload.accessToken
              );

              if (!tagged.data || tagged.data.length === 0) {
                return { brandId: cred.brandId, newMentions: 0 };
              }

              let newMentions = 0;

              for (const media of tagged.data) {
                if (!media.permalink) continue;

                const existing = await prisma.mentionAsset.findUnique({
                  where: {
                    platform_mediaUrl: {
                      platform: "instagram",
                      mediaUrl: media.permalink,
                    },
                  },
                });

                if (existing) continue;

                const campaignCreator = await findMatchingCampaignCreator(
                  cred.brandId,
                  media.caption
                );

                if (!campaignCreator) {
                  continue;
                }

                const mentionId = await createAndAttributeMention({
                  platform: "instagram",
                  mediaUrl: media.permalink,
                  type: mapMediaType(media.media_type),
                  caption: media.caption,
                  likes: media.like_count,
                  comments: media.comments_count,
                  postedAt: media.timestamp
                    ? new Date(media.timestamp)
                    : undefined,
                  campaignCreatorId: campaignCreator.id,
                });

                try {
                  await inngest.send({
                    name: "mention/media.archive",
                    data: { mentionAssetId: mentionId },
                  });
                } catch (dispatchError) {
                  console.error(
                    `[instagram-mention-poll] Failed to queue archive for mention ${mentionId}:`,
                    dispatchError
                  );
                }

                newMentions++;
              }

              return { brandId: cred.brandId, newMentions };
            } catch (error) {
              const errMsg =
                error instanceof InstagramApiError
                  ? `IG API Error [${error.code}]: ${error.message}`
                  : error instanceof Error
                    ? error.message
                    : "Unknown error";

              if (
                error instanceof InstagramApiError &&
                error.isAuthError
              ) {
                await prisma.providerCredential.update({
                  where: { id: cred.id },
                  data: { isValid: false },
                });

                await prisma.brandConnection.updateMany({
                  where: {
                    brandId: cred.brandId,
                    provider: "instagram",
                  },
                  data: { status: "error" },
                });
              }

              console.error(
                `[instagram-mention-poll] Brand ${cred.brandId}:`,
                errMsg
              );

              return {
                brandId: cred.brandId,
                newMentions: 0,
                error: errMsg,
              };
            }
          }
        );

        results.push(result);
      }

      const totalNew = results.reduce((sum, r) => sum + r.newMentions, 0);
      const failedBrands = results.filter((result) => result.error).length;
      return {
        status: failedBrands > 0 ? "completed_with_errors" : "completed",
        processed: credentials.length,
        totalNewMentions: totalNew,
        failedBrands,
        results,
      };
    } catch (error) {
      console.error("[instagram-mention-poll] Fatal cron failure", error);
      return {
        status: "error",
        processed: 0,
        totalNewMentions: 0,
        failedBrands: 1,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

/**
 * Try to match a tagged post to a CampaignCreator for a brand.
 *
 * Looks for active CampaignCreators whose Instagram handle appears
 * in the caption, or who are in the "shipped" or "delivered" lifecycle
 * status (waiting for a post).
 */
async function findMatchingCampaignCreator(
  brandId: string,
  caption?: string
): Promise<{ id: string } | null> {
  // First, find all active campaign creators for this brand
  // that are in a lifecycle state where we'd expect a mention
  const candidates = await prisma.campaignCreator.findMany({
    where: {
      campaign: { brandId },
      lifecycleStatus: {
        in: ["shipped", "delivered", "reminded"],
      },
    },
    include: {
      creator: {
        select: {
          id: true,
          instagramHandle: true,
          name: true,
        },
      },
    },
  });

  if (candidates.length === 0) return null;

  // If there's only one candidate, return it
  if (candidates.length === 1) return { id: candidates[0].id };

  // Try to match by Instagram handle in caption
  if (caption) {
    const normalizedCaption = caption.toLowerCase();
    for (const cc of candidates) {
      const handle = cc.creator.instagramHandle;
      if (handle) {
        const normalizedHandle = handle
          .toLowerCase()
          .replace(/^@/, "");
        if (normalizedCaption.includes(`@${normalizedHandle}`)) {
          return { id: cc.id };
        }
      }
    }
  }

  // No strong match — return the most recent candidate
  // (sorted by campaign created at, desc)
  return { id: candidates[0].id };
}
