import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findUsableInvite, InviteError } from "@/lib/invites";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * POST /api/invites/:token/account — create the login for an invited email.
 * Body: { password }. The invite link proves the person was invited, so the
 * account is created already confirmed. Existing users are told to sign in.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const invite = await findUsableInvite(token);
    const body = (await request.json().catch(() => ({}))) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 8) throw new InviteError("Use at least 8 characters for your password.");

    const existing = await prisma.user.findUnique({ where: { email: invite.email }, select: { id: true } });
    if (existing) return NextResponse.json({ exists: true });

    const { error } = await getSupabaseAdmin().auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    });
    if (error) {
      // Already in Supabase auth but not in our users table: they can sign in.
      if (/already.*registered|exists/i.test(error.message)) return NextResponse.json({ exists: true });
      throw error;
    }
    return NextResponse.json({ created: true, email: invite.email });
  } catch (error) {
    if (error instanceof InviteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[invites/account]", error);
    return NextResponse.json({ error: "Couldn't create your account. Try again." }, { status: 500 });
  }
}
