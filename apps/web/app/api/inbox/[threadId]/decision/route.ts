import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import { addSuppression, removeSuppression } from "@/lib/compliance/suppression";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";
import { guessFromIntent, type ReplyDecision } from "@/lib/inbox/decision";
import { OPT_OUT_CLASSIFICATION } from "@/lib/inbox/opt-out";

type RouteContext = { params: Promise<{ threadId: string }> };

/** Suppression reason used for creators who said no; only these are lifted on a change of mind. */
const DECLINED_REASON = "DECLINED";

/**
 * POST /api/inbox/:threadId/decision
 * Body: { decision: "yes" | "no" | "later" | null, undo?: boolean }
 *
 * Records the operator's call on a creator's reply. "no" closes the
 * conversation and adds the email to the do-not-send list; switching away
 * from "no" lifts only a suppression that this decision created.
 * null clears the call (Undo), putting the reply back in "Needs your call".
 * undo: true restores an earlier answer without recording a new outcome.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { threadId } = await context.params;
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    const { decision, undo } = (await request.json()) as { decision?: ReplyDecision | null; undo?: boolean };
    if (decision !== null && decision !== "yes" && decision !== "no" && decision !== "later") {
      return NextResponse.json({ error: "decision must be yes, no, later or null" }, { status: 400 });
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

    // Leaving a "no": lift only the suppression that "no" created.
    if (decision !== "no" && cc.replyDecision === "no" && email) {
      // Only this brand's "no"; other brands' opt-outs and global blocks stay.
      await removeSuppression(email, DECLINED_REASON, thread.brandId);
      // A "no" the tool made for an "unsubscribe" reply: the operator read it
      // and disagrees, so lift that opt-out too. An unsubscribe-link click is a
        // separate UNSUBSCRIBE row and stays.
      if (thread.messages[0]?.classification === OPT_OUT_CLASSIFICATION) {
        await removeSuppression(email, "REPLY_OPTOUT", thread.brandId);
      }
    }

    if (decision === null) {
      // Undo: back to undecided, so it shows in "Needs your call" again.
      await prisma.campaignCreator.update({
        where: { id: cc.id },
        data: {
          replyDecision: null,
          replyDecidedAt: null,
          ...(cc.lifecycleStatus === "opted_out" || cc.lifecycleStatus === "stalled"
            ? { lifecycleStatus: "replied" }
            : {}),
        },
      });
      await prisma.conversationThread.update({
        where: { id: thread.id },
        data: { status: "open" },
      });
    } else if (decision === "later") {
      // Park: close the conversation, no suppression, can be emailed in a future campaign.
      await prisma.campaignCreator.update({
        where: { id: cc.id },
        data: {
          replyDecision: "later",
          replyDecidedAt: now,
          aiSuggestion,
          lifecycleStatus: "stalled",
        },
      });
      await prisma.conversationThread.update({
        where: { id: thread.id },
        data: { status: "closed" },
      });
    } else if (decision === "no") {
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
      if (email) await addSuppression(email, DECLINED_REASON, thread.brandId);
    } else {
      await prisma.campaignCreator.update({
        where: { id: cc.id },
        data: {
          replyDecision: "yes",
          replyDecidedAt: now,
          aiSuggestion,
          ...(cc.lifecycleStatus === "opted_out" || cc.lifecycleStatus === "stalled"
            ? { lifecycleStatus: "replied" }
            : {}),
        },
      });
      await prisma.conversationThread.update({
        where: { id: thread.id },
        data: { status: "open" },
      });
      if (cc.replyDecision !== "yes" && !undo) {
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
