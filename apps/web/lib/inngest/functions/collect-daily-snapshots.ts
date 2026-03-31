import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { recordMetricsSnapshot } from "@/lib/metrics/snapshot";

export const collectDailySnapshots = inngest.createFunction(
  {
    id: "collect-daily-snapshots",
    name: "Collect Daily Influencer Snapshots",
    concurrency: [{ limit: 1 }],
  },
  { cron: "0 6 * * *" },
  async () => {
    const profiles = await prisma.influencerPlatformProfile.findMany({
      where: {
        OR: [
          { platform: "instagram" },
          {
            followerCount: { not: null },
          },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    for (const profile of profiles) {
      await recordMetricsSnapshot({
        profileId: profile.id,
        date: new Date(),
        followers: profile.followerCount,
        following: profile.followingCount,
        posts: profile.postCount,
        avgViews: profile.avgViews,
        engagementRate: profile.engagementRate,
        source: profile.platform === "instagram" ? "instagram_validated" : "manual",
      });
    }

    await inngest.send({
      name: "metrics/snapshots-collected",
      data: {
        profileIds: profiles.map((profile) => profile.id),
      },
    });

    return { collected: profiles.length };
  }
);
