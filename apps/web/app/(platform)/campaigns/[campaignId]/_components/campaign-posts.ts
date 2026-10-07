import "server-only";

import { prisma } from "@/lib/prisma";

/** One post for a campaign, from either the Instagram tag feed or a link added by hand. */
export type CampaignPost = {
  key: string;
  /** "tagged" came in from Instagram (ContentPost); "added" was logged by hand (MentionAsset). */
  source: "tagged" | "added";
  url: string | null;
  imageUrl: string | null;
  isVideoFile: boolean;
  platform: string;
  kind: string | null;
  handle: string | null;
  creatorId: string | null;
  creatorName: string | null;
  caption: string | null;
  date: Date;
};

type MentionRow = {
  id: string;
  platform: string;
  mediaUrl: string;
  type: string | null;
  caption: string | null;
  postedAt: Date | null;
  createdAt: Date;
  creator: { id: string; name: string | null; instagramHandle: string | null; tiktokHandle: string | null };
};

type ContentRow = {
  id: string;
  platform: string;
  permalink: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  caption: string | null;
  username: string | null;
  postedAt: Date | null;
  createdAt: Date;
  creator: { id: string; name: string | null } | null;
};

/** Same post, same key: drop query strings, trailing slashes, and "www." so links match. */
export function normalizePostUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return `${host}${parsed.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

/** Merge tagged posts and hand-added posts into one list: no duplicates, newest first. */
export function mergeCampaignPosts(content: ContentRow[], mentions: MentionRow[]): CampaignPost[] {
  const posts: CampaignPost[] = [];
  const seen = new Set<string>();

  for (const post of content) {
    const url = post.permalink ?? post.mediaUrl;
    const norm = normalizePostUrl(url);
    if (norm) {
      if (seen.has(norm)) continue;
      seen.add(norm);
    }
    const imageUrl = post.mediaType === "VIDEO" ? post.thumbnailUrl : post.mediaUrl;
    posts.push({
      key: `content-${post.id}`,
      source: "tagged",
      url,
      imageUrl,
      isVideoFile: Boolean(imageUrl && /\.(mp4|mov|webm)(\?|$)/i.test(imageUrl)),
      platform: post.platform,
      kind: post.mediaType === "VIDEO" ? "video" : null,
      handle: post.username,
      creatorId: post.creator?.id ?? null,
      creatorName: post.creator?.name ?? null,
      caption: post.caption,
      date: post.postedAt ?? post.createdAt,
    });
  }

  for (const mention of mentions) {
    const norm = normalizePostUrl(mention.mediaUrl);
    if (norm) {
      if (seen.has(norm)) continue;
      seen.add(norm);
    }
    posts.push({
      key: `mention-${mention.id}`,
      source: "added",
      url: mention.mediaUrl,
      imageUrl: null,
      isVideoFile: false,
      platform: mention.platform,
      kind: mention.type,
      handle:
        mention.platform === "tiktok"
          ? (mention.creator.tiktokHandle ?? mention.creator.instagramHandle)
          : (mention.creator.instagramHandle ?? mention.creator.tiktokHandle),
      creatorId: mention.creator.id,
      creatorName: mention.creator.name,
      caption: mention.caption,
      date: mention.postedAt ?? mention.createdAt,
    });
  }

  return posts.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Every post for one campaign, scoped to the brand: posts logged against the campaign,
 * plus Instagram posts that tag the brand from creators in this campaign (made after
 * they were added to it).
 */
export async function loadCampaignPosts(brandId: string, campaignId: string): Promise<CampaignPost[]> {
  const campaignCreators = await prisma.campaignCreator.findMany({
    where: { campaignId, campaign: { brandId } },
    select: { id: true, creatorId: true, createdAt: true },
  });
  if (campaignCreators.length === 0) return [];

  const [mentionAssets, contentPosts] = await Promise.all([
    prisma.mentionAsset.findMany({
      where: { campaignCreator: { campaignId, campaign: { brandId } } },
      select: {
        id: true,
        platform: true,
        mediaUrl: true,
        type: true,
        caption: true,
        postedAt: true,
        createdAt: true,
        campaignCreator: {
          select: {
            creator: { select: { id: true, name: true, instagramHandle: true, tiktokHandle: true } },
          },
        },
      },
    }),
    prisma.contentPost.findMany({
      where: {
        brandId,
        hidden: false,
        creatorId: { in: campaignCreators.map((cc) => cc.creatorId) },
      },
      select: {
        id: true,
        platform: true,
        permalink: true,
        mediaType: true,
        mediaUrl: true,
        thumbnailUrl: true,
        caption: true,
        username: true,
        postedAt: true,
        createdAt: true,
        creatorId: true,
        creator: { select: { id: true, name: true } },
      },
      orderBy: { postedAt: "desc" },
      take: 300,
    }),
  ]);

  // Only count a tagged post for this campaign if it went up after the creator joined it.
  const joinedAt = new Map(campaignCreators.map((cc) => [cc.creatorId, cc.createdAt]));
  const campaignContent = contentPosts.filter((post) => {
    const joined = post.creatorId ? joinedAt.get(post.creatorId) : undefined;
    if (!joined) return false;
    return (post.postedAt ?? post.createdAt) >= joined;
  });

  return mergeCampaignPosts(
    campaignContent,
    mentionAssets.map((m) => ({ ...m, creator: m.campaignCreator.creator }))
  );
}
