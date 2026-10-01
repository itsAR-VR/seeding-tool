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

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * GET /api/creators/search/[jobId] — Poll search job status and results.
 */
const STALE_SEARCH_MS = 15 * 60 * 1000;

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { jobId } = await context.params;
    const membership = await getCurrentBrandMembership();

    const job = await prisma.creatorSearchJob.findFirst({
      where: {
        id: jobId,
        brandId: membership.brandId,
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

    // A search runs inside its request for at most ~13 minutes. One still
    // unfinished after 15 was cut off, so stop showing it as in progress.
    if (
      (job.status === "running" || job.status === "pending") &&
      job.createdAt.getTime() < Date.now() - STALE_SEARCH_MS
    ) {
      const stale = await prisma.creatorSearchJob.updateMany({
        where: { id: job.id, status: { in: ["running", "pending"] } },
        data: { status: "failed", error: "The search took too long and stopped. Try a narrower search.", finishedAt: new Date() },
      });
      if (stale.count > 0) {
        job.status = "failed";
        job.error = "The search took too long and stopped. Try a narrower search.";
      }
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
            "[creators/search/jobId/GET] local fallback recovery failed",
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
    console.error("[creators/search/jobId/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch job status" },
      { status: 500 }
    );
  }
}
