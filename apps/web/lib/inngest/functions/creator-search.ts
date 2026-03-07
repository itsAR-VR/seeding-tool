import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";

/**
 * Inngest function: Handle creator search requests.
 *
 * Listens on "creator-search/requested" and:
 * 1. Creates a CreatorSearchJob record for tracking
 * 2. Creates an InterventionCase so operators know a search was queued
 * 3. Logs the criteria for the future Playwright worker integration
 *
 * The real Playwright worker will plug in here — this stub ensures the
 * event pipeline and tracking infrastructure exist.
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

    // Create intervention so operators can see the search was queued
    await prisma.interventionCase.create({
      data: {
        type: "manual_review",
        status: "open",
        priority: "normal",
        title: `Creator search queued for campaign`,
        description: `Search job ${searchJob.id} queued with criteria: ${JSON.stringify(criteria)}. Campaign: ${campaignId}. Playwright worker stub — real browser automation not yet connected.`,
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
