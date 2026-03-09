import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Compute nextRunAt from a schedule preset, relative to now.
 */
function computeNextRunAt(schedule: string): Date {
  const now = new Date();
  switch (schedule) {
    case "every_6h":
      return new Date(now.getTime() + 6 * 60 * 60 * 1000);
    case "every_12h":
      return new Date(now.getTime() + 12 * 60 * 60 * 1000);
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

/**
 * GET /api/automations/[id] — Get a single automation.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

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

    const automation = await prisma.automation.findFirst({
      where: { id, brandId: membership.brandId },
    });

    if (!automation) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ automation });
  } catch (error) {
    console.error("[automations/id/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch automation" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/automations/[id] — Update an automation.
 *
 * Body: { name?, schedule?, config?, enabled? }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

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

    const existing = await prisma.automation.findFirst({
      where: { id, brandId: membership.brandId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      name?: string;
      schedule?: string;
      config?: Record<string, unknown>;
      enabled?: boolean;
    };

    const validSchedules = ["every_6h", "every_12h", "daily", "weekly"];
    if (body.schedule && !validSchedules.includes(body.schedule)) {
      return NextResponse.json(
        { error: "Invalid schedule" },
        { status: 400 }
      );
    }

    // Compute nextRunAt if schedule or enabled status changes
    const newSchedule = body.schedule || existing.schedule;
    const newEnabled = body.enabled ?? existing.enabled;
    const nextRunAt = newEnabled ? computeNextRunAt(newSchedule) : null;

    const automation = await prisma.automation.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.schedule && { schedule: body.schedule }),
        ...(body.config && { config: body.config as Prisma.InputJsonValue }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        nextRunAt,
      },
    });

    return NextResponse.json({ automation });
  } catch (error) {
    console.error("[automations/id/PATCH]", error);
    return NextResponse.json(
      { error: "Failed to update automation" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/automations/[id] — Delete an automation.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

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

    const existing = await prisma.automation.findFirst({
      where: { id, brandId: membership.brandId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Automation not found" },
        { status: 404 }
      );
    }

    await prisma.automation.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[automations/id/DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete automation" },
      { status: 500 }
    );
  }
}
