import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BrandAccessError,
  getCurrentBrandMembership,
} from "@/lib/integrations/brand-access";
import { getFeatureFlags } from "@/lib/feature-flags";

export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();
    const flags = await getFeatureFlags(membership.brandId);
    if (!flags.outcomeLearningEnabled) {
      return NextResponse.json(
        { error: "Calibration is disabled for this brand" },
        { status: 403 }
      );
    }

    const snapshot = await prisma.calibrationSnapshot.findFirst({
      where: { brandId: membership.brandId },
      orderBy: { createdAt: "desc" },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: "No calibration snapshot available yet" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: snapshot.id,
      createdAt: snapshot.createdAt,
      outcomeCount: snapshot.outcomeCount,
      reportJson: snapshot.reportJson,
      adjustmentsApplied: snapshot.adjustmentsApplied,
      weightsBefore: snapshot.weightsBefore,
      suggestedWeights: snapshot.suggestedWeights,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Failed to load calibration data" },
      { status: 500 }
    );
  }
}
