import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findUsableInvite, InviteError } from "@/lib/invites";
import { EmailLinkError, sendSignInLink } from "@/lib/auth/email-link";

/** One link per invite per minute, so a leaked invite can't spam the inbox. */
const RESEND_AFTER_MS = 60 * 1000;

/**
 * POST /api/invites/:token/link — email a sign-in link to the invited
 * address. Opening it proves they own the email and brings them back to the
 * invite signed in, where they accept.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const invite = await findUsableInvite(token);

    const reserved = await prisma.brandInvite.updateMany({
      where: {
        id: invite.id,
        OR: [{ linkSentAt: null }, { linkSentAt: { lt: new Date(Date.now() - RESEND_AFTER_MS) } }],
      },
      data: { linkSentAt: new Date() },
    });
    if (reserved.count === 0) {
      return NextResponse.json({ error: "We just sent a link. Wait a minute, then try again." }, { status: 429 });
    }

    try {
      await sendSignInLink({
        email: invite.email,
        continuePath: `/invite/${encodeURIComponent(token)}/continue`,
        companyName: invite.brand?.name ?? invite.companyName ?? "your company",
        brandId: invite.brandId,
        invitedById: invite.invitedById,
      });
    } catch (error) {
      await prisma.brandInvite.update({ where: { id: invite.id }, data: { linkSentAt: null } });
      throw error;
    }
    return NextResponse.json({ sent: true });
  } catch (error) {
    if (error instanceof InviteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[invites/link]", error instanceof EmailLinkError ? error.message : error);
    return NextResponse.json(
      { error: "Couldn't send the email. Ask the person who invited you to check their Gmail connection." },
      { status: 500 },
    );
  }
}
