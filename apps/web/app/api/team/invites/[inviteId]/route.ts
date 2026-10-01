import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BrandAccessError,
  getCurrentBrandMembership,
  requireAdminAccess,
} from "@/lib/integrations/brand-access";

/** DELETE /api/team/invites/:inviteId — cancel an open invite for this company. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  try {
    const membership = requireAdminAccess(await getCurrentBrandMembership());
    const { inviteId } = await params;
    const { count } = await prisma.brandInvite.updateMany({
      where: { id: inviteId, brandId: membership.brandId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[team/invites DELETE]", error);
    return NextResponse.json({ error: "Couldn't cancel the invite" }, { status: 500 });
  }
}
