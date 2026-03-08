import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { mapTrack17Status } from "@/lib/track17/client";

/**
 * Track17 Webhook Handler (Push Notifications)
 *
 * Receives tracking status updates from Track17 push service.
 * Updates FulfillmentEvent and ShopifyOrder status accordingly.
 *
 * Track17 push payload format:
 * {
 *   "event": "TRACKING_UPDATED",
 *   "data": {
 *     "number": "...",
 *     "carrier": 123,
 *     "tag": "InTransit" | "Delivered" | ...,
 *     "track_info": { ... }
 *   }
 * }
 *
 * // INVARIANT: Idempotent — upserts by tracking number
 * // INVARIANT: Updates lifecycle status when delivery is confirmed
 */
export async function POST(request: NextRequest) {
  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Track17 may send a verification ping
  if (payload.event === "PING") {
    return NextResponse.json({ status: "ok" });
  }

  const event = String(payload.event || "");
  const data = payload.data as Record<string, unknown> | undefined;

  if (!data) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  const trackingNumber = String(data.number || "");
  if (!trackingNumber) {
    return NextResponse.json(
      { error: "Missing tracking number" },
      { status: 400 }
    );
  }

  log("info", "track17.webhook.received", { event, trackingNumber });

  // Record webhook event for audit trail
  const webhookId = `track17:${event}:${trackingNumber}:${Date.now()}`;

  await prisma.webhookEvent.create({
    data: {
      provider: "track17",
      eventType: event,
      externalEventId: webhookId,
      payload: payload as object,
      status: "processing",
    },
  });

  try {
    // Find matching FulfillmentEvent(s) by tracking number
    const fulfillmentEvents = await prisma.fulfillmentEvent.findMany({
      where: { trackingNumber },
      include: {
        order: {
          include: {
            campaignCreator: true,
          },
        },
      },
    });

    if (fulfillmentEvents.length === 0) {
      log("warn", "track17.webhook.no_match", { trackingNumber });
      await prisma.webhookEvent.updateMany({
        where: { externalEventId: webhookId },
        data: { status: "processed", processedAt: new Date() },
      });
      return NextResponse.json({ status: "no_match" });
    }

    // Extract status from Track17 data
    const tag = String(data.tag || "");
    const trackInfo = data.track_info as Record<string, unknown> | undefined;
    const latestStatus = trackInfo?.latest_status as
      | Record<string, unknown>
      | undefined;
    const subStatus = String(latestStatus?.sub_status || "");

    const newStatus = mapTrack17Status(tag, subStatus);

    for (const fe of fulfillmentEvents) {
      if (fe.status === newStatus) continue; // No change

      // Update FulfillmentEvent
      await prisma.fulfillmentEvent.update({
        where: { id: fe.id },
        data: { status: newStatus },
      });

      log("info", "track17.webhook.status_updated", {
        trackingNumber,
        fulfillmentEventId: fe.id,
        oldStatus: fe.status,
        newStatus,
      });

      // If delivered, cascade updates to order and lifecycle
      if (newStatus === "delivered") {
        await prisma.shopifyOrder.update({
          where: { id: fe.orderId },
          data: { status: "delivered" },
        });

        if (
          fe.order.campaignCreator &&
          !["posted", "completed", "opted_out"].includes(
            fe.order.campaignCreator.lifecycleStatus
          )
        ) {
          await prisma.campaignCreator.update({
            where: { id: fe.order.campaignCreatorId },
            data: { lifecycleStatus: "delivered" },
          });
        }

        // Emit Inngest event for downstream processing (e.g. reminders)
        try {
          const { inngest } = await import("@/lib/inngest/client");
          await inngest.send({
            name: "shopify/fulfillment.updated",
            data: {
              orderId: fe.orderId,
              shopifyOrderId: fe.order.shopifyOrderId,
              campaignCreatorId: fe.order.campaignCreatorId,
              status: "delivered",
            },
          });
        } catch {
          console.warn(
            "[track17-webhook] Failed to emit Inngest event for delivery"
          );
        }
      }
    }

    await prisma.webhookEvent.updateMany({
      where: { externalEventId: webhookId },
      data: { status: "processed", processedAt: new Date() },
    });
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : "Unknown error";

    await prisma.webhookEvent.updateMany({
      where: { externalEventId: webhookId },
      data: { status: "failed", error: errMsg },
    });

    log("error", "track17.webhook.processing_error", {
      trackingNumber,
      error: errMsg,
    });
  }

  // Always return 200 to Track17 to prevent retries
  return NextResponse.json({ status: "ok" });
}
