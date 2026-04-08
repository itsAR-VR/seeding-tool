import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import { log } from "@/lib/logger";
import type { HealthSnapshotData } from "@/lib/health/types";

/**
 * GET /api/dashboard/health
 *
 * Returns the latest health snapshot for ALL campaigns of the
 * current brand. Used by the dashboard widget.
 */
export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();
    const brandId = membership.brandId;

    // Get all active/paused campaigns for this brand
    const campaigns = await prisma.campaign.findMany({
      where: { brandId, status: { in: ["active", "paused"] } },
      select: { id: true, name: true },
    });

    if (campaigns.length === 0) {
      return NextResponse.json([]);
    }

    const campaignIds = campaigns.map((c) => c.id);
    const campaignNames = new Map(campaigns.map((c) => [c.id, c.name]));

    // Fetch latest snapshot per campaign using a raw approach:
    // Get all snapshots ordered by createdAt desc, then pick first per campaign
    const snapshots = await prisma.campaignHealthSnapshot.findMany({
      where: { campaignId: { in: campaignIds } },
      orderBy: { createdAt: "desc" },
    });

    // Deduplicate: keep only the latest snapshot per campaign
    const latestByCampaign = new Map<
      string,
      (typeof snapshots)[number]
    >();
    for (const snap of snapshots) {
      if (!latestByCampaign.has(snap.campaignId)) {
        latestByCampaign.set(snap.campaignId, snap);
      }
    }

    const data: HealthSnapshotData[] = Array.from(
      latestByCampaign.values()
    ).map((snap) => ({
      id: snap.id,
      createdAt: snap.createdAt.toISOString(),
      campaignId: snap.campaignId,
      campaignName: campaignNames.get(snap.campaignId) ?? "Unknown",
      status: snap.status as HealthSnapshotData["status"],
      metrics: snap.metrics as unknown as HealthSnapshotData["metrics"],
      alerts: snap.alerts as unknown as HealthSnapshotData["alerts"],
    }));

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    log("error", "dashboard.health.failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Failed to fetch health data" },
      { status: 500 }
    );
  }
}
