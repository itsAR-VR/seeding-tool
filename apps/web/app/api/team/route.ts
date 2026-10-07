import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BrandAccessError, getCurrentBrandMembership } from "@/lib/integrations/brand-access";

/** GET /api/team — this company's members and open invites. */
export async function GET() {
  try {
    const membership = await getCurrentBrandMembership();
    const [members, invites] = await Promise.all([
      prisma.brandMembership.findMany({
        where: { brandId: membership.brandId },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, createdAt: true, user: { select: { email: true } } },
      }),
      prisma.brandInvite.findMany({
        where: { brandId: membership.brandId, acceptedAt: null, revokedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expiresAt: true },
      }),
    ]);
    return NextResponse.json({
      myRole: membership.role,
      members: members.map((m) => ({ id: m.id, email: m.user.email, role: m.role, joinedAt: m.createdAt })),
      invites,
    });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[team GET]", error);
    return NextResponse.json({ error: "Couldn't load the team" }, { status: 500 });
  }
}
