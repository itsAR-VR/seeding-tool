import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";

/**
 * Inngest function: Handle creator search requests.
 *
 * Listens on "creator-search/requested" and:
 * 1. Creates a CreatorSearchJob record for tracking
 * 2. Creates an InterventionCase so operators can monitor queued searches
 *
 * Real scoring: the Fly worker (`podhi-seeding-creator-search.fly.dev`)
 * runs Playwright + brand-context-aware OpenAI scoring.
 * Falls back to local OpenAI scoring if the worker is unavailable.
 * Approval mode is controlled by BrandSettings.metadata.approvalMode:
 *   "auto"      — AI decision is final (default)
 *   "recommend" — creators land in pending queue for human review
 */
export const handleCreatorSearch = inngest.createFunction(
  {
    id: "handle-creator-search",
    name: "Handle Creator Search Request",
    retries: 1,
  },
  { event: "creator-search/requested" },
  async ({ event }) => {
    const { jobId, campaignId, brandId, criteria } = event.data as {
      jobId: string;
      campaignId: string;
      brandId: string;
      criteria: { platform?: string; [key: string]: string | number | string[] | undefined };
    };

    // Create search job record
    const searchJob = await prisma.creatorSearchJob.create({
      data: {
        id: jobId,
        status: "pending",
        platform: (criteria.platform as string) ?? "instagram",
        query: criteria as Record<string, string | number | string[]>,
        brandId,
      },
    });

    // Create intervention so operators can track the search
    await prisma.interventionCase.create({
      data: {
        type: "manual_review",
        status: "open",
        priority: "normal",
        title: `Creator search queued for campaign`,
        description: `Search job ${searchJob.id} queued with criteria: ${JSON.stringify(criteria)}. Campaign: ${campaignId}. Worker: podhi-seeding-creator-search.fly.dev.`,
        brandId,
      },
    });

    console.log(
      `[creator-search] Job ${jobId} created for campaign ${campaignId}`,
      criteria
    );

    return { jobId: searchJob.id, status: "pending" };
  }
);
