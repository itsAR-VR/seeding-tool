import { NextResponse } from "next/server";
import { addGoogleTestUser } from "@/lib/google/oauth-admin";
import { bootstrapNewUser, getUserBySupabaseId } from "@/lib/tenancy";

/**
 * POST /api/auth/bootstrap
 * Called after Supabase signup to create User + Organization + Membership.
 *
 * Body: { supabaseUserId: string, email: string, orgName: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { supabaseUserId, email, orgName } = body;

    if (!supabaseUserId || !email) {
      return NextResponse.json(
        { error: "supabaseUserId and email are required" },
        { status: 400 }
      );
    }

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
