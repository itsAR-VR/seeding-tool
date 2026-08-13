import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { getFeatureFlags } from "@/lib/feature-flags";
import { createDraftOrder } from "@/lib/shopify/orders";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";

/**
 * Inngest function: Create Shopify order from an approved shipping address.
 *
 * Trigger: "shipping/address.approved"
 *
 * Steps:
 * 1. Validate snapshot is active + confirmed
 * 2. Load CampaignCreator with creator relation (need creatorId for Shopify)
 * 3. Check feature flag (fail-closed: skip if disabled)
 * 4. Idempotency guard: skip if order already exists
 * 5. Create draft order via Shopify API
 * 6. Record outcome event
 * 7. On Shopify error: create InterventionCase
 *
 * // INVARIANT: createDraftOrder takes (brandId, creatorId, campaignId) — NOT campaignCreatorId
 * // INVARIANT: Feature flag checked here AND in the API route (defense in depth)
 */
export const createOrderFromAddress = inngest.createFunction(
  {
    id: "create-order-from-address",
    name: "Create Order from Approved Address",
    retries: 3,
    concurrency: { limit: 5 },
  },
  { event: "shipping/address.approved" },
  async ({ event }) => {
    const { snapshotId, campaignCreatorId, brandId, campaignId } = event.data;

    // 1. Validate snapshot
    const snapshot = await prisma.shippingAddressSnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot || !snapshot.isActive || !snapshot.confirmedAt) {
      log("warn", "create_order.snapshot_invalid", {
        snapshotId,
        campaignCreatorId,
      });
      return { status: "skipped", reason: "snapshot_not_active_or_confirmed" };
    }

    // 2. Load CampaignCreator with creator relation
    const campaignCreator = await prisma.campaignCreator.findUnique({
      where: { id: campaignCreatorId },
      include: {
        creator: { select: { id: true } },
        shopifyOrder: { select: { id: true } },
      },
    });

    if (!campaignCreator) {
      log("error", "create_order.campaign_creator_not_found", {
        campaignCreatorId,
      });
      return { status: "skipped", reason: "campaign_creator_not_found" };
    }

    // 3. Feature flag guard (defense in depth — also checked in API)
    const flags = await getFeatureFlags(brandId);
    if (!flags.shopifyOrderEnabled) {
      log("info", "create_order.feature_disabled", { brandId });
      return { status: "skipped", reason: "feature_disabled" };
    }

    // 4. Idempotency: skip if order already exists
    if (campaignCreator.shopifyOrder) {
      log("info", "create_order.already_exists", {
        campaignCreatorId,
        orderId: campaignCreator.shopifyOrder.id,
      });
      return { status: "success", reason: "order_already_exists" };
    }

    // 5. Create the draft order
    try {
      const result = await createDraftOrder(
        brandId,
        campaignCreator.creatorId,
        campaignId
      );

      // 6. Record outcome
      await recordOutcomeEvent({
        campaignCreatorId,
        event: { type: "order_created" },
      });

      log("info", "create_order.success", {
        campaignCreatorId,
        brandId,
        shopifyOrderId: result.shopifyOrderId,
      });

      return {
        status: "success",
        shopifyOrderId: result.shopifyOrderId,
        orderId: result.orderId,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Shopify error";

      log("error", "create_order.shopify_failed", {
        campaignCreatorId,
        brandId,
        error: message,
      });

      // 7. Create intervention for manual resolution
      await prisma.interventionCase.create({
        data: {
          type: "duplicate_order",
          status: "open",
          priority: "high",
          title: "Automatic order creation failed",
          description: `Shopify draft order creation failed after address approval.\n\nError: ${message}\n\nSnapshot: ${snapshotId}`,
          brandId,
          campaignCreatorId,
        },
      });

      // Re-throw so Inngest retries
      throw error;
    }
  }
);
