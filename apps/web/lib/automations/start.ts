import type { Automation } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildUnifiedDiscoveryQueryFromAutomationConfig } from "@/lib/creator-search/contracts";
import type { CreatorSearchRequestedEvent } from "@/lib/creator-search/job-runner";

type DiscoveryConfig = {
  searchMode?: "hashtag" | "profile";
  hashtag?: string;
  usernames?: string[];
  limit?: number;
  platform?: string;
  autoImport?: boolean;
  query?: Record<string, unknown>;
  categories?: { apify?: string[]; collabstr?: string[] };
};

function toHashtag(value: string | undefined) {
  if (!value) return undefined;
  const normalized = value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");
  return normalized || undefined;
}

/**
 * Create the creator search job for a scheduled discovery automation and
 * return the event that runs it. The caller decides how it runs (Inngest when
 * configured, otherwise inline in the cron request).
 */
export async function startAutomationSearch(automation: Automation): Promise<CreatorSearchRequestedEvent> {
  const config = automation.config as DiscoveryConfig;
  const derivedHashtag =
    config.hashtag || toHashtag(config.categories?.apify?.[0]) || toHashtag(config.categories?.collabstr?.[0]);
  const limit = config.limit || 50;

  const job = await prisma.creatorSearchJob.create({
    data: {
      status: "pending",
      platform: config.platform || "instagram",
      requestedCount: limit,
      progressPercent: 0,
      query:
        config.query && typeof config.query === "object"
          ? { ...config.query, automationId: automation.id }
          : {
              searchMode: config.searchMode || "hashtag",
              hashtag: derivedHashtag,
              usernames: config.usernames,
              limit,
              categories: config.categories,
              automationId: automation.id,
            },
      brandId: automation.brandId,
    },
  });

  return {
    jobId: job.id,
    campaignId: "",
    brandId: automation.brandId,
    query: config.query
      ? config.query
      : buildUnifiedDiscoveryQueryFromAutomationConfig({
          platform: config.platform || "instagram",
          searchMode: config.searchMode || "hashtag",
          hashtag: derivedHashtag,
          usernames: config.usernames,
          limit,
          categories: config.categories,
        }),
  };
}
