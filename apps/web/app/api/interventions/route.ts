import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  listInterventions,
  createIntervention,
} from "@/lib/interventions/service";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * GET /api/interventions?status=open&type=...&priority=...
 *
 * List interventions for the user's brand.
 */
export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();

    const status =
      request.nextUrl.searchParams.get("status") || undefined;
    const type = request.nextUrl.searchParams.get("type") || undefined;
    const priority =
      request.nextUrl.searchParams.get("priority") || undefined;

    const interventions = await listInterventions(membership.brandId, {
      status,
      type,
      priority,
    });

    // Attach where each case points, so the UI can link straight to it.
    const ccIds = [
      ...new Set(interventions.map((i) => i.campaignCreatorId).filter((id): id is string => Boolean(id))),
    ];
    const targets = ccIds.length
      ? await prisma.campaignCreator.findMany({
          where: { id: { in: ccIds }, campaign: { brandId: membership.brandId } },
          select: {
            id: true,
            creatorId: true,
            creator: { select: { name: true, instagramHandle: true } },
            conversationThread: { select: { id: true } },
          },
        })
      : [];
    const byId = new Map(targets.map((t) => [t.id, t]));

    return NextResponse.json(
      interventions.map((i) => {
        const target = i.campaignCreatorId ? byId.get(i.campaignCreatorId) : undefined;
        return {
          ...i,
          link: target
            ? {
                label: target.creator.name ?? target.creator.instagramHandle ?? "Creator",
                href: target.conversationThread
                  ? `/inbox/${target.conversationThread.id}`
                  : `/creators/${target.creatorId}`,
              }
            : null,
        };
      })
    );
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[interventions/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch interventions" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/interventions
 *
 * Create a new intervention case.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const body = (await request.json()) as {
      type: string;
      title: string;
      description?: string;
      priority?: string;
      campaignCreatorId?: string;
    };

    if (!body.type || !body.title) {
      return NextResponse.json(
        { error: "type and title are required" },
        { status: 400 }
      );
    }

    const intervention = await createIntervention({
      ...body,
      brandId: membership.brandId,
    });

    return NextResponse.json(intervention, { status: 201 });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[interventions/POST]", error);
    return NextResponse.json(
      { error: "Failed to create intervention" },
      { status: 500 }
    );
  }
}
