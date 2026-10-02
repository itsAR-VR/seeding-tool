import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";
import {
  createPausedPartnershipAd,
  lookupPartnershipMedia,
  MetaAdsError,
} from "@/lib/meta/ads";

export const maxDuration = 60;

/**
 * POST /api/ads/partnership — make a PAUSED partnership ad from any creator
 * code, even for a post that isn't in the Content library.
 * Body: { adCode, postUrl? }
 */
export async function POST(request: Request) {
  try {
    const membership = requireWriteAccess(await getCurrentBrandMembership());
    const { brandId } = membership;
    const body = (await request.json().catch(() => ({}))) as { adCode?: unknown; postUrl?: unknown };
    const adCode = typeof body.adCode === "string" ? body.adCode.trim() : "";
    const postUrl = typeof body.postUrl === "string" ? body.postUrl.trim() : "";
    if (!adCode) return NextResponse.json({ error: "Paste the creator's code." }, { status: 400 });

    const media = await lookupPartnershipMedia(brandId, adCode, postUrl || undefined);
    if (!media) {
      return NextResponse.json(
        { error: "Meta couldn't find that post. Check the code and the post link, or ask for a new code." },
        { status: 400 }
      );
    }

    // Track it alongside library posts so it shows on the Ads page.
    const post = await prisma.contentPost.upsert({
      where: { brandId_platform_externalId: { brandId, platform: "instagram", externalId: media.mediaId } },
      update: {},
      create: {
        brandId,
        platform: "instagram",
        externalId: media.mediaId,
        permalink: media.permalink,
        username: media.username,
        mediaType: media.mediaType,
        source: "partnership_code",
      },
    });
    return NextResponse.json(await createPausedPartnershipAd(post.id, adCode));
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof MetaAdsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[ads/partnership]", error);
    return NextResponse.json({ error: "Couldn't make the ad. Try again in a minute." }, { status: 500 });
  }
}
