import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

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

    const [creators, total] = await Promise.all([
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
    ]);

    return NextResponse.json({
      creators,
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
