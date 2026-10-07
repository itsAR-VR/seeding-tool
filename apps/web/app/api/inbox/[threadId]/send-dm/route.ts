import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDailyLimit, getOrCreateChat, sendDm } from "@/lib/unipile/dms";
import { getFeatureFlags } from "@/lib/feature-flags";
import { UnipileNotConnectedError } from "@/lib/unipile/client";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = { params: Promise<{ threadId: string }> };

/**
 * POST /api/inbox/:threadId/send-dm — Send an Instagram DM via Unipile.
 *
 * // INVARIANT: DM send only on explicit human action — never automated
 * // INVARIANT: Unipile DMs limited to 20/day per brand account
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    // Feature flag guard: Unipile DM must be enabled
    const flags = await getFeatureFlags(membership.brandId);
    if (!flags.unipileDmEnabled) {
      return NextResponse.json({ error: "Instagram messages are turned off. Turn on 'Send Instagram messages' in Settings > Features." }, { status: 403 });
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
            "This creator has no Instagram handle saved. Add it on their creator page first.",
        },
        { status: 400 }
      );
    }

    let chatId = thread.unipileChatId;
    let externalMessageId: string;

    if (chatId) {
      const result = await sendDm(
        membership.brandId,
        chatId,
        body.message.trim()
      );
      externalMessageId = result.messageId;
    } else {
      const chatResult = await getOrCreateChat(
        membership.brandId,
        instagramHandle,
        body.message.trim()
      );
      chatId = chatResult.chatId;

      await prisma.conversationThread.update({
        where: { id: threadId },
        data: {
          unipileChatId: chatId,
          channel: "instagram_dm",
        },
      });

      if (chatResult.isNew) {
        externalMessageId = `unipile-new-${Date.now()}`;
      } else {
        const result = await sendDm(
          membership.brandId,
          chatId,
          body.message.trim()
        );
        externalMessageId = result.messageId;
      }
    }

    // INVARIANT: DM send only on explicit human action — never automated
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
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof UnipileNotConnectedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[inbox/send-dm/POST]", error);
    return NextResponse.json(
      { error: "Your Instagram message didn't send. Try again in a minute." },
      { status: 502 }
    );
  }
}
