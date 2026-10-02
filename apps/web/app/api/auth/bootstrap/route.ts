import { NextResponse } from "next/server";
import { addGoogleTestUser } from "@/lib/google/oauth-admin";
import { ensureAppUser, getOrAcceptInvitedUser } from "@/lib/invite-user";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/bootstrap
 * Called after Supabase signup to create User + Organization + Membership.
 *
 * Body: { orgName?: string }. The user comes only from the server session.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { orgName?: string };
    const { orgName } = body;

    // Only the signed-in, confirmed user can be bootstrapped. Never trust an
    // id or email from the request body: that would let anyone claim an email.
    const supabase = await createClient();
    const { data: { user: sessionUser } } = await supabase.auth.getUser();
    if (!sessionUser?.email || !sessionUser.email_confirmed_at) {
      return NextResponse.json({ error: "Sign in first" }, { status: 401 });
    }
    const supabaseUserId = sessionUser.id;
    const email = sessionUser.email;

    // Existing user, or an invitee who set a password but never pressed
    // "Accept invite": join their invite now instead of making an empty
    // account that would leave the invite unused.
    const existing = await getOrAcceptInvitedUser(sessionUser);
    if (existing) {
      return NextResponse.json({ ok: true, userId: existing.id });
    }

    const user = await ensureAppUser(supabaseUserId, email, orgName || email.split("@")[0]);

    addGoogleTestUser(email).catch((error) =>
      console.warn("Failed to add Google test user", error)
    );

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    console.error("[auth/bootstrap]", err);
    return NextResponse.json(
      { error: "Failed to bootstrap user" },
      { status: 500 }
    );
  }
}
