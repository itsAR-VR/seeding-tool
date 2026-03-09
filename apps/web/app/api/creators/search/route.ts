import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";

/**
 * POST /api/creators/search — Start an Apify creator discovery search.
 *
 * Body: { searchMode: "hashtag" | "profile", hashtag?: string, usernames?: string[], limit?: number, platform?: string }
 *
 * Returns a jobId for polling via GET /api/creators/search/[jobId].
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
      searchMode: "hashtag" | "profile";
      hashtag?: string;
      usernames?: string[];
      limit?: number;
      platform?: string;
    };

    const { searchMode, hashtag, usernames, limit = 50, platform = "instagram" } = body;

    // Validate input
    if (searchMode === "hashtag" && !hashtag?.trim()) {
      return NextResponse.json(
        { error: "Hashtag is required for hashtag search" },
        { status: 400 }
      );
    }

    if (searchMode === "profile" && (!usernames || usernames.length === 0)) {
      return NextResponse.json(
        { error: "At least one username is required for profile search" },
        { status: 400 }
      );
    }

    // Create a search job record
    const job = await prisma.creatorSearchJob.create({
      data: {
        status: "pending",
        platform,
        query: {
          searchMode,
          hashtag: hashtag?.replace(/^#/, "").trim(),
          usernames: usernames?.map((u) => u.trim().replace(/^@/, "")),
          limit,
        },
        brandId: membership.brandId,
      },
    });

    // Fire Inngest event to run the Apify search
    await inngest.send({
      name: "creator-search/requested",
      data: {
        jobId: job.id,
        campaignId: "", // standalone search, not campaign-bound
        brandId: membership.brandId,
        discoverySource: "apify",
        criteria: {
          platform,
          searchMode,
          hashtag: hashtag?.replace(/^#/, "").trim(),
          usernames: usernames?.map((u) => u.trim().replace(/^@/, "")),
          limit,
        },
      },
    });

    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (error) {
    console.error("[creators/search/POST]", error);
    return NextResponse.json(
      { error: "Failed to start search" },
      { status: 500 }
    );
  }
}
