import { prisma } from "@/lib/prisma";
import { computeCompositeSourceConfidence } from "@/lib/creator-search/source-confidence";

export type MetricsSnapshotInput = {
  profileId: string;
  date: Date;
  followers?: number | null;
  following?: number | null;
  posts?: number | null;
  avgViews?: number | null;
  engagementRate?: number | null;
  likes?: number | null;
  comments?: number | null;
  source: string;
};

function dayKey(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function recordMetricsSnapshot(input: MetricsSnapshotInput) {
  const date = dayKey(input.date);

  return prisma.influencerMetricsDaily.upsert({
    where: {
      profileId_date: {
        profileId: input.profileId,
        date,
      },
    },
    update: {
      followers: input.followers ?? undefined,
      following: input.following ?? undefined,
      posts: input.posts ?? undefined,
      avgViews: input.avgViews ?? undefined,
      engagementRate: input.engagementRate ?? undefined,
      likes: input.likes ?? undefined,
      comments: input.comments ?? undefined,
      source: input.source,
      sourceConfidence: computeCompositeSourceConfidence([input.source]),
    },
    create: {
      profileId: input.profileId,
      date,
      followers: input.followers ?? null,
      following: input.following ?? null,
      posts: input.posts ?? null,
      avgViews: input.avgViews ?? null,
      engagementRate: input.engagementRate ?? null,
      likes: input.likes ?? null,
      comments: input.comments ?? null,
      source: input.source,
      sourceConfidence: computeCompositeSourceConfidence([input.source]),
    },
  });
}

export async function recordOpportunisticSnapshot(input: {
  handle: string;
  platform: string;
  metrics: Omit<MetricsSnapshotInput, "profileId" | "date" | "source"> & { date?: Date };
  source: string;
}) {
  const normalizedHandle = input.handle.trim().replace(/^@/, "").toLowerCase();
  const profile = await prisma.influencerPlatformProfile.findUnique({
    where: {
      platform_normalizedHandle: {
        platform: input.platform,
        normalizedHandle,
      },
    },
    select: { id: true },
  });

  if (!profile) {
    return null;
  }

  return recordMetricsSnapshot({
    profileId: profile.id,
    date: input.metrics.date ?? new Date(),
    followers: input.metrics.followers,
    following: input.metrics.following,
    posts: input.metrics.posts,
    avgViews: input.metrics.avgViews,
    engagementRate: input.metrics.engagementRate,
    likes: input.metrics.likes,
    comments: input.metrics.comments,
    source: input.source,
  });
}
