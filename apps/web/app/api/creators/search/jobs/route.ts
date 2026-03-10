import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { serializeCreatorSearchJob } from "@/lib/creator-search/job-payload";

const ACTIVE_STATUSES = ["pending", "running", "paused"];

/**
 * GET /api/creators/search/jobs — List active or recent creator search jobs.
 *
 * Query params:
 * - scope: active | recent (default: active)
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
    const scope = searchParams.get("scope") === "recent" ? "recent" : "active";

    const jobs = await prisma.creatorSearchJob.findMany({
      where: {
        brandId: membership.brandId,
        ...(scope === "active"
          ? { status: { in: ACTIVE_STATUSES } }
          : {}),
      },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: scope === "active" ? 10 : 25,
    });

    return NextResponse.json({
      jobs: jobs.map(serializeCreatorSearchJob),
    });
  } catch (error) {
    console.error("[creators/search/jobs/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch creator search jobs" },
      { status: 500 }
    );
  }
}
