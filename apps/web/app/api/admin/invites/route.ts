import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getUserBySupabaseId } from "@/lib/tenancy";
import { sendInviteEmail } from "@/lib/auth/email-link";
import { createInvite, InviteError, isPlatformAdmin } from "@/lib/invites";

async function requirePlatformAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isPlatformAdmin(user.email)) throw new InviteError("Not allowed", 403);
  return getUserBySupabaseId(user.id);
}

/** GET /api/admin/invites — companies and open company invites (platform admins only). */
export async function GET() {
  try {
    await requirePlatformAdmin();
    const [companies, invites] = await Promise.all([
      prisma.brand.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, createdAt: true, _count: { select: { memberships: true } } },
      }),
      prisma.brandInvite.findMany({
        where: { brandId: null, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, companyName: true, acceptedAt: true, expiresAt: true, createdAt: true },
      }),
    ]);
    return NextResponse.json({ companies, invites });
  } catch (error) {
    if (error instanceof InviteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[admin/invites GET]", error);
    return NextResponse.json({ error: "Couldn't load companies" }, { status: 500 });
  }
}

/** POST /api/admin/invites — invite a new company. Body: { companyName, email } */
export async function POST(request: Request) {
  try {
    const admin = await requirePlatformAdmin();
    const body = (await request.json().catch(() => ({}))) as { companyName?: unknown; email?: unknown };
    const result = await createInvite({
      email: typeof body.email === "string" ? body.email : "",
      companyName: typeof body.companyName === "string" ? body.companyName : "",
      role: "owner",
      brandId: null,
      invitedById: admin?.id ?? null,
    });
    const emailed = await sendInviteEmail({
      email: typeof body.email === "string" ? body.email.trim() : "",
      link: result.link,
      companyName: typeof body.companyName === "string" ? body.companyName.trim() : "",
      brandId: null,
      invitedById: admin?.id ?? null,
    }).then(() => true, (error) => {
      console.error("[admin/invites email]", error instanceof Error ? error.message : error);
      return false;
    });
    return NextResponse.json({ ...result, emailed });
  } catch (error) {
    if (error instanceof InviteError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[admin/invites POST]", error);
    return NextResponse.json({ error: "Couldn't create the invite" }, { status: 500 });
  }
}
