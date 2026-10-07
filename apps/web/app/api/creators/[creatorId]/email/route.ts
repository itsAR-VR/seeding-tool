import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentBrandMembership, BrandAccessError } from "@/lib/integrations/brand-access";
import { isSuppressed } from "@/lib/compliance/suppression";

type RouteContext = { params: Promise<{ creatorId: string }> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * PATCH /api/creators/:creatorId/email — give a creator a different email.
 * Body: { email }. Used after a bounce: anyone whose email bounced goes back
 * to "Not emailed yet" so they can get their first email at the new address.
 * A "no" or an unsubscribe still stands; only the bounce is cleared.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { creatorId } = await context.params;
    const membership = await getCurrentBrandMembership();
    const body = (await request.json().catch(() => ({}))) as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!EMAIL.test(email)) {
      return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
    }

    const creator = await prisma.creator.findFirst({
      where: { id: creatorId, brandId: membership.brandId },
      select: {
        id: true,
        email: true,
        campaignCreators: { select: { id: true, lifecycleStatus: true, replyDecision: true } },
      },
    });
    if (!creator) return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    if (creator.email?.toLowerCase() === email) {
      return NextResponse.json({ error: "That's the email they already have." }, { status: 400 });
    }
    if (await isSuppressed(email, membership.brandId)) {
      return NextResponse.json(
        { error: "That address is on the do-not-send list, so it can't be used." },
        { status: 400 },
      );
    }

    const bounced = creator.campaignCreators.filter((cc) => cc.lifecycleStatus === "bounced");
    // Still blocked for a reason that follows the person, not the address.
    const saidNo = creator.campaignCreators.some(
      (cc) => cc.lifecycleStatus === "opted_out" || cc.replyDecision === "no",
    );

    await prisma.$transaction([
      prisma.creator.update({
        where: { id: creator.id },
        data: { email, ...(saidNo ? {} : { optedOut: false, optOutDate: null }) },
      }),
      // They never got the first email, so they're back to "Not emailed yet".
      prisma.campaignCreator.updateMany({
        where: { id: { in: bounced.map((cc) => cc.id) } },
        data: { lifecycleStatus: "ready", outreachCount: 0, lastOutreachAt: null },
      }),
    ]);

    return NextResponse.json({ ok: true, readyAgain: bounced.length });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[creators/email PATCH]", error);
    return NextResponse.json({ error: "Couldn't save the email. Try again." }, { status: 500 });
  }
}
