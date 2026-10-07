import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type SavedDraft = { campaignCreatorId?: unknown; subject?: unknown; body?: unknown };

/**
 * PUT /api/outreach/draft/save — keep checked or edited first emails for later.
 * Body: { drafts: [{ campaignCreatorId, subject, body }] }. Each one replaces
 * that creator's saved first email, so "Open N written emails" brings back
 * exactly what was approved. Only for creators not emailed yet.
 */
export async function PUT(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);
    const body = (await request.json().catch(() => ({}))) as { drafts?: SavedDraft[] };
    const drafts = (body.drafts ?? []).filter(
      (d): d is { campaignCreatorId: string; subject: string | null; body: string } =>
        typeof d.campaignCreatorId === "string" && typeof d.body === "string" && d.body.trim().length > 0,
    );
    if (drafts.length === 0) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
    if (drafts.length > 50) return NextResponse.json({ error: "Save up to 50 at a time." }, { status: 400 });

    const owned = await prisma.campaignCreator.findMany({
      where: {
        id: { in: drafts.map((d) => d.campaignCreatorId) },
        campaign: { brandId: membership.brandId },
        lifecycleStatus: "ready",
      },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((o) => o.id));

    let saved = 0;
    for (const d of drafts) {
      if (!ownedIds.has(d.campaignCreatorId)) continue;
      const subject = typeof d.subject === "string" && d.subject.trim() ? d.subject.trim() : null;
      await prisma.$transaction([
        prisma.aIDraft.updateMany({
          where: { campaignCreatorId: d.campaignCreatorId, type: "outreach", status: "draft" },
          data: { status: "discarded" },
        }),
        prisma.aIDraft.create({
          data: {
            campaignCreatorId: d.campaignCreatorId,
            type: "outreach",
            status: "draft",
            subject,
            body: d.body.trim(),
          },
        }),
      ]);
      saved++;
    }
    return NextResponse.json({ saved });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[outreach/draft/save PUT]", error);
    return NextResponse.json({ error: "Couldn't save the emails. Try again." }, { status: 500 });
  }
}
