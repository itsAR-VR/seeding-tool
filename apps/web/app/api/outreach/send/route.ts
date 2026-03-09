import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import {
  sendOutreachBatch,
  type DraftToSend,
} from "@/lib/outreach/send-pipeline";

/**
 * POST /api/outreach/send — Send drafted outreach messages.
 *
 * INVARIANT: AI drafts are NEVER auto-sent. This endpoint fires
 * only from explicit user action (Send/Send All button).
 *
 * Body: {
 *   drafts: Array<{
 *     campaignCreatorId: string;
 *     creatorId: string;
 *     channel: "email" | "instagram_dm";
 *     subject?: string;
 *     body: string;
 *   }>
 * }
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
    console.error("[outreach/send/POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
