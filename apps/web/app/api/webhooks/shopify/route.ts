import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

/**
 * Shopify Webhook Handler
 *
 * Verifies HMAC signature and routes by X-Shopify-Topic header:
 * - orders/create — upsert ShopifyOrder status
 * - orders/fulfilled — update status to shipped, emit Inngest event
 * - orders/updated — sync status changes
 * - fulfillments/create — create/update FulfillmentEvent
 * - fulfillments/update — update tracking info
 *
 * // INVARIANT: All Shopify webhook handlers are idempotent — upsert by external ID
 */

function verifyShopifyHmac(body: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return false;

  const computed = createHmac("sha256", secret).update(body).digest("base64");

  try {
    return timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(hmacHeader)
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256") || "";
  const topic = request.headers.get("x-shopify-topic") || "";
  const shopDomain = request.headers.get("x-shopify-shop-domain") || "";

  // Verify HMAC
  if (!verifyShopifyHmac(rawBody, hmacHeader)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as Record<string, unknown>;

  // Compute dedupe key
  const webhookId =
    request.headers.get("x-shopify-webhook-id") ||
    `${topic}:${String(payload.id || "")}`;

  // Check for existing WebhookEvent (idempotency)
  const existing = await prisma.webhookEvent.findUnique({
    where: { externalEventId: webhookId },
  });

  log("info", "shopify.webhook.received", { topic, shopDomain, webhookId });

  if (existing && existing.status === "processed") {
    log("info", "shopify.webhook.idempotency_hit", { topic, webhookId });
    return NextResponse.json({ status: "already_processed" });
  }

  // Resolve brand by shop domain
  const brandConnection = await prisma.brandConnection.findFirst({
    where: {
      provider: "shopify",
      externalId: shopDomain,
      status: "connected",
    },
    select: { brandId: true },
  });

  const brandId = brandConnection?.brandId || null;

  // Record webhook event
  const webhookEvent = existing
    ? await prisma.webhookEvent.update({
        where: { id: existing.id },
        data: {
          status: "processing",
          attempts: { increment: 1 },
        },
      })
    : await prisma.webhookEvent.create({
        data: {
          provider: "shopify",
          eventType: topic,
          externalEventId: webhookId,
          payload: payload as object,
          status: "processing",
          brandId,
        },
      });

  try {
    switch (topic) {
      case "orders/create":
        await handleOrderCreate(payload);
        break;
      case "orders/fulfilled":
        await handleOrderFulfilled(payload);
        break;
      case "orders/updated":
        await handleOrderUpdated(payload);
        break;
      case "fulfillments/create":
        await handleFulfillmentCreate(payload);
        break;
      case "fulfillments/update":
        await handleFulfillmentUpdate(payload);
        break;
      default:
        // Unknown topic — record and skip
        break;
    }

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "processed", processedAt: new Date() },
    });
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown error";

    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "failed", error: errMsg },
    });

    log("error", "shopify.webhook.processing_error", { topic, webhookId, error: errMsg });
  }

  // Always return 200 to Shopify to prevent retries
  return NextResponse.json({ status: "ok" });
}

/**
 * orders/create — Update ShopifyOrder if we have one matching.
 * // INVARIANT: All Shopify webhook handlers are idempotent — upsert by external ID
 */
async function handleOrderCreate(payload: Record<string, unknown>) {
  const shopifyOrderId = String(payload.id || "");
  if (!shopifyOrderId) return;

  const order = await prisma.shopifyOrder.findUnique({
    where: { shopifyOrderId },
  });

  if (order) {
    await prisma.shopifyOrder.update({
      where: { shopifyOrderId },
      data: {
        status: "processing",
        shopifyOrderNumber: String(
          payload.name || payload.order_number || order.shopifyOrderNumber
        ),
      },
    });
  }
}

/**
 * orders/fulfilled — Mark order as shipped, update lifecycle.
 * // INVARIANT: All Shopify webhook handlers are idempotent — upsert by external ID
 */
async function handleOrderFulfilled(payload: Record<string, unknown>) {
  const shopifyOrderId = String(payload.id || "");
  if (!shopifyOrderId) return;

  const order = await prisma.shopifyOrder.findUnique({
    where: { shopifyOrderId },
    include: { campaignCreator: true },
  });

  if (!order) return;

  await prisma.shopifyOrder.update({
    where: { shopifyOrderId },
    data: { status: "shipped" },
  });

  // Update lifecycle
  if (
    order.campaignCreator &&
    !["delivered", "posted", "completed", "opted_out"].includes(
      order.campaignCreator.lifecycleStatus
    )
  ) {
    await prisma.campaignCreator.update({
      where: { id: order.campaignCreatorId },
      data: { lifecycleStatus: "shipped" },
    });
  }

  // Emit Inngest event for reminder scheduling
  try {
    const { inngest } = await import("@/lib/inngest/client");
    await inngest.send({
      name: "shopify/order.fulfilled",
      data: {
        orderId: order.id,
        shopifyOrderId,
        campaignCreatorId: order.campaignCreatorId,
      },
    });
  } catch {
    // Inngest may not be configured — log and continue
    console.warn("[shopify-webhook] Failed to emit Inngest event for fulfillment");
  }
}

