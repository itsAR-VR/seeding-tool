import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getShopifyClient } from "./client";

/** Thrown when an order already exists (or is being created) for the campaign creator. */
export class OrderAlreadyExistsError extends Error {
  constructor(campaignCreatorId: string) {
    super(`Order already exists for campaign creator ${campaignCreatorId}`);
    this.name = "OrderAlreadyExistsError";
  }
}

/**
 * Create a Shopify draft order for a creator gift and persist it for operator review.
 *
 * Flow:
 * 1. Fetch confirmed ShippingAddressSnapshot
 * 2. Fetch gifted product/variant from campaign
 * 3. CLAIM: insert a pending ShopifyOrder row — the unique campaignCreatorId
 *    makes this the atomic idempotency key, claimed BEFORE any Shopify call
 * 4. POST draft order with 100% discount ($0)
 * 5. Update the claimed row with the Shopify draft ids (released on failure
 *    only if Shopify never created a draft)
 *
 * This function must not call /complete.json. A draft is reviewable intent,
 * not a real order, shipment, or fulfillment proof.
 */
export async function createDraftOrder(
  brandId: string,
  creatorId: string,
  campaignId: string
): Promise<{
  shopifyDraftOrderId: string;
  shopifyDraftOrderName: string;
  orderId: string;
}> {
  // Guard: check for existing order
  const campaignCreator = await prisma.campaignCreator.findUnique({
    where: {
      campaignId_creatorId: { campaignId, creatorId },
    },
    include: {
      shopifyOrder: true,
      creator: true,
    },
  });

  if (!campaignCreator) {
    throw new Error("CampaignCreator not found");
  }

  // INVARIANT: One-order-per-campaign-creator — fast-path read guard
  if (campaignCreator.shopifyOrder) {
    if (
      campaignCreator.shopifyOrder.shopifyDraftOrderId &&
      !campaignCreator.shopifyOrder.shopifyOrderId
    ) {
      return {
        shopifyDraftOrderId: campaignCreator.shopifyOrder.shopifyDraftOrderId,
        shopifyDraftOrderName:
          campaignCreator.shopifyOrder.shopifyDraftOrderName ?? "",
        orderId: campaignCreator.shopifyOrder.id,
      };
    }
    throw new OrderAlreadyExistsError(campaignCreator.id);
  }

  // 1. Fetch confirmed shipping address
  const address = await prisma.shippingAddressSnapshot.findFirst({
    where: {
      campaignCreatorId: campaignCreator.id,
      isActive: true,
      confirmedAt: { not: null },
    },
    orderBy: { confirmedAt: "desc" },
  });

  if (!address) {
    throw new Error(
      `No confirmed shipping address for campaign creator ${campaignCreator.id}`
    );
  }

  // 2. Fetch gifted product from campaign
  const campaignProduct = await prisma.campaignProduct.findFirst({
    where: { campaignId },
    include: { product: true },
  });

  if (!campaignProduct?.product) {
    throw new Error(`No product configured for campaign ${campaignId}`);
  }

  const product = campaignProduct.product;

  if (!product.shopifyVariantId) {
    throw new Error(
      `Product ${product.id} has no Shopify variant ID configured`
    );
  }

  // 3. Claim the order slot atomically BEFORE any Shopify call. The unique
  // campaignCreatorId constraint means a concurrent execution loses the
  // insert instead of completing an untracked duplicate order.
  let claimId: string;
  try {
    const claim = await prisma.shopifyOrder.create({
      data: {
        shopifyDraftOrderId: `pending:${randomUUID()}`,
        status: "draft_pending",
        currency: "USD",
        campaignCreatorId: campaignCreator.id,
      },
      select: { id: true },
    });
    claimId = claim.id;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new OrderAlreadyExistsError(campaignCreator.id);
    }
    throw error;
  }

  let draftOrderId: string | null = null;
  let draftOrderName: string | null = null;
  try {
    // 4. Create draft order via Shopify API
    const client = await getShopifyClient(brandId);

    const draftOrderPayload = {
      draft_order: {
        line_items: [
          {
            variant_id: parseInt(product.shopifyVariantId, 10),
            quantity: 1,
          },
        ],
        applied_discount: {
          description: "Creator seeding gift — 100% off",
          value_type: "percentage",
          value: "100.0",
          title: "Creator Gift",
        },
        shipping_address: {
          first_name: address.fullName?.split(" ")[0] || "",
          last_name: address.fullName?.split(" ").slice(1).join(" ") || "",
          address1: address.line1 || "",
          address2: address.line2 || "",
          city: address.city || "",
          province: address.state || "",
          zip: address.postalCode || "",
          country: address.country || "US",
          phone: address.phone || "",
        },
        note: `Seed Scale gift — Campaign: ${campaignId}, Creator: ${campaignCreator.creator.name || campaignCreator.creator.email || creatorId}`,
        tags: "seed-scale,creator-gift",
      },
    };

    const draftResponse = await client.fetch("/draft_orders.json", {
      method: "POST",
      body: JSON.stringify(draftOrderPayload),
    });

    if (!draftResponse.ok) {
      const errText = await draftResponse.text();
      throw new Error(`Shopify draft order creation failed: ${errText}`);
    }

    const draftData = (await draftResponse.json()) as {
      draft_order: { id: number; order_id: number | null; name: string };
    };

    draftOrderId = String(draftData.draft_order.id);
    draftOrderName = draftData.draft_order.name;
    // From here on a Shopify-side artifact exists; the claim must survive
    // any local failure so retries cannot create a second order.

    // 5. Fill in the claimed row with the reviewable Shopify draft ids only.
    const order = await prisma.shopifyOrder.update({
      where: { id: claimId },
      data: {
        shopifyOrderId: null,
        shopifyOrderNumber: null,
        shopifyDraftOrderId: draftOrderId,
        shopifyDraftOrderName: draftOrderName,
        status: "draft_created",
        totalPrice: 0, // 100% discount
        currency: "USD",
      },
    });

    return {
      shopifyDraftOrderId: draftOrderId,
      shopifyDraftOrderName: draftOrderName,
      orderId: order.id,
    };
  } catch (error) {
    if (draftOrderId) {
      // Shopify created a draft — never release the claim
      // (a retry would create a duplicate). Mark it for reconciliation.
      try {
        await prisma.shopifyOrder.update({
          where: { id: claimId },
          data: {
            shopifyDraftOrderId: draftOrderId,
            shopifyDraftOrderName: draftOrderName,
            status: "error_needs_reconciliation",
          },
        });
      } catch {
        // original error takes precedence
      }
    } else {
      // Failed before any Shopify artifact existed — release the claim
      // so a retry can proceed (best-effort).
      try {
        await prisma.shopifyOrder.delete({ where: { id: claimId } });
      } catch {
        // claim row may already be gone; the original error takes precedence
      }
    }
    throw error;
  }
}

