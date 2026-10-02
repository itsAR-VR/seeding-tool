import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail/send";
import { emailSendErrorResponse } from "@/lib/outreach/error-response";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = { params: Promise<{ threadId: string }> };

/**
 * POST /api/inbox/:threadId/send
 * Body: { draftId: string, aliasId: string }
 *
 * Confirms and sends a draft, marks AIDraft.status = "sent".
 *
 * // INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    // Verify thread belongs to brand
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

    const body = (await request.json()) as {
      draftId: string;
      aliasId: string;
    };

    if (!body.draftId) {
      return NextResponse.json(
        { error: "Pick a draft to send." },
        { status: 400 }
      );
    }

    // Fetch draft
    const draft = await prisma.aIDraft.findFirst({
      where: {
        id: body.draftId,
        campaignCreatorId: thread.campaignCreatorId,
        status: "draft",
      },
    });

    if (!draft) {
      return NextResponse.json(
        { error: "This draft was already sent or removed. Refresh the page." },
        { status: 404 }
      );
    }

    // Get recipient email
    const recipientEmail = thread.campaignCreator.creator.email;
    if (!recipientEmail) {
      return NextResponse.json(
        { error: "This creator has no email address. Add one on their creator page first." },
        { status: 400 }
      );
    }

    // Reply from the inbox that started this thread (its Gmail thread id only
    // exists in that mailbox); fall back to the alias the client picked.
    const firstOutbound = await prisma.message.findFirst({
      where: { threadId: thread.id, direction: "outbound" },
      orderBy: { createdAt: "asc" },
      select: { fromAddress: true },
    });
    const threadAlias = firstOutbound?.fromAddress
      ? await prisma.emailAlias.findUnique({
          where: {
            brandId_address: {
              brandId: membership.brandId,
              address: firstOutbound.fromAddress,
            },
          },
          select: { id: true },
        })
      : null;
    const aliasId = threadAlias?.id ?? body.aliasId;
    if (!aliasId) {
      return NextResponse.json(
        { error: "Connect Gmail in Settings > Connections to send emails." },
        { status: 400 }
      );
    }

    // INVARIANT: AI drafts are NEVER auto-sent.
    const result = await sendEmail({
      aliasId,
      to: recipientEmail,
      subject: draft.subject ?? "Re: Collaboration",
      body: draft.body,
      bodyHtml: draft.bodyHtml ?? undefined,
      threadId: thread.id,
      externalThreadId: thread.externalThreadId ?? undefined,
      senderBrandId: membership.brandId,
    });

    // Mark draft as sent
    await prisma.aIDraft.update({
      where: { id: draft.id },
      data: {
        status: "sent",
        approvedAt: new Date(),
        approvedBy: membership.userId,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "outreach.sent",
        entityType: "ConversationThread",
        entityId: thread.id,
        metadata: { draftId: draft.id, gmailMessageId: result.gmailMessageId },
        userId: membership.userId,
        brandId: membership.brandId,
      },
    });

    return NextResponse.json({
      success: true,
      gmailMessageId: result.gmailMessageId,
      gmailThreadId: result.gmailThreadId,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const known = emailSendErrorResponse(error);
    if (known) return known;

    console.error("[inbox/send/POST]", error);
    return NextResponse.json(
      { error: "Your email didn't send. Try again in a minute." },
      { status: 500 }
    );
  }
}
