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
 * Create a Shopify draft order for a creator gift, complete it, and persist.
 *
 * Flow:
 * 1. Fetch confirmed ShippingAddressSnapshot
 * 2. Fetch gifted product/variant from campaign
 * 3. CLAIM: insert a pending ShopifyOrder row — the unique campaignCreatorId
 *    makes this the atomic idempotency key, claimed BEFORE any Shopify call
 * 4. POST draft order with 100% discount ($0)
 * 5. Complete the draft order
 * 6. Update the claimed row with the real Shopify ids (released on failure)
 * 7. Update CampaignCreator.lifecycleStatus = "order_created"
 */
export async function createDraftOrder(
  brandId: string,
  creatorId: string,
  campaignId: string
): Promise<{ shopifyOrderId: string; orderId: string }> {
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
        shopifyOrderId: `pending:${randomUUID()}`,
        status: "pending",
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

  let draftCreatedRemotely = false;
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

  const draftOrderId = draftData.draft_order.id;
  // From here on a Shopify-side artifact exists; the claim must survive
  // any local failure so retries cannot create a second order.
  draftCreatedRemotely = true;

  // 4. Complete the draft order → creates a real order
  const completeResponse = await client.fetch(
    `/draft_orders/${draftOrderId}/complete.json`,
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

  // 6. Fill in the claimed row with the real Shopify ids
  const order = await prisma.shopifyOrder.update({
    where: { id: claimId },
    data: {
      shopifyOrderId,
      shopifyOrderNumber,
      status: "created",
      totalPrice: 0, // 100% discount
      currency: "USD",
    },
  });

  // 7. Update lifecycle status
  await prisma.campaignCreator.update({
    where: { id: campaignCreator.id },
    data: { lifecycleStatus: "order_created" },
  });

  return { shopifyOrderId, orderId: order.id };
  } catch (error) {
    if (draftCreatedRemotely) {
      // Shopify may have completed the order — never release the claim
      // (a retry would create a duplicate). Mark it for reconciliation.
      try {
        await prisma.shopifyOrder.update({
          where: { id: claimId },
          data: { status: "error_needs_reconciliation" },
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