/**
 * Complete a previously-created Shopify draft order after operator review.
 *
 * This is the only helper in this module allowed to call /complete.json.
 */
export async function completeDraftOrder(
  brandId: string,
  creatorId: string,
  campaignId: string
): Promise<{
  shopifyOrderId: string;
  orderId: string;
  campaignCreatorId: string;
}> {
  const campaignCreator = await prisma.campaignCreator.findUnique({
    where: {
      campaignId_creatorId: { campaignId, creatorId },
    },
    include: {
      shopifyOrder: true,
    },
  });

  if (!campaignCreator) {
    throw new Error("CampaignCreator not found");
  }

  const order = campaignCreator.shopifyOrder;
  if (!order) {
    throw new Error("No Shopify draft order exists for this creator");
  }

  if (order.shopifyOrderId) {
    await prisma.campaignCreator.update({
      where: { id: campaignCreator.id },
      data: { lifecycleStatus: "order_created" },
    });
    return {
      shopifyOrderId: order.shopifyOrderId,
      orderId: order.id,
      campaignCreatorId: campaignCreator.id,
    };
  }

  if (!order.shopifyDraftOrderId) {
    throw new Error("Shopify draft order ID is missing");
  }

  if (order.status !== "draft_created") {
    throw new Error(
      `Shopify draft cannot be completed from status "${order.status}"`
    );
  }

  // Atomically claim the completion step before calling Shopify. This prevents
  // two operator clicks or retries from completing the same draft concurrently.
  const completionClaim = await prisma.shopifyOrder.updateMany({
    where: {
      id: order.id,
      shopifyOrderId: null,
      status: "draft_created",
    },
    data: { status: "draft_completing" },
  });

  if (completionClaim.count !== 1) {
    const latest = await prisma.shopifyOrder.findUnique({
      where: { id: order.id },
    });

    if (latest?.shopifyOrderId) {
      return {
        shopifyOrderId: latest.shopifyOrderId,
        orderId: latest.id,
        campaignCreatorId: campaignCreator.id,
      };
    }

    throw new Error(
      "Shopify draft completion is already in progress or needs reconciliation"
    );
  }

  try {
    const client = await getShopifyClient(brandId);
    const completeResponse = await client.fetch(
      `/draft_orders/${order.shopifyDraftOrderId}/complete.json`,
      { method: "PUT" }
    );

    if (!completeResponse.ok) {
      const errText = await completeResponse.text();
      throw new Error(`Shopify draft order completion failed: ${errText}`);
    }

    const completeData = (await completeResponse.json()) as {
      draft_order: { id: number; order_id: number; name: string; status: string };
    };

    const shopifyOrderId = String(completeData.draft_order.order_id);
    const shopifyOrderNumber = completeData.draft_order.name;

    await prisma.shopifyOrder.update({
      where: { id: order.id },
      data: {
        shopifyOrderId,
        shopifyOrderNumber,
        status: "created",
        totalPrice: order.totalPrice ?? 0,
        currency: order.currency,
      },
    });

    await prisma.campaignCreator.update({
      where: { id: campaignCreator.id },
      data: { lifecycleStatus: "order_created" },
    });

    return {
      shopifyOrderId,
      orderId: order.id,
      campaignCreatorId: campaignCreator.id,
    };
  } catch (error) {
    // A timeout or 5xx can be ambiguous: Shopify may have completed the draft.
    // Stop automatic retries until an operator reconciles Shopify against Seed Scale.
    try {
      await prisma.shopifyOrder.updateMany({
        where: { id: order.id, status: "draft_completing" },
        data: { status: "error_needs_reconciliation" },
      });
    } catch {
      // Preserve the original completion error.
    }
    throw error;
  }
}
