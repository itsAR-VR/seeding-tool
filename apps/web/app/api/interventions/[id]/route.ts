import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { resolveIntervention } from "@/lib/interventions/service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/interventions/[id]
 *
 * Resolve or update an intervention.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
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

    const { id } = await context.params;

    const body = (await request.json()) as {
      resolution?: string;
      status?: string;
    };

    // Verify the intervention belongs to the user's brand
    const intervention = await prisma.interventionCase.findUnique({
      where: { id },
    });

    if (!intervention) {
      return NextResponse.json(
        { error: "Intervention not found" },
        { status: 404 }
      );
    }

    const membership = await prisma.brandMembership.findFirst({
      where: {
        userId: user.id,
        brandId: intervention.brandId,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Not authorized" },
        { status: 403 }
      );
    }

    if (body.resolution) {
      const updated = await resolveIntervention(
        id,
        body.resolution,
        user.id
      );
      return NextResponse.json(updated);
    }

    // Generic status update
    if (body.status) {
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
    console.error("[interventions/PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update intervention" },
      { status: 500 }
    );
  }
}
