import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { computeNextRunAt } from "@/lib/automations/schedule";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = { params: Promise<{ id: string }> };

function normalizeLimit(value: unknown) {
  if (value == null || value === "") return undefined;

  const limit =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("config.limit must be a positive integer");
  }

  return limit;
}

function normalizeCategories(value: unknown) {
  if (!value || typeof value !== "object") return undefined;

  const normalize = (entries: unknown) =>
    Array.isArray(entries)
      ? Array.from(
          new Set(
            entries
              .filter((entry): entry is string => typeof entry === "string")
              .map((entry) => entry.trim())
              .filter(Boolean)
          )
        )
      : [];

  const input = value as { apify?: string[]; collabstr?: string[] };
  const categories = {
    apify: normalize(input.apify),
    collabstr: normalize(input.collabstr),
  };

  return categories.apify.length || categories.collabstr.length
    ? categories
    : undefined;
}

/**
 * GET /api/automations/[id] — Get a single automation.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const membership = await getCurrentBrandMembership();

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
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[automations/id/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch automation" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/automations/[id] — Update an automation.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

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

    let nextConfig: Prisma.InputJsonValue | undefined;
    if (body.config) {
      try {
        const limit = normalizeLimit(body.config.limit);
        const categories = normalizeCategories(body.config.categories);

        nextConfig = {
          ...body.config,
          ...(limit ? { limit } : {}),
          ...(categories ? { categories } : {}),
        } as Prisma.InputJsonValue;
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Invalid automation config",
          },
          { status: 400 }
        );
      }
    }

    const newSchedule = body.schedule || existing.schedule;
    const newEnabled = body.enabled ?? existing.enabled;
    const nextRunAt = newEnabled ? computeNextRunAt(newSchedule) : null;

    const automation = await prisma.automation.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.schedule && { schedule: body.schedule }),
        ...(nextConfig && { config: nextConfig }),
        ...(body.enabled !== undefined && { enabled: body.enabled }),
        nextRunAt,
      },
    });

    return NextResponse.json({ automation });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
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
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

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
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[automations/id/DELETE]", error);
    return NextResponse.json(
      { error: "Failed to delete automation" },
      { status: 500 }
    );
  }
}