/**
 * orders/updated — Sync status changes.
 * // INVARIANT: All Shopify webhook handlers are idempotent — upsert by external ID
 */
async function handleOrderUpdated(payload: Record<string, unknown>) {
  const shopifyOrderId = String(payload.id || "");
  if (!shopifyOrderId) return;

  const order = await prisma.shopifyOrder.findUnique({
    where: { shopifyOrderId },
  });

  if (!order) return;

  const financialStatus = String(payload.financial_status || "");
  const fulfillmentStatus = String(payload.fulfillment_status || "");

  let newStatus = order.status;

  if (String(payload.cancelled_at || "") !== "" && String(payload.cancelled_at || "") !== "null") {
    newStatus = "cancelled";
  } else if (fulfillmentStatus === "fulfilled") {
    newStatus = "shipped";
  } else if (financialStatus === "paid" || financialStatus === "partially_paid") {
    newStatus = "processing";
  }

  if (newStatus !== order.status) {
    await prisma.shopifyOrder.update({
      where: { shopifyOrderId },
      data: { status: newStatus },
    });
  }
}

/**
 * fulfillments/create — Create or update FulfillmentEvent with tracking info.
 * // INVARIANT: All Shopify webhook handlers are idempotent — upsert by external ID
 */
async function handleFulfillmentCreate(payload: Record<string, unknown>) {
  const externalEventId = String(payload.id || "");
  const shopifyOrderId = String(payload.order_id || "");
  if (!externalEventId || !shopifyOrderId) return;

  const order = await prisma.shopifyOrder.findUnique({
    where: { shopifyOrderId },
  });

  if (!order) return;

  const trackingNumber = String(payload.tracking_number || "") || null;
  const trackingUrl = String(payload.tracking_url || "") || null;
  const carrier = String(payload.tracking_company || "") || null;
  const status = mapFulfillmentStatus(String(payload.shipment_status || payload.status || ""));

  // Upsert by external event ID for idempotency
  await prisma.fulfillmentEvent.upsert({
    where: { externalEventId },
    create: {
      status,
      trackingNumber,
      trackingUrl,
      carrier,
      externalEventId,
      orderId: order.id,
    },
    update: {
      status,
      trackingNumber,
      trackingUrl,
      carrier,
    },
  });
}

/**
 * fulfillments/update — Update tracking info and status.
 * // INVARIANT: All Shopify webhook handlers are idempotent — upsert by external ID
 */
async function handleFulfillmentUpdate(payload: Record<string, unknown>) {
  const externalEventId = String(payload.id || "");
  const shopifyOrderId = String(payload.order_id || "");
  if (!externalEventId || !shopifyOrderId) return;

  const order = await prisma.shopifyOrder.findUnique({
    where: { shopifyOrderId },
    include: { campaignCreator: true },
  });

  if (!order) return;

  const trackingNumber = String(payload.tracking_number || "") || null;
  const trackingUrl = String(payload.tracking_url || "") || null;
  const carrier = String(payload.tracking_company || "") || null;
  const rawStatus = String(payload.shipment_status || payload.status || "");
  const status = mapFulfillmentStatus(rawStatus);

  // Upsert FulfillmentEvent
  await prisma.fulfillmentEvent.upsert({
    where: { externalEventId },
    create: {
      status,
      trackingNumber,
      trackingUrl,
      carrier,
      externalEventId,
      orderId: order.id,
    },
    update: {
      status,
      trackingNumber,
      trackingUrl,
      carrier,
    },
  });

  // If delivered, update order and lifecycle
  if (status === "delivered") {
    await prisma.shopifyOrder.update({
      where: { id: order.id },
      data: { status: "delivered" },
    });

    if (
      order.campaignCreator &&
      !["posted", "completed", "opted_out"].includes(
        order.campaignCreator.lifecycleStatus
      )
    ) {
      await prisma.campaignCreator.update({
        where: { id: order.campaignCreatorId },
        data: { lifecycleStatus: "delivered" },
      });
    }

    // Emit fulfillment updated event for reminder system
    try {
      const { inngest } = await import("@/lib/inngest/client");
      await inngest.send({
        name: "shopify/fulfillment.updated",
        data: {
          orderId: order.id,
          shopifyOrderId: order.shopifyOrderId,
          campaignCreatorId: order.campaignCreatorId,
          status: "delivered",
        },
      });
    } catch {
      console.warn("[shopify-webhook] Failed to emit Inngest event for delivery");
    }
  }
}

/**
 * Map Shopify fulfillment/shipment statuses to our internal status.
 */
function mapFulfillmentStatus(raw: string): string {
  const map: Record<string, string> = {
    confirmed: "confirmed",
    in_transit: "in_transit",
    out_for_delivery: "out_for_delivery",
    delivered: "delivered",
    failure: "failure",
    cancelled: "cancelled",
    attempted_delivery: "out_for_delivery",
    label_printed: "confirmed",
    label_purchased: "confirmed",
    ready_for_pickup: "out_for_delivery",
    picked_up: "delivered",
    success: "confirmed",
  };

  return map[raw.toLowerCase()] || "confirmed";
}
