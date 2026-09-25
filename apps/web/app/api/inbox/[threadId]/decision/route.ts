import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import { addSuppression } from "@/lib/compliance/suppression";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";
import { guessFromIntent, type ReplyDecision } from "@/lib/inbox/decision";

type RouteContext = { params: Promise<{ threadId: string }> };

/** Suppression reason used for creators who said no; only these are lifted on a change of mind. */
const DECLINED_REASON = "DECLINED";

/**
 * POST /api/inbox/:threadId/decision
 * Body: { decision: "yes" | "no" }
 *
 * Records the operator's call on a creator's reply. "no" closes the
 * conversation and adds the email to the do-not-send list; switching back to
 * "yes" lifts only a suppression that this decision created.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const { decision } = (await request.json()) as { decision?: ReplyDecision };
    if (decision !== "yes" && decision !== "no") {
      return NextResponse.json({ error: "decision must be yes or no" }, { status: 400 });
    }

    const thread = await prisma.conversationThread.findFirst({
      where: { id: threadId, brandId: membership.brandId },
      include: {
        campaignCreator: { include: { creator: true } },
        messages: {
          where: { direction: "inbound" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { classification: true },
        },
      },
    });
    if (!thread) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const cc = thread.campaignCreator;
    const email = cc.creator.email?.toLowerCase().trim() ?? null;
    const aiSuggestion = guessFromIntent(thread.messages[0]?.classification);
    const now = new Date();

    if (decision === "no") {
      await prisma.campaignCreator.update({
        where: { id: cc.id },
        data: {
          replyDecision: "no",
          replyDecidedAt: now,
          aiSuggestion,
          lifecycleStatus: "opted_out",
        },
      });
      await prisma.conversationThread.update({
        where: { id: thread.id },
        data: { status: "closed" },
      });
      if (email) await addSuppression(email, DECLINED_REASON);
    } else {
      // Changing a "no" back to "yes": lift only the suppression that "no" created.
      if (cc.replyDecision === "no" && email) {
        const existing = await prisma.emailSuppression.findUnique({ where: { email } });
        if (existing?.reason === DECLINED_REASON) {
          await prisma.emailSuppression.delete({ where: { email } });
          await prisma.creator.updateMany({
            where: { email },
            data: { optedOut: false, optOutDate: null },
          });
        }
      }
      await prisma.campaignCreator.update({
        where: { id: cc.id },
        data: {
          replyDecision: "yes",
          replyDecidedAt: now,
          aiSuggestion,
          ...(cc.lifecycleStatus === "opted_out" ? { lifecycleStatus: "replied" } : {}),
        },
      });
      await prisma.conversationThread.update({
        where: { id: thread.id },
        data: { status: "open" },
      });
      if (cc.replyDecision !== "yes") {
        await recordOutcomeEvent({ campaignCreatorId: cc.id, event: { type: "accepted" } });
      }
    }

    return NextResponse.json({ success: true, decision, aiSuggestion });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[inbox/decision]", error);
    return NextResponse.json({ error: "Could not save your decision" }, { status: 500 });
  }
}
