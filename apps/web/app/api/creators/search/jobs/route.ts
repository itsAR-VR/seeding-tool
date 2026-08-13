import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeCreatorSearchJob } from "@/lib/creator-search/job-payload";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

const ACTIVE_STATUSES = ["pending", "running", "paused"];

/**
 * GET /api/creators/search/jobs — List active or recent creator search jobs.
 */
export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") === "recent" ? "recent" : "active";

    const jobs = await prisma.creatorSearchJob.findMany({
      where: {
        brandId: membership.brandId,
        ...(scope === "active"
          ? { status: { in: ACTIVE_STATUSES } }
          : {}),
      },
      orderBy: [
        { updatedAt: "desc" },
        { createdAt: "desc" },
      ],
      take: scope === "active" ? 10 : 25,
    });

    return NextResponse.json({
      jobs: jobs.map(serializeCreatorSearchJob),
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[creators/search/jobs/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch creator search jobs" },
      { status: 500 }
    );
  }
}
