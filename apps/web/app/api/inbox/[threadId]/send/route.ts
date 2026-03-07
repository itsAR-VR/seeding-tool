import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/gmail/send";

type RouteContext = { params: Promise<{ threadId: string }> };

/**
 * POST /api/inbox/:threadId/send
 * Body: { draftId: string, aliasId: string }
 *
 * Confirms and sends a draft, marks AIDraft.status = "sent".
 *
 * // INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.
 * This endpoint is the ONLY path through which drafts become sent messages.
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

    if (!body.draftId || !body.aliasId) {
      return NextResponse.json(
        { error: "draftId and aliasId are required" },
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
        { error: "Draft not found or already sent" },
        { status: 404 }
      );
    }

    // Get recipient email
    const recipientEmail = thread.campaignCreator.creator.email;
    if (!recipientEmail) {
      return NextResponse.json(
        { error: "Creator has no email address" },
        { status: 400 }
      );
    }

    // INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.
    // This is the explicit human action path.
    const result = await sendEmail({
      aliasId: body.aliasId,
      to: recipientEmail,
      subject: draft.subject ?? "Re: Collaboration",
      body: draft.body,
      threadId: thread.id,
      externalThreadId: thread.externalThreadId ?? undefined,
    });

    // Mark draft as sent
    await prisma.aIDraft.update({
      where: { id: draft.id },
      data: {
        status: "sent",
        approvedAt: new Date(),
        approvedBy: user.id,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        action: "outreach.sent",
        entityType: "ConversationThread",
        entityId: thread.id,
        metadata: { draftId: draft.id, gmailMessageId: result.gmailMessageId },
        userId: user.id,
        brandId: membership.brandId,
      },
    });

    return NextResponse.json({
      success: true,
      gmailMessageId: result.gmailMessageId,
      gmailThreadId: result.gmailThreadId,
    });
  } catch (error) {
    console.error("[inbox/send/POST]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send message",
      },
      { status: 500 }
    );
  }
}
