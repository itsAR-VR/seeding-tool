import { after, NextRequest, NextResponse } from "next/server";
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
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = { params: Promise<{ campaignId: string; jobId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { campaignId, jobId } = await context.params;
    const membership = await getCurrentBrandMembership();

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
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[campaigns/search/jobId/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign search job status" },
      { status: 500 }
    );
  }
}
