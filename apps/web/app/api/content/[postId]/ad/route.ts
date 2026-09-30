import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import { createPausedBrandAd, MetaAdsError } from "@/lib/meta/ads";

// Uploading a video to Meta and waiting for it to process takes a while.
export const maxDuration = 60;

/**
 * POST /api/content/:postId/ad — make a PAUSED Meta ad from an approved post.
 * Body: { message, headline, link }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  try {
    const { brandId } = await getCurrentBrandMembership();
    const { postId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      message?: unknown;
      headline?: unknown;
      link?: unknown;
    };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const headline = typeof body.headline === "string" ? body.headline.trim() : "";
    const link = typeof body.link === "string" ? body.link.trim() : "";
    if (!message || !headline || !/^https:\/\//.test(link)) {
      return NextResponse.json({ error: "Fill in the text, headline, and an https link." }, { status: 400 });
    }

    const post = await prisma.contentPost.findFirst({ where: { id: postId, brandId }, select: { id: true } });
    if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

    const result = await createPausedBrandAd(post.id, { message, headline, link });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof MetaAdsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[content/ad]", error);
    return NextResponse.json({ error: "Could not create the ad" }, { status: 500 });
  }
}
