import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { enrichCreatorEmails } from "@/lib/enrichment/service";

/**
 * POST /api/creators/enrich — Enrich creator emails via Apify.
 *
 * Body: { creatorIds?: string[] }
 * If creatorIds is empty/omitted, enriches all brand creators missing emails.
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
        take: 100, // Batch limit
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
    console.error("[creators/enrich/POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
