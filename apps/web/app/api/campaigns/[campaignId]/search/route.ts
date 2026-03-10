import { after, NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { inngest } from "@/lib/inngest/client";
import { buildUnifiedDiscoveryQueryFromCampaignSearch } from "@/lib/creator-search/contracts";
import {
  isLocalCreatorSearchFallbackEnabled,
  spawnLocalCreatorSearchJob,
} from "@/lib/creator-search/local-fallback";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * POST /api/campaigns/:campaignId/search — Trigger a creator search for a campaign.
 *
 * Body: { platform?, keywords?, minFollowers?, maxFollowers?, category?, location? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId } = await context.params;

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

    const body = (await request.json()) as {
      platform?: string;
      keywords?: string[];
      minFollowers?: number;
      maxFollowers?: number;
      category?: string;
      location?: string;
      limit?: number;
    };

    const requestedCount = Math.max(1, Math.min(body.limit ?? 20, 25));
    const unifiedQuery = buildUnifiedDiscoveryQueryFromCampaignSearch({
      ...body,
      limit: requestedCount,
    });

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

    try {
      await inngest.send({
        name: "creator-search/requested",
        data: {
          jobId: job.id,
          campaignId,
          brandId: membership.brandId,
          query: unifiedQuery,
        },
      });
    } catch (error) {
      if (!isLocalCreatorSearchFallbackEnabled()) {
        throw error;
      }

      console.warn(
        "[campaigns/search/POST] Inngest dispatch failed, relying on local fallback",
        error
      );
    }

    if (isLocalCreatorSearchFallbackEnabled()) {
      after(async () => {
        try {
          spawnLocalCreatorSearchJob({
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
    console.error("[campaigns/search/POST]", error);
    return NextResponse.json(
      { error: "Failed to trigger search" },
      { status: 500 }
    );
  }
}
