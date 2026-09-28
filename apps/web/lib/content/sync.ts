import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import {
  getTaggedMedia,
  fetchNextPage,
  InstagramApiError,
  type InstagramMedia,
  type InstagramPaginatedResponse,
} from "@/lib/instagram/client";

/** Pages of tags to read per sync. Each page is ~25 posts. */
const MAX_PAGES = 5;

export type ContentSyncResult = {
  connected: boolean;
  newPosts: number;
  updated: number;
  error?: string;
};

type InstagramCredential = { accessToken: string; igUserId: string };

async function loadInstagramCredential(brandId: string): Promise<InstagramCredential | null> {
  const [credential, connection] = await Promise.all([
    prisma.providerCredential.findFirst({
      where: { brandId, provider: "instagram", credentialType: "oauth_access_token", isValid: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.brandConnection.findFirst({
      where: { brandId, provider: "instagram", status: "connected" },
    }),
  ]);
  if (!credential || !connection) return null;

  const payload = JSON.parse(decrypt(credential.encryptedValue)) as {
    accessToken?: string;
    igUserId?: string;
  };
  const metadata = connection.metadata as { igUserId?: string } | null;
  const igUserId = metadata?.igUserId ?? payload.igUserId;
  if (!payload.accessToken || !igUserId) return null;
  return { accessToken: payload.accessToken, igUserId };
}

/** Finds the brand's creator with this Instagram handle, stored with or without "@". */
async function findCreatorId(brandId: string, username: string | undefined): Promise<string | null> {
  if (!username) return null;
  const handle = username.replace(/^@/, "");
  const creator = await prisma.creator.findFirst({
    where: {
      brandId,
      OR: [
        { instagramHandle: { equals: handle, mode: "insensitive" } },
        { instagramHandle: { equals: `@${handle}`, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return creator?.id ?? null;
}

/**
 * Pulls posts that tag the brand's Instagram account into the content library.
 * Existing posts get fresh stats and media URLs (Instagram's URLs expire).
 */
export async function syncContentForBrand(brandId: string): Promise<ContentSyncResult> {
  const credential = await loadInstagramCredential(brandId);
  if (!credential) return { connected: false, newPosts: 0, updated: 0 };

  let newPosts = 0;
  let updated = 0;

  try {
    let page: InstagramPaginatedResponse<InstagramMedia> = await getTaggedMedia(
      credential.igUserId,
      credential.accessToken
    );

    for (let pageCount = 1; ; pageCount++) {
      let pageHadNew = false;

      for (const media of page.data ?? []) {
        const fields = {
          permalink: media.permalink ?? null,
          mediaType: media.media_type ?? null,
          mediaUrl: media.media_url ?? null,
          thumbnailUrl: media.thumbnail_url ?? null,
          caption: media.caption ?? null,
          likes: media.like_count ?? null,
          comments: media.comments_count ?? null,
        };

        const existing = await prisma.contentPost.findUnique({
          where: {
            brandId_platform_externalId: { brandId, platform: "instagram", externalId: media.id },
          },
          select: { id: true, creatorId: true },
        });

        if (existing) {
          await prisma.contentPost.update({
            where: { id: existing.id },
            data: {
              ...fields,
              creatorId: existing.creatorId ?? (await findCreatorId(brandId, media.username)),
            },
          });
          updated++;
          continue;
        }

        await prisma.contentPost.create({
          data: {
            ...fields,
            brandId,
            platform: "instagram",
            externalId: media.id,
            username: media.username ?? null,
            postedAt: media.timestamp ? new Date(media.timestamp) : null,
            source: "tag",
            creatorId: await findCreatorId(brandId, media.username),
          },
        });
        newPosts++;
        pageHadNew = true;
      }

      // Tags come newest first, so a page with nothing new means we're caught up.
      if (!pageHadNew || !page.paging?.next || pageCount >= MAX_PAGES) break;
      page = await fetchNextPage<InstagramMedia>(page.paging.next);
    }
  } catch (error) {
    if (error instanceof InstagramApiError) {
      console.error("[content/sync] Instagram API error", error.code, error.message);
      const expired = error.code === 190;
      return {
        connected: true,
        newPosts,
        updated,
        error: expired ? "Instagram connection expired. Reconnect it in Settings." : error.message,
      };
    }
    throw error;
  }

  return { connected: true, newPosts, updated };
}
