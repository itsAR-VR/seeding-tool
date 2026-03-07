import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { searchCreatorsForCampaign } from "@/lib/workers/creator-search";

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
    };

    const result = await searchCreatorsForCampaign(
      campaignId,
      membership.brandId,
      body
    );

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error("[campaigns/search/POST]", error);
    return NextResponse.json(
      { error: "Failed to trigger search" },
      { status: 500 }
    );
  }
}
