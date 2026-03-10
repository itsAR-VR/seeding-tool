import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { buildUnifiedDiscoveryQueryFromCampaignSearch } from "@/lib/creator-search/contracts";
import { runCampaignCreatorSearchJob } from "@/lib/workers/creator-search";

/**
 * Inngest function: Handle creator search requests (Collabstr/marketplace path).
 *
 * Listens on "creator-search/requested" but ONLY handles non-Apify sources.
 * Apify discovery is handled exclusively by `apify-creator-search`.
 *
 * 1. Picks up queued campaign discovery jobs
 * 2. Runs the Collabstr search pipeline off the request thread
 * 3. Persists validated results back into CreatorSearchJob / CreatorSearchResult
 *
 * Real scoring: the Fly worker (`podhi-seeding-creator-search.fly.dev`)
 * runs Playwright + brand-context-aware OpenAI scoring.
 * Falls back to local OpenAI scoring if the worker is unavailable.
 * Approval mode is controlled by BrandSettings.metadata.approvalMode:
 *   "recommend" — creators land in pending queue for human review (default)
 *   "auto"      — AI decision is final (opt-in)
 */
export const handleCreatorSearch = inngest.createFunction(
  {
    id: "handle-creator-search",
    name: "Handle Creator Search Request",
    retries: 1,
  },
  { event: "creator-search/requested" },
  async ({ event }) => {
    const { jobId, campaignId, brandId, criteria, discoverySource } = event.data as {
      jobId: string;
      campaignId: string;
      brandId: string;
      discoverySource?: string;
      criteria: { platform?: string; [key: string]: string | number | string[] | undefined };
    };

    // Guard: Apify searches are handled exclusively by apify-creator-search.
    // Without this guard, both functions fire for every "creator-search/requested"
    // event, causing duplicate CreatorSearchJob creates and unique-constraint noise.
    if (discoverySource === "apify") {
      return { status: "skipped", reason: "Apify path handled by apify-creator-search" };
    }

    const existingJob = await prisma.creatorSearchJob.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (!existingJob) {
      const unifiedQuery = buildUnifiedDiscoveryQueryFromCampaignSearch(
        criteria as {
          platform?: string;
          keywords?: string[];
          minFollowers?: number;
          maxFollowers?: number;
          category?: string;
          location?: string;
          limit?: number;
        }
      );
      await prisma.creatorSearchJob.create({
        data: {
          id: jobId,
          status: "pending",
          platform: (criteria.platform as string) ?? "instagram",
          campaignId: campaignId || null,
          requestedCount:
            typeof criteria.limit === "number" ? criteria.limit : 0,
          progressPercent: 0,
          query: unifiedQuery,
          brandId,
        },
      });
    }

    console.log(
      `[creator-search] Running queued job ${jobId} for campaign ${campaignId}`,
      criteria
    );

    return runCampaignCreatorSearchJob(
      campaignId,
      brandId,
      criteria,
      { jobId }
    );
  }
);
