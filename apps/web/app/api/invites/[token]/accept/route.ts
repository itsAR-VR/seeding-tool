import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { joinInvite } from "@/lib/invite-user";
import { findUsableInvite, InviteError } from "@/lib/invites";

/**
 * POST /api/invites/:token/accept — the signed-in invitee joins.
 * Teammate invite: adds them to the company. Company invite: unlocks the
 * setup wizard, which creates their company.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const invite = await findUsableInvite(token);

    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.email) throw new InviteError("Sign in first.", 401);
    if (authUser.email.toLowerCase() !== invite.email) {
      throw new InviteError(`This invite is for ${invite.email}. Sign in with that email.`, 403);
    }
    if (!authUser.email_confirmed_at) throw new InviteError("Confirm your email first using the link we sent.", 403);

    // Claims the invite first, so two tabs can't both use it.
    const user = await joinInvite(invite, authUser.id);
    if (!user) throw new InviteError("This invite was already used. Sign in instead.", 409);

    if (invite.brandId) {
      (await cookies()).set("seed-active-brand", invite.brandId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
      return NextResponse.json({ next: "/dashboard" });
    }
    return NextResponse.json({ next: "/onboarding" });
  } catch (error) {
    if (error instanceof InviteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[invites/accept]", error);
    return NextResponse.json({ error: "Couldn't accept the invite. Try again." }, { status: 500 });
  }
}
