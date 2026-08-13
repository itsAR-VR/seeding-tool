import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = { params: Promise<{ threadId: string }> };

/**
 * GET /api/inbox/:threadId — Thread detail with messages, drafts, and shipping snapshots.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params;
    const membership = await getCurrentBrandMembership();

    const thread = await prisma.conversationThread.findFirst({
      where: { id: threadId, brandId: membership.brandId },
      include: {
        campaignCreator: {
          include: {
            creator: { include: { profiles: true } },
            campaign: { select: { id: true, name: true } },
            aiDrafts: { orderBy: { createdAt: "desc" } },
            shippingSnapshots: { orderBy: { createdAt: "desc" } },
          },
        },
        messages: { orderBy: { createdAt: "asc" } },
        aiArtifacts: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!thread) {
      return NextResponse.json(
        { error: "Thread not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(thread);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[inbox/GET:threadId]", error);
    return NextResponse.json(
      { error: "Failed to fetch thread" },
      { status: 500 }
    );
  }
}
