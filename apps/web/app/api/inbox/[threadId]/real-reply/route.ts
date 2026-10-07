import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { AUTO_DIRECTION, HUMAN_REPLY_CLASSIFICATION } from "@/lib/inbox/auto-messages";

type RouteContext = { params: Promise<{ threadId: string }> };

/**
 * POST /api/inbox/:threadId/real-reply — "It's a real reply". Body: { messageId }.
 * Undoes an auto-reply guess: the message counts as their reply again, so it
 * lands in "Needs your answer". Marked so the automatic check never moves it back.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params;
    const membership = await getCurrentBrandMembership();
    const body = (await request.json().catch(() => ({}))) as { messageId?: unknown };
    const messageId = typeof body.messageId === "string" ? body.messageId : "";

    const message = await prisma.message.findFirst({
      where: { id: messageId, threadId, direction: AUTO_DIRECTION, thread: { brandId: membership.brandId } },
      select: { id: true, createdAt: true, thread: { select: { campaignCreatorId: true } } },
    });
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    await prisma.message.update({
      where: { id: message.id },
      data: { direction: "inbound", classification: HUMAN_REPLY_CLASSIFICATION, confidence: 1 },
    });
    await prisma.campaignCreator.updateMany({
      where: { id: message.thread.campaignCreatorId, lifecycleStatus: { in: ["ready", "outreach_sent"] } },
      data: { lifecycleStatus: "replied", lastReplyAt: message.createdAt },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[inbox/real-reply]", error);
    return NextResponse.json({ error: "Couldn't change it. Try again." }, { status: 500 });
  }
}
