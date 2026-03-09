import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

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
 * GET /api/automations — List all automations for the current brand.
 */
export async function GET() {
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

    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const automations = await prisma.automation.findMany({
      where: { brandId: membership.brandId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ automations });
  } catch (error) {
    console.error("[automations/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch automations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automations — Create a new automation.
 *
 * Body: { name, type, schedule, config, enabled? }
 */
export async function POST(request: NextRequest) {
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

    const membership = await prisma.brandMembership.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      return NextResponse.json({ error: "No brand found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      name: string;
      type: string;
      schedule: string;
      config: Record<string, unknown>;
      enabled?: boolean;
    };

    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!body.type?.trim()) {
      return NextResponse.json(
        { error: "Type is required" },
        { status: 400 }
      );
    }

    const validSchedules = ["every_6h", "every_12h", "daily", "weekly"];
    if (!validSchedules.includes(body.schedule)) {
      return NextResponse.json(
        { error: "Invalid schedule. Use: every_6h, every_12h, daily, weekly" },
        { status: 400 }
      );
    }

    const automation = await prisma.automation.create({
      data: {
        name: body.name.trim(),
        type: body.type.trim(),
        schedule: body.schedule,
        config: (body.config || {}) as Prisma.InputJsonValue,
        enabled: body.enabled ?? true,
        nextRunAt: body.enabled !== false ? computeNextRunAt(body.schedule) : null,
        brandId: membership.brandId,
      },
    });

    return NextResponse.json({ automation }, { status: 201 });
  } catch (error) {
    console.error("[automations/POST]", error);
    return NextResponse.json(
      { error: "Failed to create automation" },
      { status: 500 }
    );
  }
}
