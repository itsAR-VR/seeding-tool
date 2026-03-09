import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * GET /api/creators/search/[jobId] — Poll search job status and results.
 *
 * Returns job status and, when completed, the mapped creator results.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;

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

    const job = await prisma.creatorSearchJob.findFirst({
      where: {
        id: jobId,
        brandId: membership.brandId,
      },
      include: {
        results: {
          orderBy: { followerCount: "desc" },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      resultCount: job.resultCount,
      error: job.error,
      results:
        job.status === "completed"
          ? job.results.map((r) => ({
              id: r.id,
              handle: r.handle,
              name: r.name,
              followerCount: r.followerCount,
              engagementRate: r.engagementRate,
              profileUrl: r.profileUrl,
              imageUrl: r.imageUrl,
              bio: r.bio,
              bioCategory: r.bioCategory,
              platform: r.platform,
              fitScore: r.fitScore ?? null,
              fitReasoning: r.fitReasoning ?? null,
            }))
          : [],
    });
  } catch (error) {
    console.error("[creators/search/jobId/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 }
    );
  }
}
