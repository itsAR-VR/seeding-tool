import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import {
  isTerminalCreatorSearchStatus,
  selectSelectableCreatorSearchResults,
  serializeCreatorSearchJob,
  serializeCreatorSearchResult,
} from "@/lib/creator-search/job-payload";
import {
  isLocalCreatorSearchFallbackEnabled,
  scheduleLocalCreatorSearchJob,
  shouldAttemptLocalCreatorSearchFallback,
} from "@/lib/creator-search/local-fallback";

type RouteContext = { params: Promise<{ campaignId: string; jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { campaignId, jobId } = await context.params;

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
        campaignId,
      },
      include: {
        results: {
          orderBy: [{ fitScore: "desc" }, { followerCount: "desc" }],
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (
      isLocalCreatorSearchFallbackEnabled() &&
      job.status === "pending" &&
      job.requestedCount > 0 &&
      shouldAttemptLocalCreatorSearchFallback(job.startedAt)
    ) {
      after(async () => {
        try {
          await scheduleLocalCreatorSearchJob({
            jobId: job.id,
            brandId: membership.brandId,
            campaignId: job.campaignId,
          });
        } catch (error) {
          console.error(
            "[campaigns/search/jobId/GET] local fallback recovery failed",
            error
          );
        }
      });
    }

    const serializedJob = serializeCreatorSearchJob(job);
    const selectableResults = selectSelectableCreatorSearchResults(job.results);

    return NextResponse.json({
      ...serializedJob,
      results: isTerminalCreatorSearchStatus(job.status)
        ? selectableResults.map(serializeCreatorSearchResult)
        : [],
    });
  } catch (error) {
    console.error("[campaigns/search/jobId/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign search job status" },
      { status: 500 }
    );
  }
}
