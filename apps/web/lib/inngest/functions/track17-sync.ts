import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import {
  registerTracking,
  getTrackingStatus,
  mapTrack17Status,
  stopTracking,
} from "@/lib/track17/client";
import { log } from "@/lib/logger";

/**
 * Inngest function: Register tracking number with Track17 when a Shopify
 * fulfillment arrives with tracking info.
 *
 * Triggered by "shopify/order.fulfilled" event.
 *
 * // INVARIANT: Idempotent — checks if tracking is already registered before re-registering
 */
export const registerTrack17Tracking = inngest.createFunction(
  {
    id: "track17-register-tracking",
    name: "Register Tracking with Track17",
    retries: 3,
  },
  { event: "shopify/order.fulfilled" },
  async ({ event, step }) => {
    if (!process.env.TRACK17_API_KEY) {
      log("warn", "track17.register_skipped_missing_key", {});
      return { status: "skipped", reason: "TRACK17_API_KEY is not set" };
    }

    const { orderId } = event.data as {
      orderId: string;
      shopifyOrderId: string;
      campaignCreatorId: string;
    };

    // Find FulfillmentEvents with tracking numbers for this order
    const fulfillmentEvents = await step.run(
      "fetch-fulfillment-events",
      async () => {
        return prisma.fulfillmentEvent.findMany({
          where: {
            orderId,
            trackingNumber: { not: null },
          },
        });
      }
    );

    if (fulfillmentEvents.length === 0) {
      return { status: "skipped", reason: "No tracking numbers found" };
    }

    const results = [];

    for (const fe of fulfillmentEvents) {
      if (!fe.trackingNumber) continue;

      const result = await step.run(
        `register-${fe.trackingNumber}`,
        async () => {
          try {
            const res = await registerTracking(fe.trackingNumber!);

            if (res.data.accepted.length > 0) {
              log("info", "track17.registered", {
                trackingNumber: fe.trackingNumber,
                orderId,
              });
              return { trackingNumber: fe.trackingNumber, status: "registered" };
            }

            if (res.data.rejected.length > 0) {
              const rejection = res.data.rejected[0];
              // Code 0 = already registered, which is fine
              if (rejection.error.code === 0) {
                return {
                  trackingNumber: fe.trackingNumber,
                  status: "already_registered",
                };
              }
              log("warn", "track17.register_rejected", {
                trackingNumber: fe.trackingNumber,
                error: rejection.error,
              });
              return {
                trackingNumber: fe.trackingNumber,
                status: "rejected",
                error: rejection.error.message,
              };
            }

            return { trackingNumber: fe.trackingNumber, status: "unknown" };
          } catch (error) {
            const errMsg =
              error instanceof Error ? error.message : "Unknown error";
            log("error", "track17.register_failed", {
              trackingNumber: fe.trackingNumber,
              error: errMsg,
            });
            return {
              trackingNumber: fe.trackingNumber,
              status: "error",
              error: errMsg,
            };
          }
        }
      );

      results.push(result);
    }

    return { status: "completed", results };
  }
);

/**
 * Inngest cron function: Poll Track17 for status updates on active shipments.
 *
 * Runs every 2 hours. Queries FulfillmentEvents that have tracking numbers
 * and are not yet delivered/cancelled, then batch-checks their status.
 *
 * // INVARIANT: Only polls active (non-terminal) fulfillments
 * // INVARIANT: Updates lifecycle status when delivery is confirmed
 */
export const pollTrack17Status = inngest.createFunction(
  {
    id: "track17-poll-status",
    name: "Poll Track17 Tracking Status",
    retries: 2,
  },
  { cron: "0 */2 * * *" }, // Every 2 hours
  async ({ step }) => {
    if (!process.env.TRACK17_API_KEY) {
      log("warn", "track17.poll_skipped_missing_key", {});
      return { status: "skipped", reason: "TRACK17_API_KEY is not set" };
    }

    // Fetch active fulfillments with tracking numbers
    try {
      const activeFulfillments = await step.run(
        "fetch-active-fulfillments",
        async () => {
          return prisma.fulfillmentEvent.findMany({
            where: {
              trackingNumber: { not: null },
              status: {
                notIn: ["delivered", "cancelled", "failure"],
              },
            },
            include: {
              order: {
                include: {
                  campaignCreator: true,
                },
              },
            },
          });
        }
      );

      if (activeFulfillments.length === 0) {
        return { status: "no_active_shipments" };
      }

      log("info", "track17.poll_start", {
        count: activeFulfillments.length,
      });

      const BATCH_SIZE = 40;
      const updates: Array<{
        trackingNumber: string;
        oldStatus: string;
        newStatus: string;
      }> = [];

      for (let i = 0; i < activeFulfillments.length; i += BATCH_SIZE) {
        const batch = activeFulfillments.slice(i, i + BATCH_SIZE);

        await step.run(`poll-batch-${i}`, async () => {
          for (const fe of batch) {
            if (!fe.trackingNumber) continue;

            try {
              const res = await getTrackingStatus(fe.trackingNumber);

              if (res.data.accepted.length === 0) continue;

              const info = res.data.accepted[0];
              const newStatus = mapTrack17Status(
                info.tag,
                info.track_info?.latest_status?.sub_status
              );

              if (newStatus === fe.status) continue;

              await prisma.fulfillmentEvent.update({
                where: { id: fe.id },
                data: {
                  status: newStatus,
                  ...(info.track_info?.latest_event?.time_iso
                    ? {
                        estimatedDelivery: new Date(
                          info.track_info.latest_event.time_iso
                        ),
                      }
                    : {}),
                },
              });

              updates.push({
                trackingNumber: fe.trackingNumber,
                oldStatus: fe.status,
                newStatus,
              });

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

                try {
                  await stopTracking(fe.trackingNumber);
                } catch {
                  log("warn", "track17.stop_failed", {
                    trackingNumber: fe.trackingNumber,
                  });
                }
              }

              log("info", "track17.status_updated", {
                trackingNumber: fe.trackingNumber,
                oldStatus: fe.status,
                newStatus,
              });
            } catch (error) {
              const errMsg =
                error instanceof Error ? error.message : "Unknown error";
              log("error", "track17.poll_error", {
                trackingNumber: fe.trackingNumber,
                error: errMsg,
              });
            }
          }
        });
      }

      log("info", "track17.poll_complete", {
        checked: activeFulfillments.length,
        updated: updates.length,
      });

      return {
        status: "completed",
        checked: activeFulfillments.length,
        updated: updates.length,
        updates,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown error";
      log("error", "track17.poll_fatal", { error: errMsg });
      return {
        status: "error",
        checked: 0,
        updated: 0,
        error: errMsg,
      };
    }
  }
);
