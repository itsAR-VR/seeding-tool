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
import { recordCreatorDiscoveryTouch } from "@/lib/creator-search/provenance";
import { validateInstagramCreators } from "@/lib/instagram/validator";

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
      data: {
        status: "running",
        startedAt: new Date(),
        progressPercent: 10,
      },
    });

    try {
      const searchMode = criteria.searchMode || "profile";
      let datasetId: string;

      const requestedCount = criteria.limit || 50;

      if (searchMode === "hashtag" && criteria.hashtag) {
        const result = await runInstagramHashtagScraper(
          criteria.hashtag,
          requestedCount * 3
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

      const validationResults = await validateInstagramCreators(
        mapped.map((creator) => ({
          handle: creator.handle,
        })),
        {
          concurrency: 1,
          includeAvgViews: false,
        }
      );
      const validationByHandle = new Map(
        validationResults.map((result) => [result.handle.toLowerCase(), result])
      );

      const validatedMapped = mapped.map((creator) => {
        const validation = validationByHandle.get(creator.handle.toLowerCase());
        return {
          ...creator,
          validationStatus: validation?.status ?? "invalid",
          validationError: validation?.error ?? "missing_profile",
          validatedFollowerCount: validation?.followerCount ?? null,
          validatedAvgViews: validation?.avgViews ?? null,
        };
      });

      const validMapped = validatedMapped.filter(
        (creator) => creator.validationStatus === "valid"
      );
      const invalidMapped = validatedMapped.filter(
        (creator) => creator.validationStatus === "invalid"
      );

      // Store CreatorSearchResult records
      for (const c of [...validMapped, ...invalidMapped]) {
        await prisma.creatorSearchResult.create({
          data: {
            platform: "instagram",
            handle: c.handle,
            source: c.source,
            primarySource: c.primarySource,
            sources: c.sources as Prisma.InputJsonValue,
            name: c.name,
            followerCount: c.followerCount,
            engagementRate: c.engagementRate,
            profileUrl: c.profileUrl,
            imageUrl: c.imageUrl,
            bio: c.bio,
            email: c.email,
            bioCategory: c.bioCategory,
            rawSourceCategory: c.rawSourceCategory,
            seedCreatorId: c.seedCreatorId,
            metadata: c.metadata as Prisma.InputJsonValue,
            validationStatus: c.validationStatus,
            validationError: c.validationError,
            validatedFollowerCount: c.validatedFollowerCount,
            validatedAvgViews: c.validatedAvgViews,
            searchJobId: jobId,
          },
        });
      }

      // Create Creator records for new discoveries
      // INVARIANT: Creators are deduplicated by instagramHandle on import
      let created = 0;

      for (const c of validMapped.slice(0, requestedCount)) {
        const existing = await prisma.creator.findFirst({
          where: {
            brandId,
            instagramHandle: c.handle,
          },
        });

        const creator = existing
          ? await prisma.creator.update({
              where: { id: existing.id },
              data: {
                name: c.name || existing.name,
                bio: c.bio ?? existing.bio,
                bioCategory: c.bioCategory ?? existing.bioCategory,
                imageUrl: c.imageUrl ?? existing.imageUrl,
                followerCount: c.validatedFollowerCount ?? c.followerCount,
                validationStatus: "valid",
                lastValidatedAt: new Date(),
                lastValidationError: null,
                discoverySource: existing.discoverySource || "apify",
              },
            })
          : await prisma.creator.create({
              data: {
                instagramHandle: c.handle,
                name: c.name || c.handle,
                bio: c.bio,
                bioCategory: c.bioCategory,
                imageUrl: c.imageUrl,
                followerCount: c.validatedFollowerCount ?? c.followerCount,
                validationStatus: "valid",
                lastValidatedAt: new Date(),
                lastValidationError: null,
                discoverySource: "apify",
                brandId,
              },
            });

        await prisma.creatorProfile.upsert({
          where: {
            creatorId_platform: {
              creatorId: creator.id,
              platform: "instagram",
            },
          },
          update: {
            handle: c.handle,
            url: c.profileUrl || `https://instagram.com/${c.handle}`,
            followerCount: c.validatedFollowerCount ?? c.followerCount,
            engagementRate: c.engagementRate,
            isVerified: c.isVerified,
            metadata: {
              ...(c.metadata as Record<string, unknown>),
              validationStatus: c.validationStatus,
              validationError: c.validationError,
            } as Prisma.InputJsonValue,
          },
          create: {
            creatorId: creator.id,
            platform: "instagram",
            handle: c.handle,
            url: c.profileUrl || `https://instagram.com/${c.handle}`,
            followerCount: c.validatedFollowerCount ?? c.followerCount,
            engagementRate: c.engagementRate,
            isVerified: c.isVerified,
            metadata: {
              ...(c.metadata as Record<string, unknown>),
              validationStatus: c.validationStatus,
              validationError: c.validationError,
            } as Prisma.InputJsonValue,
          },
        });

        await recordCreatorDiscoveryTouch({
          creatorId: creator.id,
          source: c.source,
          searchJobId: jobId,
          externalId: c.handle,
          rawSourceCategory: c.rawSourceCategory,
          canonicalCategory: c.bioCategory,
          email: c.email,
          seedCreatorId: c.seedCreatorId,
          metadata: {
            ...c.metadata,
            primarySource: c.primarySource,
            sources: c.sources,
          } as Prisma.InputJsonValue,
        });

        if (!existing) {
          created++;
        }
      }

      // Update search job
      const finalStatus =
        validMapped.length >= requestedCount
          ? "completed"
          : "completed_with_shortfall";
      await prisma.creatorSearchJob.update({
        where: { id: jobId },
        data: {
          status: finalStatus,
          candidateCount: mapped.length,
          validatedCount: validMapped.length,
          invalidCount: invalidMapped.length,
          resultCount: validMapped.length,
          progressPercent: 100,
          etaSeconds: 0,
          finishedAt: new Date(),
        },
      });

      console.log(
        `[apify-creator-search] Job ${jobId}: ${mapped.length} candidates, ${validMapped.length} valid, ${invalidMapped.length} invalid, ${created} new creators`
      );

      return {
        jobId,
        status: finalStatus,
        resultCount: validMapped.length,
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
          finishedAt: new Date(),
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
