import { NextResponse } from "next/server";
import { addGoogleTestUser } from "@/lib/google/oauth-admin";
import { bootstrapNewUser, getUserBySupabaseId } from "@/lib/tenancy";
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

    // Idempotency: if user already exists, skip bootstrap
    const existing = await getUserBySupabaseId(supabaseUserId);
    if (existing) {
      return NextResponse.json({ ok: true, userId: existing.id });
    }

    const { user, org } = await bootstrapNewUser(
      supabaseUserId,
      email,
      orgName || email.split("@")[0]
    );

    addGoogleTestUser(email).catch((error) =>
      console.warn("Failed to add Google test user", error)
    );

    return NextResponse.json({ ok: true, userId: user.id, orgId: org.id });
  } catch (err) {
    console.error("[auth/bootstrap]", err);
    return NextResponse.json(
      { error: "Failed to bootstrap user" },
      { status: 500 }
    );
  }
}
