import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { needsYourCall } from "@/app/(platform)/inbox/next-reply";

/**
 * GET /api/inbox/queue
 * The ids of replies that still need the operator's call, in the same order
 * as the inbox "Needs your call" tab (most recently updated first).
 */
export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();
    const threads = await prisma.conversationThread.findMany({
      where: { brandId: membership.brandId, campaignCreator: { replyDecision: null } },
      select: {
        id: true,
        messages: { where: { direction: { not: "auto" } }, orderBy: { createdAt: "desc" }, take: 1, select: { direction: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const ids = threads.filter((t) => needsYourCall(null, t.messages[0]?.direction)).map((t) => t.id);
    return NextResponse.json({ ids });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[inbox/queue]", error);
    return NextResponse.json({ error: "Could not load the replies waiting on you" }, { status: 500 });
  }
}
