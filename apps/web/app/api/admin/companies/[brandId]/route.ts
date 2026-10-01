import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/invites";

/** PATCH /api/admin/companies/:brandId — platform admins only. Body: { useSharedApify } */
export async function PATCH(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isPlatformAdmin(user.email)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const { brandId } = await params;
  const body = (await request.json().catch(() => ({}))) as { useSharedApify?: unknown };
  if (typeof body.useSharedApify !== "boolean") {
    return NextResponse.json({ error: "useSharedApify must be true or false" }, { status: 400 });
  }
  const { count } = await prisma.brand.updateMany({
    where: { id: brandId },
    data: { useSharedApify: body.useSharedApify },
  });
  if (count === 0) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
