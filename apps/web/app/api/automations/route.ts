import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveBrandICP, icpToSearchHints } from "@/lib/brands/icp";
import { computeNextRunAt } from "@/lib/automations/schedule";
import { buildUnifiedDiscoveryQueryFromAutomationConfig } from "@/lib/creator-search/contracts";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type CategorySelection = {
  apify?: string[];
  collabstr?: string[];
};

function normalizeCategories(
  value: unknown
): { apify: string[]; collabstr: string[] } | undefined {
  if (!value || typeof value !== "object") return undefined;

  const source = value as CategorySelection;

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

  const categories = {
    apify: normalize(source.apify),
    collabstr: normalize(source.collabstr),
  };

  return categories.apify.length || categories.collabstr.length
    ? categories
    : undefined;
}

function normalizeLimit(value: unknown) {
  if (value == null || value === "") return undefined;

  const limit =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("config.limit must be a positive integer");
  }

  return limit;
}

function toHashtag(value: string | undefined) {
  if (!value) return undefined;

  const normalized = value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "");

  return normalized || undefined;
}

async function buildAutomationConfig(
  brandId: string,
  type: string,
  incomingConfig: Record<string, unknown> | undefined
) {
  if (type !== "creator_discovery") {
    return (incomingConfig || {}) as Prisma.InputJsonValue;
  }

  const categories = normalizeCategories(incomingConfig?.categories);
  const limit = normalizeLimit(incomingConfig?.limit);
  const providedHashtag =
    typeof incomingConfig?.hashtag === "string"
      ? incomingConfig.hashtag.trim().replace(/^#/, "")
      : "";

  let derivedHashtag = providedHashtag || undefined;

  if (!derivedHashtag) {
    const icp = await deriveBrandICP(brandId);
    const searchHints = icpToSearchHints(icp);
    derivedHashtag =
      searchHints.keywords[0] ??
      toHashtag(categories?.apify[0]) ??
      toHashtag(categories?.collabstr[0]);
  }

  return {
    ...(incomingConfig || {}),
    searchMode:
      incomingConfig?.searchMode === "profile" ? "profile" : "hashtag",
    platform:
      typeof incomingConfig?.platform === "string" &&
      incomingConfig.platform.trim()
        ? incomingConfig.platform.trim()
        : "instagram",
    autoImport: incomingConfig?.autoImport !== false,
    ...(limit ? { limit } : {}),
    ...(categories ? { categories } : {}),
    ...(derivedHashtag ? { hashtag: derivedHashtag } : {}),
    query: buildUnifiedDiscoveryQueryFromAutomationConfig({
      ...(incomingConfig || {}),
      ...(limit ? { limit } : {}),
      ...(categories ? { categories } : {}),
      ...(derivedHashtag ? { hashtag: derivedHashtag } : {}),
    }),
  } as Prisma.InputJsonValue;
}

/**
 * GET /api/automations — List all automations for the current brand.
 */
export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();

    const automations = await prisma.automation.findMany({
      where: { brandId: membership.brandId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ automations });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[automations/GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch automations" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/automations — Create a new automation.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

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

    let config: Prisma.InputJsonValue;
    try {
      config = await buildAutomationConfig(
        membership.brandId,
        body.type.trim(),
        body.config
      );
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

    const automation = await prisma.automation.create({
      data: {
        name: body.name.trim(),
        type: body.type.trim(),
        schedule: body.schedule,
        config,
        enabled: body.enabled ?? true,
        nextRunAt: body.enabled !== false ? computeNextRunAt(body.schedule) : null,
        brandId: membership.brandId,
      },
    });

    return NextResponse.json({ automation }, { status: 201 });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[automations/POST]", error);
    return NextResponse.json(
      { error: "Failed to create automation" },
      { status: 500 }
    );
  }
}
