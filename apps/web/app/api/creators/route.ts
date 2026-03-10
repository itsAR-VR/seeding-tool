import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

const STOP_WORDS = new Set([
  "about",
  "after",
  "also",
  "and",
  "beauty",
  "best",
  "brand",
  "care",
  "content",
  "creator",
  "daily",
  "email",
  "fashion",
  "fitness",
  "for",
  "from",
  "health",
  "here",
  "instagram",
  "just",
  "lifestyle",
  "love",
  "make",
  "more",
  "official",
  "real",
  "shop",
  "that",
  "the",
  "their",
  "this",
  "tips",
  "wellness",
  "with",
  "your",
]);

function incrementCount(
  counts: Map<string, number>,
  value: string | null | undefined
) {
  const normalized = value?.trim();
  if (!normalized) return;

  counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
}

function tokenizeKeywords(value: string | null | undefined) {
  if (!value) return [];

  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 3 &&
        !/^\d+$/.test(token) &&
        !STOP_WORDS.has(token)
    );
}

function sortFacetEntries(counts: Map<string, number>, limit: number) {
  return Array.from(counts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function buildCreatorFacets(
  creators: Array<{
    bio: string | null;
    bioCategory: string | null;
    instagramHandle: string | null;
  }>
) {
  const categoryCounts = new Map<string, number>();
  const keywordCounts = new Map<string, number>();
  const usernameCounts = new Map<string, number>();

  for (const creator of creators) {
    incrementCount(categoryCounts, creator.bioCategory);

    const handle = creator.instagramHandle?.trim().replace(/^@/, "") || null;
    incrementCount(usernameCounts, handle);

    const creatorKeywords = new Set<string>([
      ...tokenizeKeywords(creator.bioCategory),
      ...tokenizeKeywords(creator.bio),
    ]);

    for (const keyword of creatorKeywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) ?? 0) + 1);
    }
  }

  const keywords = sortFacetEntries(keywordCounts, 24);
  const categories = sortFacetEntries(categoryCounts, 20);
  const usernames = sortFacetEntries(usernameCounts, 40);
  const hashtags = keywords
    .slice(0, 20)
    .map(({ value, count }) => ({ value: `#${value}`, count }));

  return {
    categories,
    keywords,
    hashtags,
    usernames,
  };
}

/**
 * GET /api/creators — List and search creators for the active brand.
 *
 * Query params: search, minFollowers, maxFollowers, minViews, maxViews,
 *               category, source, page, limit
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const minFollowers = searchParams.get("minFollowers");
    const maxFollowers = searchParams.get("maxFollowers");
    const minViews = searchParams.get("minViews");
    const maxViews = searchParams.get("maxViews");
    const category = searchParams.get("category");
    const source = searchParams.get("source");
    const includeInvalid = searchParams.get("includeInvalid") === "1";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "50", 10),
      100
    );
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      brandId: membership.brandId,
    };

    if (!includeInvalid) {
      where.validationStatus = { not: "invalid" };
    }

    if (search) {
      where.OR = [
        { instagramHandle: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (minFollowers || maxFollowers) {
      where.followerCount = {};
      if (minFollowers)
        (where.followerCount as Record<string, number>).gte =
          parseInt(minFollowers, 10);
      if (maxFollowers)
        (where.followerCount as Record<string, number>).lte =
          parseInt(maxFollowers, 10);
    }

    if (minViews || maxViews) {
      where.avgViews = {};
      if (minViews)
        (where.avgViews as Record<string, number>).gte = parseInt(
          minViews,
          10
        );
      if (maxViews)
        (where.avgViews as Record<string, number>).lte = parseInt(
          maxViews,
          10
        );
    }

    if (category) {
      where.bioCategory = category;
    }

    if (source) {
      where.discoverySource = source;
    }

    const [creators, total, facetRows] = await Promise.all([
      prisma.creator.findMany({
        where,
        include: {
          profiles: true,
          campaignCreators: {
            select: {
              id: true,
              campaignId: true,
              reviewStatus: true,
              campaign: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.creator.count({ where }),
      prisma.creator.findMany({
        where: includeInvalid
          ? { brandId: membership.brandId }
          : {
              brandId: membership.brandId,
              validationStatus: { not: "invalid" },
            },
        select: {
          bio: true,
          bioCategory: true,
          instagramHandle: true,
        },
      }),
    ]);

    return NextResponse.json({
      creators,
      facets: buildCreatorFacets(facetRows),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[creators/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch creators" },
      { status: 500 }
    );
  }
}
