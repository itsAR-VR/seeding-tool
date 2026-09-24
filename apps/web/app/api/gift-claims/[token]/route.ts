import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashClaimToken } from "@/lib/gift-claims/tokens";
import { getFeatureFlags } from "@/lib/feature-flags";
import { createDraftOrder } from "@/lib/shopify/orders";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ token: string }>;
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
};

const textField = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value));

const claimSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: textField(40).optional(),
  line1: z.string().trim().min(3).max(160),
  line2: textField(160).optional(),
  city: z.string().trim().min(2).max(100),
  state: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
  postalCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/),
});

async function findClaim(token: string) {
  return prisma.creatorGiftClaim.findUnique({
    where: { tokenHash: hashClaimToken(token) },
    include: {
      campaignProduct: {
        include: { product: true },
      },
      campaignCreator: {
        select: {
          id: true,
          creatorId: true,
          campaign: {
            select: {
              id: true,
              brandId: true,
              name: true,
              brand: {
                select: { name: true },
              },
            },
          },
        },
      },
    },
  });
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const claim = await findClaim(token);
  const now = new Date();

  if (!claim) {
    return NextResponse.json(
      { error: "Claim link not found" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  const unavailableReason = claim.revokedAt
    ? "revoked"
    : claim.claimedAt
      ? "submitted"
      : claim.expiresAt <= now
        ? "expired"
        : null;

  if (unavailableReason) {
    return NextResponse.json(
      { error: "Claim link is no longer available", reason: unavailableReason },
      { status: 410, headers: NO_STORE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      brandName: claim.campaignCreator.campaign.brand.name,
      campaignName: claim.campaignCreator.campaign.name,
      giftName: claim.campaignProduct?.product.name ?? "Kalm gift",
      expiresAt: claim.expiresAt.toISOString(),
    },
    { headers: NO_STORE_HEADERS }
  );
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const claim = await findClaim(token);
  const now = new Date();

  if (!claim) {
    return NextResponse.json(
      { error: "Claim link not found" },
      { status: 404, headers: NO_STORE_HEADERS }
    );
  }

  if (claim.revokedAt || claim.claimedAt || claim.expiresAt <= now) {
    return NextResponse.json(
      { error: "Claim link is no longer available" },
      { status: 410, headers: NO_STORE_HEADERS }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a complete U.S. shipping address" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  const data = parsed.data;

  let snapshotId: string | null = null;
  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.creatorGiftClaim.updateMany({
        where: {
          id: claim.id,
          claimedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { claimedAt: now },
      });

      if (claimed.count !== 1) {
        throw new Error("claim_already_submitted");
      }

      await tx.shippingAddressSnapshot.updateMany({
        where: {
          campaignCreatorId: claim.campaignCreatorId,
          source: "creator_provided",
          isActive: false,
          confirmedAt: null,
        },
        data: { isLocked: true },
      });

      const snapshot = await tx.shippingAddressSnapshot.create({
        data: {
          fullName: data.fullName,
          line1: data.line1,
          line2: data.line2 ?? null,
          city: data.city,
          state: data.state,
          postalCode: data.postalCode,
          country: "US",
          phone: data.phone ?? null,
          source: "creator_provided",
          isActive: false,
          isLocked: false,
          campaignCreatorId: claim.campaignCreatorId,
        },
        select: { id: true },
      });
      snapshotId = snapshot.id;

      await tx.creatorGiftClaim.update({
        where: { id: claim.id },
        data: {
          shippingAddressSnapshotId: snapshot.id,
          contactEmail: data.email,
          contactPhone: data.phone ?? null,
        },
      });

      await tx.campaignCreator.update({
        where: { id: claim.campaignCreatorId },
        data: { lifecycleStatus: "address_review" },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "claim_already_submitted") {
      return NextResponse.json(
        { error: "Claim link is no longer available" },
        { status: 409, headers: NO_STORE_HEADERS }
      );
    }

    console.error("[gift-claim/POST]", "Submission failed");
    return NextResponse.json(
      { error: "Unable to submit this claim right now" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }

  const draftStatus = await maybeAutoDraft(claim, snapshotId, data.email);

  return NextResponse.json(
    {
      success: true,
      status: draftStatus === "drafted" ? "draft_order_created" : "submitted_for_review",
    },
    { headers: NO_STORE_HEADERS }
  );
}

type FoundClaim = NonNullable<Awaited<ReturnType<typeof findClaim>>>;

/**
 * When the brand has claimAutoDraftEnabled, accept the creator's address and
 * create a Shopify draft order right away. The draft is never completed here,
 * so nothing ships until someone completes it. Failures leave the claim in
 * address_review for manual follow-up; the creator still sees success.
 */
async function maybeAutoDraft(
  claim: FoundClaim,
  snapshotId: string | null,
  email: string
): Promise<"drafted" | "skipped" | "failed"> {
  const campaign = claim.campaignCreator?.campaign;
  const creatorId = claim.campaignCreator?.creatorId;
  if (!snapshotId || !campaign?.id || !campaign.brandId || !creatorId) return "skipped";

  const flags = await getFeatureFlags(campaign.brandId);
  if (!flags.claimAutoDraftEnabled) return "skipped";

  try {
    const now = new Date();
    await prisma.$transaction([
      prisma.shippingAddressSnapshot.updateMany({
        where: { campaignCreatorId: claim.campaignCreatorId, isActive: true },
        data: { isActive: false },
      }),
      prisma.shippingAddressSnapshot.update({
        where: { id: snapshotId },
        data: { isActive: true, confirmedAt: now },
      }),
    ]);

    await createDraftOrder(campaign.brandId, creatorId, campaign.id, { email });

    await prisma.campaignCreator.update({
      where: { id: claim.campaignCreatorId },
      data: { lifecycleStatus: "address_confirmed" },
    });
    return "drafted";
  } catch (error) {
    log("error", "gift_claim.auto_draft_failed", {
      campaignCreatorId: claim.campaignCreatorId,
      error: error instanceof Error ? error.message : String(error),
    });
    return "failed";
  }
}
