import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import {
  isPlaceholderFollowerCount,
  sanitizeFollowerCount,
} from "@/lib/creators/follower-count";
import { recordCreatorDiscoveryTouch } from "@/lib/creator-search/provenance";
import { validateInstagramCreators } from "@/lib/instagram/validator";
import { inngest } from "@/lib/inngest/client";

/**
 * POST /api/creators/import — Bulk import creators from CSV data.
 *
 * Body: { rows: Array<{ username, name?, email?, bio?, followerCount?, avgViews?, bioCategory?, imageUrl?, profileUrl?, engagementRate?, discoverySource? }> }
 *
 * // INVARIANT: Creators are deduplicated by instagramHandle on import
 * // INVARIANT: discoverySource is always tagged — never null
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserBySupabaseId(authUser.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      rows: Array<{
        searchResultId?: string;
        username: string;
        name?: string;
        email?: string;
        bio?: string;
        followerCount?: number;
        avgViews?: number;
        bioCategory?: string;
        rawSourceCategory?: string;
        imageUrl?: string;
        profileUrl?: string;
        engagementRate?: number;
        discoverySource?: string;
      }>;
    };

    if (!body.rows || !Array.isArray(body.rows) || body.rows.length === 0) {
      return NextResponse.json(
        { error: "No rows provided" },
        { status: 400 }
      );
    }

    // Validate rows
    const validSources = [
      "phantombuster",
      "apify",
      "collabstr",
      "csv_import",
      "manual",
      "creator_marketplace",
    ];

    const normalizedRows = body.rows.map((row) => ({
      ...row,
      username: row.username?.trim()?.replace(/^@/, "") ?? "",
    }));
    const handlesToValidate = normalizedRows
      .map((row) => row.username)
      .filter(Boolean);
    const validationResults = await validateInstagramCreators(
      handlesToValidate.map((handle) => ({ handle })),
      {
        concurrency: 1,
        includeAvgViews: false,
      }
    );
    const validationByHandle = new Map(
      validationResults.map((result) => [result.handle.toLowerCase(), result])
    );

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let invalidDropped = 0;
    let placeholderSanitized = 0;
    const enrichedCreatorIds: string[] = [];

    for (const row of normalizedRows) {
      const handle = row.username;
      if (!handle) {
        skipped++;
        continue;
      }

      const validation = validationByHandle.get(handle.toLowerCase());
      if (!validation || validation.status !== "valid") {
        invalidDropped++;
        continue;
      }

      const source = validSources.includes(row.discoverySource ?? "")
        ? row.discoverySource!
        : "csv_import";
      const searchResult = row.searchResultId
        ? await prisma.creatorSearchResult.findUnique({
            where: { id: row.searchResultId },
            select: {
              id: true,
              searchJobId: true,
              primarySource: true,
              source: true,
              rawSourceCategory: true,
              bioCategory: true,
              email: true,
              seedCreatorId: true,
              metadata: true,
            },
          })
        : null;
      const followerCountSource =
        searchResult?.primarySource ?? searchResult?.source ?? source;
      const incomingFollowerCount = validation.followerCount ?? row.followerCount;
      const normalizedFollowerCount = sanitizeFollowerCount(
        followerCountSource,
        incomingFollowerCount
      );

      if (
        incomingFollowerCount != null &&
        normalizedFollowerCount == null &&
        isPlaceholderFollowerCount(followerCountSource, incomingFollowerCount)
      ) {
        placeholderSanitized++;
      }

      // INVARIANT: Creators are deduplicated by instagramHandle on import
      const existing = await prisma.creator.findFirst({
        where: {
          brandId: membership.brandId,
          instagramHandle: handle,
        },
      });

      if (existing) {
        // Update with new data if provided
        await prisma.creator.update({
          where: { id: existing.id },
          data: {
            name: row.name || existing.name,
            email: row.email || existing.email,
            bio: row.bio || existing.bio,
            followerCount:
              normalizedFollowerCount === undefined
                ? existing.followerCount
                : normalizedFollowerCount,
            avgViews: existing.avgViews,
            bioCategory: row.bioCategory || existing.bioCategory,
            imageUrl: row.imageUrl || existing.imageUrl,
            validationStatus: "valid",
            lastValidatedAt: new Date(),
            lastValidationError: null,
            // Don't overwrite discoverySource if already set to something more specific
          },
        });

        await prisma.creatorProfile.upsert({
          where: {
            creatorId_platform: {
              creatorId: existing.id,
              platform: "instagram",
            },
          },
          update: {
            handle,
            url: validation.url || row.profileUrl || undefined,
            followerCount: normalizedFollowerCount ?? undefined,
            engagementRate: row.engagementRate ?? undefined,
          },
          create: {
            creatorId: existing.id,
            platform: "instagram",
            handle,
            url: validation.url || row.profileUrl || `https://instagram.com/${handle}`,
            followerCount: normalizedFollowerCount ?? null,
            engagementRate: row.engagementRate ?? null,
          },
        });

        await recordCreatorDiscoveryTouch({
          creatorId: existing.id,
          searchJobId: searchResult?.searchJobId ?? null,
          source:
            searchResult?.primarySource ??
            searchResult?.source ??
            source,
          externalId: handle,
          rawSourceCategory:
            searchResult?.rawSourceCategory ??
            row.rawSourceCategory ??
            row.bioCategory ??
            null,
          canonicalCategory:
            searchResult?.bioCategory ?? row.bioCategory ?? null,
          email: row.email ?? searchResult?.email ?? null,
          seedCreatorId: searchResult?.seedCreatorId ?? null,
          metadata: (searchResult?.metadata ?? null) as Prisma.InputJsonValue,
        });
        enrichedCreatorIds.push(existing.id);
        updated++;
      } else {
        // INVARIANT: discoverySource is always tagged — never null
        await prisma.creator.create({
          data: {
            instagramHandle: handle,
            name: row.name || handle,
            email: row.email || null,
            bio: row.bio || null,
            followerCount: normalizedFollowerCount ?? null,
            avgViews: null,
            bioCategory: row.bioCategory || null,
            imageUrl: row.imageUrl || null,
            discoverySource: source,
            validationStatus: "valid",
            lastValidatedAt: new Date(),
            lastValidationError: null,
            brandId: membership.brandId,
          },
        });

        // Also create CreatorProfile for instagram
        const creator = await prisma.creator.findFirst({
          where: {
            brandId: membership.brandId,
            instagramHandle: handle,
          },
        });

        if (creator) {
          await prisma.creatorProfile.upsert({
            where: {
              creatorId_platform: {
                creatorId: creator.id,
                platform: "instagram",
              },
            },
            update: {
              handle,
              url:
                validation.url ||
                row.profileUrl ||
                `https://instagram.com/${handle}`,
              followerCount: normalizedFollowerCount ?? null,
              engagementRate: row.engagementRate ?? null,
            },
            create: {
              creatorId: creator.id,
              platform: "instagram",
              handle,
              followerCount: normalizedFollowerCount ?? null,
              engagementRate: row.engagementRate ?? null,
              url:
                validation.url ||
                row.profileUrl ||
                `https://instagram.com/${handle}`,
            },
          });

          await recordCreatorDiscoveryTouch({
            creatorId: creator.id,
            searchJobId: searchResult?.searchJobId ?? null,
            source:
              searchResult?.primarySource ??
              searchResult?.source ??
              source,
            externalId: handle,
            rawSourceCategory:
              searchResult?.rawSourceCategory ??
              row.rawSourceCategory ??
              row.bioCategory ??
              null,
            canonicalCategory:
              searchResult?.bioCategory ?? row.bioCategory ?? null,
            email: row.email ?? searchResult?.email ?? null,
            seedCreatorId: searchResult?.seedCreatorId ?? null,
            metadata: (searchResult?.metadata ?? null) as Prisma.InputJsonValue,
          });
          enrichedCreatorIds.push(creator.id);
        }

        created++;
      }
    }

    if (enrichedCreatorIds.length > 0) {
      await inngest.send({
        name: "creator-avg-views/requested",
        data: {
          creatorIds: enrichedCreatorIds,
        },
      });
    }

    return NextResponse.json({
      requested: body.rows.length,
      validImported: created + updated,
      created,
      updated,
      invalidDropped,
      placeholderSanitized,
      skipped,
    });
  } catch (error) {
    console.error("[creators/import/POST]", error);
    return NextResponse.json(
      { error: "Failed to import creators" },
      { status: 500 }
    );
  }
}
