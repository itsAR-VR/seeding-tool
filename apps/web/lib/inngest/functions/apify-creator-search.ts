import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  runInstagramProfileScraper,
  runInstagramHashtagScraper,
  getDatasetItems,
  mapProfileToCreator,
  mapHashtagPostToCreator,
  type MappedCreatorData,
} from "@/lib/apify/client";

/**
 * Inngest function: Apify-powered creator discovery.
 *
 * Listens on "creator-search/requested" and handles discoverySource === "apify".
 *
 * Supports two search modes:
 * - "profile": scrape specific Instagram usernames
 * - "hashtag": discover creators posting under a hashtag
 *
 * 1. Updates CreatorSearchJob status to "running"
 * 2. Runs the appropriate Apify actor
 * 3. Maps results → CreatorSearchResult records
 * 4. Creates Creator records for new discoveries
 * 5. Marks job as "completed"
 *
 * // INVARIANT: Creators are deduplicated by instagramHandle on import
 * // INVARIANT: discoverySource is always tagged — never null
 */
export const apifyCreatorSearch = inngest.createFunction(
  {
    id: "apify-creator-search",
    name: "Apify Creator Search",
    retries: 2,
    concurrency: [{ limit: 3 }],
  },
  { event: "creator-search/requested" },
  async ({ event }) => {
    const {
      jobId,
      campaignId,
      brandId,
      criteria,
      discoverySource,
    } = event.data as {
      jobId: string;
      campaignId: string;
      brandId: string;
      discoverySource?: string;
      criteria: {
        platform?: string;
        searchMode?: "profile" | "hashtag";
        usernames?: string[];
        hashtag?: string;
        limit?: number;
        [key: string]: unknown;
      };
    };

    // Only handle Apify discovery source
    if (discoverySource !== "apify") {
      return { status: "skipped", reason: "Not an Apify search" };
    }

    // Mark job as running
    await prisma.creatorSearchJob.update({
      where: { id: jobId },
      data: { status: "running" },
    });

    try {
      const searchMode = criteria.searchMode || "profile";
      let datasetId: string;

      if (searchMode === "hashtag" && criteria.hashtag) {
        const result = await runInstagramHashtagScraper(
          criteria.hashtag,
          criteria.limit || 50
        );
        datasetId = result.datasetId;
      } else if (
        searchMode === "profile" &&
        criteria.usernames &&
        criteria.usernames.length > 0
      ) {
        const result = await runInstagramProfileScraper(criteria.usernames);
        datasetId = result.datasetId;
      } else {
        throw new Error(
          `Invalid Apify search criteria: mode=${searchMode}, ` +
            `usernames=${criteria.usernames?.length ?? 0}, hashtag=${criteria.hashtag || "none"}`
        );
      }

      // Retrieve results
      const items = await getDatasetItems(datasetId);

      // Map to creator data
      const mapFn =
        searchMode === "hashtag"
          ? mapHashtagPostToCreator
          : mapProfileToCreator;

      const mapped: MappedCreatorData[] = [];
      const seenHandles = new Set<string>();

      for (const item of items) {
        const creator = mapFn(item as Record<string, unknown>);
        if (creator && !seenHandles.has(creator.handle)) {
          seenHandles.add(creator.handle);
          mapped.push(creator);
        }
      }

      // Store CreatorSearchResult records
      for (const c of mapped) {
        await prisma.creatorSearchResult.create({
          data: {
            platform: "instagram",
            handle: c.handle,
            name: c.name,
            followerCount: c.followerCount,
            engagementRate: c.engagementRate,
            profileUrl: c.profileUrl,
            imageUrl: c.imageUrl,
            bio: c.bio,
            metadata: c.metadata as Prisma.InputJsonValue,
            searchJobId: jobId,
          },
        });
      }

      // Create Creator records for new discoveries
      // INVARIANT: Creators are deduplicated by instagramHandle on import
      let created = 0;

      for (const c of mapped) {
        const existing = await prisma.creator.findFirst({
          where: {
            brandId,
            instagramHandle: c.handle,
          },
        });

        if (!existing) {
          // INVARIANT: discoverySource is always tagged — never null
          const newCreator = await prisma.creator.create({
            data: {
              instagramHandle: c.handle,
              name: c.name || c.handle,
              bio: c.bio,
              imageUrl: c.imageUrl,
              followerCount: c.followerCount,
              discoverySource: "apify",
              brandId,
            },
          });

          // Create CreatorProfile for instagram
          await prisma.creatorProfile.upsert({
            where: {
              creatorId_platform: {
                creatorId: newCreator.id,
                platform: "instagram",
              },
            },
            update: {
              handle: c.handle,
              followerCount: c.followerCount,
              engagementRate: c.engagementRate,
              isVerified: c.isVerified,
              metadata: c.metadata as Prisma.InputJsonValue,
            },
            create: {
              creatorId: newCreator.id,
              platform: "instagram",
              handle: c.handle,
              url: c.profileUrl || `https://instagram.com/${c.handle}`,
              followerCount: c.followerCount,
              engagementRate: c.engagementRate,
              isVerified: c.isVerified,
              metadata: c.metadata as Prisma.InputJsonValue,
            },
          });

          created++;
        }
      }

      // Update search job
      await prisma.creatorSearchJob.update({
        where: { id: jobId },
        data: {
          status: "completed",
          resultCount: mapped.length,
        },
      });

      console.log(
        `[apify-creator-search] Job ${jobId}: ${mapped.length} results, ${created} new creators`
      );

      return {
        jobId,
        status: "completed",
        resultCount: mapped.length,
        newCreators: created,
      };
    } catch (error) {
      const errMsg =
        error instanceof Error ? error.message : "Unknown error";

      await prisma.creatorSearchJob.update({
        where: { id: jobId },
        data: {
          status: "failed",
          error: errMsg,
        },
      });

      // Create intervention for operator review
      await prisma.interventionCase.create({
        data: {
          type: "other",
          status: "open",
          priority: "normal",
          title: `Apify creator search failed`,
          description: `Search job ${jobId} failed: ${errMsg}. Campaign: ${campaignId}.`,
          brandId,
        },
      });

      throw error; // Let Inngest handle retries
    }
  }
);
