import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveIntervention } from "@/lib/interventions/service";
import {
  assertBrandAccess,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const VALID_STATUSES = ["open", "in_progress", "resolved", "reopened"];

/**
 * PATCH /api/interventions/[id]
 *
 * Resolve or update an intervention.
 * Write access required + status validation.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const body = (await request.json()) as {
      resolution?: string;
      status?: string;
    };

    // Verify the intervention exists
    const intervention = await prisma.interventionCase.findUnique({
      where: { id },
    });

    if (!intervention) {
      return NextResponse.json(
        { error: "Intervention not found" },
        { status: 404 }
      );
    }

    // Verify user is a member of the intervention's brand + write access
    const membership = await assertBrandAccess(intervention.brandId);
    requireWriteAccess(membership);

    if (body.resolution) {
      const updated = await resolveIntervention(
        id,
        body.resolution,
        membership.userId
      );
      return NextResponse.json(updated);
    }

    // Generic status update with validation
    if (body.status) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }

      const updated = await prisma.interventionCase.update({
        where: { id },
        data: { status: body.status },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json(
      { error: "Provide resolution or status" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[interventions/PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update intervention" },
      { status: 500 }
    );
  }
}
