import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail/send";
import { AliasPausedError, DailyLimitExceededError } from "@/lib/outreach/errors";
import { SuppressedRecipientError } from "@/lib/compliance/suppression";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import {
  ADDRESS_LINK_PLACEHOLDER,
  GiftClaimIssueError,
  issueGiftClaimLink,
} from "@/lib/gift-claims/issue";

type RouteContext = { params: Promise<{ threadId: string }> };

/**
 * POST /api/inbox/:threadId/reply
 * Body: { body: string }
 *
 * Sends a human-written reply in the existing email thread, from the inbox
 * that started it. If the body contains "{address link}", a fresh private gift
 * claim link is issued for this creator and inserted.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const { body, draftId } = (await request.json()) as { body?: string; draftId?: string };
    if (!body?.trim()) {
      return NextResponse.json({ error: "Write a message first" }, { status: 400 });
    }

    const thread = await prisma.conversationThread.findFirst({
      where: { id: threadId, brandId: membership.brandId, channel: "email" },
      include: {
        campaignCreator: { include: { creator: true } },
        messages: {
          where: { direction: "outbound" },
          orderBy: { createdAt: "asc" },
          take: 1,
        },
      },
    });
    if (!thread) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const recipient = thread.campaignCreator.creator.email;
    if (!recipient) {
      return NextResponse.json({ error: "This creator has no email address" }, { status: 400 });
    }

    const firstOutbound = thread.messages[0];
    const alias = firstOutbound?.fromAddress
      ? await prisma.emailAlias.findUnique({
          where: {
            brandId_address: { brandId: membership.brandId, address: firstOutbound.fromAddress },
          },
          select: { id: true },
        })
      : await prisma.emailAlias.findFirst({
          where: { brandId: membership.brandId, isPrimary: true },
          select: { id: true },
        });
    if (!alias) {
      return NextResponse.json({ error: "No connected Gmail to send from" }, { status: 400 });
    }

    let finalBody = body.trim();
    if (finalBody.includes(ADDRESS_LINK_PLACEHOLDER)) {
      const issued = await issueGiftClaimLink({
        campaignCreatorId: thread.campaignCreatorId,
        createdBy: membership.userId,
      });
      finalBody = finalBody.split(ADDRESS_LINK_PLACEHOLDER).join(issued.claimUrl);
    }

    const baseSubject = (firstOutbound?.subject ?? "").replace(/^re:\s*/i, "");
    const result = await sendEmail({
      aliasId: alias.id,
      to: recipient,
      subject: baseSubject ? `Re: ${baseSubject}` : "Re:",
      body: finalBody,
      threadId: thread.id,
      externalThreadId: thread.externalThreadId ?? undefined,
      senderBrandId: membership.brandId,
    });

    await prisma.conversationThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });

    // The suggested answer was used (edited or not); retire it.
    if (draftId) {
      await prisma.aIDraft.updateMany({
        where: { id: draftId, campaignCreatorId: thread.campaignCreatorId, status: "draft" },
        data: { status: "sent" },
      });
    }

    return NextResponse.json({ success: true, gmailMessageId: result.gmailMessageId });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof GiftClaimIssueError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof DailyLimitExceededError) {
      return NextResponse.json({ error: "Today's sending limit is reached. Try again tomorrow." }, { status: 429 });
    }
    if (error instanceof AliasPausedError) {
      return NextResponse.json({ error: "This inbox is paused" }, { status: 409 });
    }
    if (error instanceof SuppressedRecipientError) {
      return NextResponse.json({ error: "This creator unsubscribed" }, { status: 409 });
    }
    console.error("[inbox/reply]", error);
    return NextResponse.json({ error: "Reply failed to send" }, { status: 500 });
  }
}
