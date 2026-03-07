import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ threadId: string }> };

/**
 * GET /api/inbox/:threadId — Thread detail with messages, drafts, and shipping snapshots.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params;

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
    console.error("[inbox/GET:threadId]", error);
    return NextResponse.json(
      { error: "Failed to fetch thread" },
      { status: 500 }
    );
  }
}
