import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { DraftToSend } from "@/lib/outreach/send-pipeline";
import { queueOutreach } from "@/lib/outreach/queue";
import {
  BrandAccessError,
  getCurrentBrandMembership,
  requireWriteAccess,
} from "@/lib/integrations/brand-access";

/**
 * POST /api/outreach/queue — "Send all": queue emails to go out one every
 * 3 minutes. Body: { campaignId, drafts }. Only fires from a click.
 */
export async function POST(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);
    const body = (await request.json().catch(() => ({}))) as { campaignId?: string; drafts?: DraftToSend[] };
    const drafts = Array.isArray(body.drafts) ? body.drafts.filter((d) => d?.body?.trim()) : [];
    if (!body.campaignId || drafts.length === 0) {
      return NextResponse.json({ error: "Pick at least one creator to email." }, { status: 400 });
    }
    if (drafts.length > 50) {
      return NextResponse.json({ error: "Queue up to 50 at a time." }, { status: 400 });
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: body.campaignId, brandId: membership.brandId },
      select: { id: true },
    });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    // Every creator must be in this campaign (and so in this brand).
    const valid = await prisma.campaignCreator.findMany({
      where: { id: { in: drafts.map((d) => d.campaignCreatorId) }, campaignId: campaign.id },
      select: { id: true, creatorId: true },
    });
    const byId = new Map(valid.map((v) => [v.id, v.creatorId]));
    const clean = drafts
      .filter((d) => byId.has(d.campaignCreatorId))
      .map((d) => ({ ...d, creatorId: byId.get(d.campaignCreatorId)! }));
    if (clean.length === 0) {
      return NextResponse.json({ error: "We couldn't find those creators in this campaign. Refresh the page." }, { status: 404 });
    }

    if (clean.every((d) => d.channel === "email")) {
      const aliasCount = await prisma.emailAlias.count({ where: { brandId: membership.brandId } });
      if (aliasCount === 0) {
        return NextResponse.json({ error: "Connect Gmail in Settings > Connections to send emails." }, { status: 400 });
      }
    }

    const result = await queueOutreach({
      brandId: membership.brandId,
      campaignId: campaign.id,
      userId: membership.userId,
      drafts: clean,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[outreach/queue POST]", error);
    return NextResponse.json({ error: "Couldn't queue the emails. Nothing was sent." }, { status: 500 });
  }
}

/** GET /api/outreach/queue?campaignId= — what's waiting, sent and failed today. */
export async function GET(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    const campaignId = request.nextUrl.searchParams.get("campaignId") ?? "";
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const items = await prisma.outreachQueueItem.findMany({
      where: {
        brandId: membership.brandId,
        campaignId,
        OR: [{ status: { in: ["queued", "sending"] } }, { createdAt: { gte: since } }],
      },
      orderBy: { sendAt: "asc" },
      select: { campaignCreatorId: true, status: true, sendAt: true, error: true },
    });
    const waiting = items.filter((i) => i.status === "queued" || i.status === "sending");
    return NextResponse.json({
      waitingIds: waiting.map((i) => i.campaignCreatorId),
      waiting: waiting.length,
      sent: items.filter((i) => i.status === "sent").length,
      failed: items.filter((i) => i.status === "failed").map((i) => ({ id: i.campaignCreatorId, error: i.error })),
      nextAt: waiting[0]?.sendAt ?? null,
      finishesAt: waiting.length ? waiting[waiting.length - 1].sendAt : null,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[outreach/queue GET]", error);
    return NextResponse.json({ error: "Couldn't load the queue" }, { status: 500 });
  }
}

/** DELETE /api/outreach/queue?campaignId= — stop: cancel everything not sent yet. */
export async function DELETE(request: NextRequest) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);
    const campaignId = request.nextUrl.searchParams.get("campaignId") ?? "";
    const { count } = await prisma.outreachQueueItem.updateMany({
      where: { brandId: membership.brandId, campaignId, status: "queued" },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ cancelled: count });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[outreach/queue DELETE]", error);
    return NextResponse.json({ error: "Couldn't stop the queue" }, { status: 500 });
  }
}
