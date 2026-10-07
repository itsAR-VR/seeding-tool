import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import {
  DEFAULT_RIGHTS_MONTHS,
  RIGHTS_TERMS_VERSION,
  isValidRightsMonths,
  newRightsToken,
  rightsLink,
  rightsRequestMessage,
} from "@/lib/content/rights";

/**
 * POST /api/content/:postId/rights — create (or reuse) the usage-rights link
 * for a post and return the message to send the creator.
 * Body: { months?: 12 | 6 | 0 }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { brandId } = await getCurrentBrandMembership();
    const { postId } = await params;
    const body = (await request.json().catch(() => ({}))) as { months?: unknown };
    const months = isValidRightsMonths(body.months) ? body.months : DEFAULT_RIGHTS_MONTHS;

    const post = await prisma.contentPost.findFirst({
      where: { id: postId, brandId },
      include: {
        creator: { select: { name: true } },
        brand: { select: { name: true } },
      },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    if (post.rightsStatus === "approved") {
      return NextResponse.json({ error: "Rights are already approved" }, { status: 409 });
    }

    // Keep the same link if one was already sent, so the creator's copy still works.
    const token = post.rightsToken ?? newRightsToken();
    await prisma.contentPost.update({
      where: { id: post.id },
      data: {
        rightsToken: token,
        rightsStatus: "requested",
        rightsMonths: months,
        rightsTermsVersion: RIGHTS_TERMS_VERSION,
        rightsRequestedAt: post.rightsRequestedAt ?? new Date(),
      },
    });

    const firstName = post.creator?.name?.trim().split(/\s+/)[0] ?? null;
    const link = rightsLink(token);
    return NextResponse.json({ link, message: rightsRequestMessage(post.brand.name, firstName, link) });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[content/rights]", error);
    return NextResponse.json({ error: "Could not create the request" }, { status: 500 });
  }
}
