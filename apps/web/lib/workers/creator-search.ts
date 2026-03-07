import { inngest } from "@/lib/inngest/client";

/**
 * Stub for the Playwright-based creator search worker.
 *
 * In production, this will launch a browser session against Meta Creator
 * Marketplace or Instagram search to find creators matching the criteria.
 * For now, it emits an Inngest event that creates a tracking intervention.
 *
 * The real browser automation is deferred until hosting decision is finalized.
 */

type SearchCriteria = {
  platform?: string;
  keywords?: string[];
  minFollowers?: number;
  maxFollowers?: number;
  category?: string;
  location?: string;
};

/**
 * Queue a creator search job for a campaign.
 *
 * @returns jobId for tracking
 */
export async function searchCreatorsForCampaign(
  campaignId: string,
  brandId: string,
  criteria: SearchCriteria
): Promise<{ status: "queued"; jobId: string }> {
  const jobId = crypto.randomUUID();

  // Emit Inngest event — the real Playwright worker will plug in here later
  await inngest.send({
    name: "creator-search/requested",
    data: {
      jobId,
      campaignId,
      brandId,
      criteria,
    },
  });

  return { status: "queued", jobId };
}
