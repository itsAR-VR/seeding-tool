import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { checkDailyLimit, getOrCreateChat, sendDm } from "@/lib/unipile/dms";

type RouteContext = { params: Promise<{ threadId: string }> };

/**
 * POST /api/inbox/:threadId/send-dm — Send an Instagram DM via Unipile.
 *
 * Body: { message: string }
 *
 * // INVARIANT: DM send only on explicit human action — never automated
 * // INVARIANT: Unipile DMs limited to 20/day per brand account
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    // Load thread
    const thread = await prisma.conversationThread.findFirst({
      where: { id: threadId, brandId: membership.brandId },
      include: {
        campaignCreator: {
          include: {
            creator: true,
          },
        },
      },
    });

    if (!thread) {
      return NextResponse.json(
        { error: "Thread not found" },
        { status: 404 }
      );
    }

    const body = (await request.json()) as { message: string };

    if (!body.message || typeof body.message !== "string" || !body.message.trim()) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // INVARIANT: Unipile DMs limited to 20/day per brand account
    const limitCheck = await checkDailyLimit(membership.brandId);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `Daily DM limit reached (${limitCheck.sent}/${limitCheck.limit}). Try again tomorrow.`,
        },
        { status: 429 }
      );
    }

    // Get Instagram handle from creator
    const creator = thread.campaignCreator.creator;
    const instagramHandle =
      creator.instagramHandle ?? null;

    if (!instagramHandle) {
      return NextResponse.json(
        {
          error:
            "Creator has no Instagram handle. Cannot send DM.",
        },
        { status: 400 }
      );
    }

    let chatId = thread.unipileChatId;
    let externalMessageId: string;

    if (chatId) {
      // Send to existing chat
      const result = await sendDm(
        membership.brandId,
        chatId,
        body.message.trim()
      );
      externalMessageId = result.messageId;
    } else {
      // Get or create chat
      const chatResult = await getOrCreateChat(
        membership.brandId,
        instagramHandle,
        body.message.trim()
      );
      chatId = chatResult.chatId;

      // Update thread with Unipile chat ID
      await prisma.conversationThread.update({
        where: { id: threadId },
        data: {
          unipileChatId: chatId,
          channel: "instagram_dm",
        },
      });

      if (chatResult.isNew) {
        // Message was sent during chat creation
        externalMessageId = `unipile-new-${Date.now()}`;
      } else {
        // Chat existed but wasn't linked — send message
        const result = await sendDm(
          membership.brandId,
          chatId,
          body.message.trim()
        );
        externalMessageId = result.messageId;
      }
    }

    // INVARIANT: DM send only on explicit human action — never automated
    // Persist message
    const message = await prisma.message.create({
      data: {
        direction: "outbound",
        channel: "instagram_dm",
        body: body.message.trim(),
        externalMessageId,
        threadId,
      },
    });

    return NextResponse.json({
      success: true,
      messageId: message.id,
      chatId,
    });
  } catch (error) {
    console.error("[inbox/send-dm/POST]", error);

    const errMsg =
      error instanceof Error ? error.message : "Failed to send DM";

    // Don't propagate Unipile errors as 500s — return useful error
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
