import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { removeSuppression } from "@/lib/compliance/suppression";
import {
  BrandAccessError,
  getCurrentBrandMembership,
  requireWriteAccess,
} from "@/lib/integrations/brand-access";

/** Only reasons you decided (or the tool decided from a reply) can be undone here. */
const UNDOABLE_REASONS = ["DECLINED", "REPLY_OPTOUT"];

/**
 * DELETE /api/settings/do-not-send/:id — allow emails again for someone you
 * marked "no" (or whose reply was read as "remove me"). Unsubscribe-link
 * clicks, bounces and complaints are never lifted here.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);
    const { id } = await params;
    const row = await prisma.emailSuppression.findFirst({
      where: { id, brandId: membership.brandId, reason: { in: UNDOABLE_REASONS } },
      select: { email: true, reason: true },
    });
    if (!row) {
      return NextResponse.json({ error: "This one can't be undone here." }, { status: 404 });
    }
    await removeSuppression(row.email, row.reason, membership.brandId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[do-not-send DELETE]", error);
    return NextResponse.json({ error: "Couldn't change that. Try again." }, { status: 500 });
  }
}
