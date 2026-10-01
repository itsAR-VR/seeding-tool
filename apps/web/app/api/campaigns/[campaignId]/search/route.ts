import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dispatchCreatorSearch } from "@/lib/creator-search/dispatch";
import { ApifyKeyMissingError, resolveApifyToken } from "@/lib/apify/token";
import {
  buildUnifiedDiscoveryQueryFromCampaignRequest,
  type CampaignDiscoveryRequest,
} from "@/lib/creator-search/contracts";
import {
  isLocalCreatorSearchFallbackEnabled,
  scheduleLocalCreatorSearchJob,
} from "@/lib/creator-search/local-fallback";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import {
  ensureCredits,
  debit,
  mint,
  CREDIT_COSTS,
  CreditInsufficientError,
  isCreditEnforcementEnabled,
} from "@/lib/credits";

/** Searches run inside this request (no paid scheduler); Apify can take minutes. */
export const maxDuration = 800;

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * POST /api/campaigns/:campaignId/search — Trigger a creator search for a campaign.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    // Verify campaign access
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as CampaignDiscoveryRequest;
    const unifiedQuery = buildUnifiedDiscoveryQueryFromCampaignRequest(body);
    const requestedCount = unifiedQuery.limit;

    // Create the job BEFORE consuming credits: if the debit fails, the
    // job is deleted and no balance is consumed for work that never ran.
    // Fail fast with a clear message when this company has no Apify key yet.
    await resolveApifyToken(membership.brandId);

    const job = await prisma.creatorSearchJob.create({
      data: {
        status: "pending",
        platform: body.platform ?? "instagram",
        brandId: membership.brandId,
        campaignId,
        requestedCount,
        progressPercent: 0,
        query: unifiedQuery,
      },
    });

    // Credit enforcement: reserve estimated cost before starting search
    if (isCreditEnforcementEnabled()) {
      const estimatedCost = CREDIT_COSTS.creator_search;
      try {
        await ensureCredits(membership.brandId, estimatedCost);
        await debit(
          membership.brandId,
          estimatedCost,
          "creator_search_reservation",
          { type: "reservation", campaignId }
        );
      } catch (error) {
        // Roll back the job so the customer is not charged for nothing.
        try {
          await prisma.creatorSearchJob.delete({ where: { id: job.id } });
        } catch {
          // best-effort rollback; the credit error below takes precedence
        }
        if (error instanceof CreditInsufficientError) {
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
      await dispatchCreatorSearch({
          jobId: job.id,
          campaignId,
          brandId: membership.brandId,
          query: unifiedQuery,
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
            console.error("[campaigns/search/POST] refund failed", refundErr)
          );
        }
        await prisma.creatorSearchJob.update({
          where: { id: job.id },
          data: { status: "failed" },
        });
        console.error("[campaigns/search/POST] dispatch failed", dispatchError);
        return NextResponse.json(
          { error: "Failed to dispatch search job" },
          { status: 500 }
        );
      }

      console.warn(
        "[campaigns/search/POST] Inngest dispatch failed, relying on local fallback",
        dispatchError
      );
    }

    if (isLocalCreatorSearchFallbackEnabled()) {
      after(async () => {
        try {
          await scheduleLocalCreatorSearchJob({
            jobId: job.id,
            brandId: membership.brandId,
            campaignId,
          });
        } catch (error) {
          console.error(
            "[campaigns/search/POST] local creator search fallback failed",
            error
          );
        }
      });
    }

    return NextResponse.json(
      {
        jobId: job.id,
        status: "queued",
        requestedCount,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof ApifyKeyMissingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[campaigns/search/POST]", error);
    return NextResponse.json(
      { error: "Failed to trigger search" },
      { status: 500 }
    );
  }
}
