import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { assessAuthenticity } from "@/lib/metrics/authenticity";
import { computeCompositeSourceConfidence } from "@/lib/creator-search/source-confidence";

export const computeAuthenticity = inngest.createFunction(
  {
    id: "compute-authenticity",
    name: "Compute Influencer Authenticity",
    concurrency: [{ limit: 1 }],
  },
  { event: "metrics/snapshots-collected" },
  async ({ event }) => {
    const profileIds = Array.isArray(event.data?.profileIds)
      ? event.data.profileIds
      : [];

    let computed = 0;
    for (const profileId of profileIds) {
      const profile = await prisma.influencerPlatformProfile.findUnique({
        where: { id: profileId },
        include: {
          metricsDaily: {
            orderBy: { date: "desc" },
            take: 30,
          },
        },
      });
      if (!profile || profile.metricsDaily.length === 0) {
        continue;
      }

      const result = assessAuthenticity({
        snapshots: profile.metricsDaily,
        validationStatus: profile.platform === "instagram" ? "valid" : "unknown",
        sourceConfidence: computeCompositeSourceConfidence(
          Array.isArray(profile.metadata) ? [] : ((profile.metadata as { sources?: string[] } | null)?.sources ?? [])
        ),
        isVerified: profile.isVerified,
        followerCount: profile.followerCount,
        followingCount: profile.followingCount,
        postCount: profile.postCount,
        engagementRate: profile.engagementRate,
        bioText: profile.bioText,
        profileImageUrl: profile.profileImageUrl,
        websiteUrl: profile.websiteUrl,
      });

      await prisma.influencerAuthenticityAssessment.create({
        data: {
          profileId: profile.id,
          authScore: result.authScore,
          botRiskScore: result.botRiskScore,
          growthAnomalyScore: result.growthAnomalyScore,
          engagementQualityScore: result.engagementQualityScore,
          modelVersion: result.modelVersion,
          notesJson: result.notes,
          inputSnapshotCount: profile.metricsDaily.length,
        },
      });
      computed += 1;
    }

    return { computed };
  }
);
