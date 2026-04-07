import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import {
  buildUnifiedDiscoveryQueryFromManualSearch,
  normalizeUnifiedDiscoveryQuery,
  type UnifiedDiscoveryQuery,
} from "@/lib/creator-search/contracts";
import {
  isLocalCreatorSearchFallbackEnabled,
  scheduleLocalCreatorSearchJob,
} from "@/lib/creator-search/local-fallback";
import {
  ensureCredits,
  debit,
  mint,
  CREDIT_COSTS,
  CreditInsufficientError,
  isCreditEnforcementEnabled,
} from "@/lib/credits";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * POST /api/creators/search — Start an Apify creator discovery search.
 *
 * Body: { searchMode: "hashtag" | "profile", hashtag?: string, usernames?: string[], limit?: number, platform?: string }
 *
 * Returns a jobId for polling via GET /api/creators/search/[jobId].
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    // 1. Parse and validate request body BEFORE debiting credits
    const body = (await request.json()) as {
      sources?: string[];
      keywords?: string[];
      canonicalCategories?: string[];
      filters?: Record<string, unknown>;
      location?: string;
      emailPrefetch?: boolean;
      seedExpansion?: Record<string, unknown>;
      searchMode: "hashtag" | "profile";
      hashtag?: string;
      usernames?: string[];
      limit?: number;
      platform?: string;
    };

    const {
      searchMode,
      hashtag,
      usernames,
      platform = "instagram",
    } = body;

    const unifiedQuery =
      Array.isArray(body.sources) || Array.isArray(body.keywords)
        ? normalizeUnifiedDiscoveryQuery(body as Partial<UnifiedDiscoveryQuery>)
        : buildUnifiedDiscoveryQueryFromManualSearch(body);

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

    // 2. Create search job record BEFORE debiting (so debit only happens for valid requests)
    const job = await prisma.creatorSearchJob.create({
      data: {
        status: "pending",
        platform,
        requestedCount: unifiedQuery.limit,
        progressPercent: 0,
        query: unifiedQuery,
        brandId: membership.brandId,
      },
    });

    // 3. Credit enforcement: debit AFTER validation and job creation
    if (isCreditEnforcementEnabled()) {
      const estimatedCost = CREDIT_COSTS.creator_search;
      try {
        await ensureCredits(membership.brandId, estimatedCost);
        await debit(
          membership.brandId,
          estimatedCost,
          "creator_search_reservation",
          { type: "reservation", jobId: job.id }
        );
      } catch (error) {
        if (error instanceof CreditInsufficientError) {
          // Clean up the job since we can't pay for it
          await prisma.creatorSearchJob.delete({ where: { id: job.id } });
          return NextResponse.json(
            {
              error: "Insufficient credits for search",
              required: error.required,
              available: error.available,
            },
            { status: 402 }
          );
        }
        throw error;
      }
    }

    try {
      await inngest.send({
        name: "creator-search/requested",
        data: {
          jobId: job.id,
          campaignId: "", // standalone search, not campaign-bound
          brandId: membership.brandId,
          query: unifiedQuery,
        },
      });
    } catch (dispatchError) {
      if (!isLocalCreatorSearchFallbackEnabled()) {
        // Dispatch failed with no fallback — refund credits and fail the job
        if (isCreditEnforcementEnabled()) {
          await mint(
            membership.brandId,
            CREDIT_COSTS.creator_search,
            "creator_search_dispatch_refund",
            { refund: true, jobId: job.id }
          ).catch((refundErr) =>
            console.error("[creators/search/POST] refund failed", refundErr)
          );
        }
        await prisma.creatorSearchJob.update({
          where: { id: job.id },
          data: { status: "failed" },
        });
        console.error("[creators/search/POST] dispatch failed", dispatchError);
        return NextResponse.json(
          { error: "Failed to dispatch search job" },
          { status: 500 }
        );
      }

      console.warn(
        "[creators/search/POST] Inngest dispatch failed, relying on local fallback",
        dispatchError
      );
    }

    if (isLocalCreatorSearchFallbackEnabled()) {
      after(async () => {
        try {
          await scheduleLocalCreatorSearchJob({
            jobId: job.id,
            brandId: membership.brandId,
            campaignId: null,
          });
        } catch (error) {
          console.error(
            "[creators/search/POST] local creator search fallback failed",
            error
          );
        }
      });
    }

    return NextResponse.json(
      {
        jobId: job.id,
        status: "queued",
        requestedCount: job.requestedCount,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[creators/search/POST]", error);
    return NextResponse.json(
      { error: "Failed to start search" },
      { status: 500 }
    );
  }
}
