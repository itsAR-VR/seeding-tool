import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildCreatorFacets } from "@/lib/creators/facets";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * GET /api/creators — List and search creators for the active brand.
 */
export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();

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
          discoveryTouches: {
            select: {
              metadata: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          },
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
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[creators/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch creators" },
      { status: 500 }
    );
  }
}
