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

    return NextResponse.json(interventions);
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
