import { prisma } from "@/lib/prisma";
import { uploadMentionMedia } from "@/lib/supabase/storage";
import { getMentionedMedia, getMessagingUser } from "@/lib/instagram/client";
import { findCreatorId, loadInstagramCredential } from "@/lib/content/sync";

/** Subset of the Instagram webhook payload we use. */
export type InstagramWebhookBody = {
  object?: string;
  entry?: Array<{
    id: string; // the brand's Instagram account ID
    time?: number;
    changes?: Array<{
      field: string;
      value?: { media_id?: string; comment_id?: string };
    }>;
    messaging?: Array<{
      sender?: { id: string };
      timestamp?: number;
      message?: {
        mid?: string;
        is_echo?: boolean;
        attachments?: Array<{ type?: string; payload?: { url?: string } }>;
      };
    }>;
  }>;
};

async function findBrandIdForAccount(igUserId: string): Promise<string | null> {
  const connection = await prisma.brandConnection.findFirst({
    where: {
      provider: "instagram",
      status: "connected",
      metadata: { path: ["igUserId"], equals: igUserId },
    },
    select: { brandId: true },
  });
  return connection?.brandId ?? null;
}

async function alreadySaved(brandId: string, externalId: string): Promise<boolean> {
  const existing = await prisma.contentPost.findUnique({
    where: { brandId_platform_externalId: { brandId, platform: "instagram", externalId } },
    select: { id: true },
  });
  return existing !== null;
}

/**
 * A creator mentioned the brand in their Story. Stories vanish after 24 hours
 * and the URL Meta sends expires, so the media is copied to our storage now.
 */
async function saveStoryMention(
  brandId: string,
  event: NonNullable<NonNullable<InstagramWebhookBody["entry"]>[number]["messaging"]>[number]
): Promise<void> {
  const mid = event.message?.mid;
  const attachment = event.message?.attachments?.find((a) => a.type === "story_mention");
  const sourceUrl = attachment?.payload?.url;
  if (!mid || !sourceUrl || event.message?.is_echo) return;
  if (await alreadySaved(brandId, mid)) return;

  const credential = await loadInstagramCredential(brandId);
  let username: string | undefined;
  if (credential && event.sender?.id) {
    const sender = await getMessagingUser(event.sender.id, credential.accessToken).catch(
      () => null
    );
    username = sender?.username;
  }

  const archivedUrl = await uploadMentionMedia(
    `story-${mid.replace(/[^A-Za-z0-9_-]/g, "").slice(-40)}`,
    sourceUrl,
    brandId,
    "content"
  );

  await prisma.contentPost.create({
    data: {
      brandId,
      platform: "instagram",
      externalId: mid,
      mediaType: "STORY",
      mediaUrl: archivedUrl,
      username: username ?? null,
      postedAt: event.timestamp ? new Date(event.timestamp) : new Date(),
      source: "story",
      creatorId: await findCreatorId(brandId, username),
    },
  });
}

/** A creator @mentioned the brand in a post caption (not a photo tag). */
async function saveCaptionMention(brandId: string, mediaId: string): Promise<void> {
  if (await alreadySaved(brandId, mediaId)) return;
  const credential = await loadInstagramCredential(brandId);
  if (!credential) return;

  const media = await getMentionedMedia(credential.igUserId, mediaId, credential.accessToken);
  await prisma.contentPost.create({
    data: {
      brandId,
      platform: "instagram",
      externalId: media.id ?? mediaId,
      mediaType: media.media_type ?? null,
      mediaUrl: media.media_url ?? null,
      thumbnailUrl: media.thumbnail_url ?? null,
      caption: media.caption ?? null,
      username: media.username ?? null,
      postedAt: media.timestamp ? new Date(media.timestamp) : null,
      source: "mention",
      creatorId: await findCreatorId(brandId, media.username),
    },
  });
}

/** Saves every story mention and caption mention in a webhook delivery. */
export async function handleInstagramWebhook(body: InstagramWebhookBody): Promise<void> {
  for (const entry of body.entry ?? []) {
    const brandId = await findBrandIdForAccount(entry.id);
    if (!brandId) {
      console.warn("[instagram-webhook] No brand for Instagram account", entry.id);
      continue;
    }

    for (const event of entry.messaging ?? []) {
      await saveStoryMention(brandId, event).catch((error) =>
        console.error("[instagram-webhook] Story mention failed:", error)
      );
    }

    for (const change of entry.changes ?? []) {
      // A comment_id means they mentioned us in a comment, not in their own post.
      if (change.field !== "mentions" || !change.value?.media_id || change.value.comment_id) continue;
      await saveCaptionMention(brandId, change.value.media_id).catch((error) =>
        console.error("[instagram-webhook] Caption mention failed:", error)
      );
    }
  }
}
