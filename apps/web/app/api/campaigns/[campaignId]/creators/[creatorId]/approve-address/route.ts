import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { inngest } from "@/lib/inngest/client";
import { getFeatureFlags } from "@/lib/feature-flags";
import {
  getCurrentBrandMembership,
  requireWriteAccess,
  BrandAccessError,
} from "@/lib/integrations/brand-access";

type RouteContext = {
  params: Promise<{ campaignId: string; creatorId: string }>;
};

const bodySchema = z.object({
  snapshotId: z.string().min(1, "snapshotId is required"),
});

const ALLOWED_LIFECYCLE_STATUSES = [
  "replied",
  "address_review",
  "address_confirmed",
] as const;

/**
 * POST /api/campaigns/[campaignId]/creators/[creatorId]/approve-address
 *
 * Approves a shipping address snapshot and triggers async Shopify order creation.
 *
 * Validations:
 * 1. RBAC: user must have write access to the brand
 * 2. Feature flag: shopifyOrderEnabled must be true
 * 3. Lifecycle: creator must be in "replied", "address_review", or "address_confirmed" state
 * 4. Snapshot: must exist and belong to this campaign creator
 * 5. Shopify connection: brand must have a connected Shopify store
 * 6. Campaign product: at least one product with a shopifyVariantId
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { campaignId, creatorId } = await context.params;

    // 1. RBAC
    const membership = await getCurrentBrandMembership();
    requireWriteAccess(membership);

    // Verify campaign belongs to brand
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.brandId !== membership.brandId) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const brandId = membership.brandId;

    // 2. Feature flag guard
    const flags = await getFeatureFlags(brandId);
    if (!flags.shopifyOrderEnabled) {
      return NextResponse.json(
        { error: "Shopify order creation is disabled for this brand" },
        { status: 403 }
      );
    }

    // 3. Validate request body
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request body" },
        { status: 400 }
      );
    }

    const { snapshotId } = parsed.data;

    // 4. Load CampaignCreator + lifecycle guard
    const campaignCreator = await prisma.campaignCreator.findUnique({
      where: {
        campaignId_creatorId: { campaignId, creatorId },
      },
    });

    if (!campaignCreator) {
      return NextResponse.json(
        { error: "Campaign creator not found" },
        { status: 404 }
      );
    }

    const status = campaignCreator.lifecycleStatus;
    if (
      !ALLOWED_LIFECYCLE_STATUSES.includes(
        status as (typeof ALLOWED_LIFECYCLE_STATUSES)[number]
      )
    ) {
      return NextResponse.json(
        {
          error: `Cannot approve address in lifecycle state "${status}". Allowed: ${ALLOWED_LIFECYCLE_STATUSES.join(", ")}`,
        },
        { status: 409 }
      );
    }

    // 5. Verify snapshot exists and belongs to this campaign creator
    const snapshot = await prisma.shippingAddressSnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot || snapshot.campaignCreatorId !== campaignCreator.id) {
      return NextResponse.json(
        { error: "Shipping address snapshot not found" },
        { status: 404 }
      );
    }

    // 6. Pre-validate Shopify connection
    const shopifyConnection = await prisma.brandConnection.findUnique({
      where: {
        brandId_provider: { brandId, provider: "shopify" },
      },
    });

    if (!shopifyConnection || shopifyConnection.status !== "connected") {
      return NextResponse.json(
        { error: "No active Shopify connection found for this brand" },
        { status: 422 }
      );
    }

    // 7. Pre-validate campaign product with Shopify variant.
    // createDraftOrder consumes the related BrandProduct.shopifyVariantId,
    // so validate that source — CampaignProduct.shopifyVariantId is never
    // populated by the product-selection route.
    const campaignProduct = await prisma.campaignProduct.findFirst({
      where: {
        campaignId,
        product: { shopifyVariantId: { not: null } },
      },
    });

    if (!campaignProduct) {
      return NextResponse.json(
        {
          error:
            "No campaign product with a Shopify variant configured. Add a product first.",
        },
        { status: 422 }
      );
    }

    // 8. Activate the snapshot
    await prisma.shippingAddressSnapshot.update({
      where: { id: snapshotId },
      data: {
        isActive: true,
        confirmedAt: new Date(),
        confirmedBy: membership.userId,
      },
    });

    // 9. Fire Inngest event for async order creation
    await inngest.send({
      name: "shipping/address.approved",
      data: {
        snapshotId,
        campaignCreatorId: campaignCreator.id,
        brandId,
        campaignId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof BrandAccessError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to approve address";

    log("error", "approve_address.failed", { error: message });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
