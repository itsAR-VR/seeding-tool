import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendOutreachBatch,
  type DraftToSend,
} from "@/lib/outreach/send-pipeline";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

/**
 * POST /api/outreach/send — Send drafted outreach messages.
 *
 * INVARIANT: AI drafts are NEVER auto-sent. This endpoint fires
 * only from explicit user action (Send/Send All button).
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const body = await request.json();
    const { drafts } = body as { drafts: DraftToSend[] };

    if (!drafts || !Array.isArray(drafts) || drafts.length === 0) {
      return NextResponse.json(
        { error: "drafts array is required and must be non-empty" },
        { status: 400 }
      );
    }

    if (drafts.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 sends per batch" },
        { status: 400 }
      );
    }

    // Verify all campaign creators belong to this brand
    const ccIds = drafts.map((d) => d.campaignCreatorId);
    const validCCs = await prisma.campaignCreator.findMany({
      where: {
        id: { in: ccIds },
        campaign: { brandId: membership.brandId },
      },
      select: { id: true },
    });

    const validIds = new Set(validCCs.map((cc) => cc.id));
    const validDrafts = drafts.filter((d) =>
      validIds.has(d.campaignCreatorId)
    );

    if (validDrafts.length === 0) {
      return NextResponse.json(
        { error: "No valid campaign creators found for this brand" },
        { status: 404 }
      );
    }

    const results = await sendOutreachBatch(validDrafts, membership.brandId);

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const noContact = results.filter(
      (r) => r.status === "no_contact_info"
    ).length;

    return NextResponse.json({
      results,
      sent,
      failed,
      noContact,
      total: results.length,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[outreach/send/POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
