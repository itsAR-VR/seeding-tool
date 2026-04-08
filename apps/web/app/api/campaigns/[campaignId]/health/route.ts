import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import type { HealthSnapshotData } from "@/lib/health/types";

type RouteContext = { params: Promise<{ campaignId: string }> };

/**
 * GET /api/campaigns/:campaignId/health
 *
 * Returns the latest CampaignHealthSnapshot for the campaign.
 * Auth: requires brand membership.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { campaignId } = await context.params;
    const membership = await getCurrentBrandMembership();

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, brandId: membership.brandId },
      select: { id: true, name: true },
    });

    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const snapshot = await prisma.campaignHealthSnapshot.findFirst({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "No health data available yet" },
        { status: 404 }
      );
    }

    const data: HealthSnapshotData = {
      id: snapshot.id,
      createdAt: snapshot.createdAt.toISOString(),
      campaignId: snapshot.campaignId,
      campaignName: campaign.name,
      status: snapshot.status as HealthSnapshotData["status"],
      metrics: snapshot.metrics as unknown as HealthSnapshotData["metrics"],
      alerts: snapshot.alerts as unknown as HealthSnapshotData["alerts"],
    };

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch health data" },
      { status: 500 }
    );
  }
}
