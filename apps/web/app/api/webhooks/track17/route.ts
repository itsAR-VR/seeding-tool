import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { mapTrack17Status } from "@/lib/track17/client";
import { recordOutcomeEvent } from "@/lib/seeding/outcome-recorder";

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

  // Verify BEFORE parsing: Track17 v2 signs the raw body as
  // sha256(rawBody + "/" + TRACK17_API_KEY) in the `sign` header.
  // Without this, anyone who knows a tracking number could forge a
  // "Delivered" payload and corrupt delivery outcomes and calibration.
  const rawBody = await request.text();
  const track17Key = process.env.TRACK17_API_KEY;
  if (track17Key) {
    const sign = request.headers.get("sign") ?? "";
    const expected = createHash("sha256")
      .update(`${rawBody}/${track17Key}`)
      .digest("hex");
    const signBuffer = Buffer.from(sign, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const valid =
      signBuffer.length === expectedBuffer.length &&
      timingSafeEqual(signBuffer, expectedBuffer);
    if (!valid) {
      log("warn", "track17.webhook.bad_signature", {});
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed in production: without the key, forged "Delivered"
    // payloads would be accepted. Local development may run unsigned.
    log("error", "track17.webhook.unconfigured", {});
    return NextResponse.json(
      { error: "Webhook verification not configured" },
      { status: 500 }
    );
  } else {
    console.warn(
      "[track17-webhook] TRACK17_API_KEY not set — skipping signature verification (dev only)"
    );
  }

  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
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
          await recordOutcomeEvent({
            campaignCreatorId: fe.order.campaignCreatorId,
            event: { type: "delivered" },
          });
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
