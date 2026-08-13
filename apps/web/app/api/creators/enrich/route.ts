import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enrichCreatorEmails } from "@/lib/enrichment/service";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * POST /api/creators/enrich — Enrich creator emails via Apify.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const brandId = membership.brandId;

    let body: { creatorIds?: string[] } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine — will enrich all
    }

    let creatorIds = body.creatorIds;

    // If no IDs provided, find all brand creators without email
    if (!creatorIds || creatorIds.length === 0) {
      const creatorsWithoutEmail = await prisma.creator.findMany({
        where: {
          brandId,
          email: null,
          instagramHandle: { not: null },
        },
        select: { id: true },
        take: 100,
      });
      creatorIds = creatorsWithoutEmail.map((c) => c.id);
    }

    if (creatorIds.length === 0) {
      return NextResponse.json({
        results: [],
        enriched: 0,
        notFound: 0,
        skipped: 0,
        alreadyHasEmail: 0,
      });
    }

    const results = await enrichCreatorEmails(creatorIds, brandId);

    const enriched = results.filter((r) => r.status === "found").length;
    const notFound = results.filter((r) => r.status === "not_found").length;
    const alreadyHasEmail = results.filter(
      (r) => r.status === "already_has_email"
    ).length;
    const skipped = results.filter(
      (r) => r.status === "no_handle" || r.status === "error"
    ).length;

    return NextResponse.json({
      results,
      enriched,
      notFound,
      alreadyHasEmail,
      skipped,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[creators/enrich/POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
