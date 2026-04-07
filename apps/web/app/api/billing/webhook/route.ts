import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mint, CREDITS_PER_PLAN } from "@/lib/credits";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  if (webhookSecret && signature) {
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("[stripe-webhook] Signature verification failed:", err);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }
  } else {
    // In development without webhook secret, parse the body directly
    // This is only safe because we check for the secret first
    console.warn(
      "[stripe-webhook] No STRIPE_WEBHOOK_SECRET set — skipping signature verification"
    );
    try {
      event = JSON.parse(body) as Stripe.Event;
    } catch {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
  }

  try {
    // ── Idempotency guard: status-aware deduplication ─────────────────────
    // "processed" or "processing" → already handled or in-flight, skip.
    // "failed" → transient failure on a prior attempt, re-process.
    // No record → new event, claim it.
    const existing = await prisma.webhookEvent.findUnique({
      where: { externalEventId: event.id },
      select: { id: true, status: true },
    });

    if (existing?.status === "processed" || existing?.status === "processing") {
      return NextResponse.json({ received: true, deduplicated: true });
    }

    // Claim this event: insert a new "processing" row, or re-claim a "failed" one.
    // The try/catch handles the TOCTOU race where a concurrent request inserts
    // between our findUnique and this write — on unique constraint violation we
    // re-read and apply the same status logic.
    let webhookRecordId: string;

    if (existing?.status === "failed") {
      // Re-process a previously failed event
      await prisma.webhookEvent.update({
        where: { id: existing.id },
        data: { status: "processing", error: null },
      });
      webhookRecordId = existing.id;
    } else {
      try {
        const created = await prisma.webhookEvent.create({
          data: {
            provider: "stripe",
            eventType: event.type,
            externalEventId: event.id,
            payload: event.data.object as object,
            status: "processing",
          },
        });
        webhookRecordId = created.id;
      } catch (insertError) {
        // TOCTOU race: another request inserted between findUnique and create.
        if (
          insertError instanceof Prisma.PrismaClientKnownRequestError &&
          insertError.code === "P2002"
        ) {
          const raceWinner = await prisma.webhookEvent.findUnique({
            where: { externalEventId: event.id },
            select: { id: true, status: true },
          });
          if (!raceWinner || raceWinner.status === "processed" || raceWinner.status === "processing") {
            return NextResponse.json({ received: true, deduplicated: true });
          }
          // Race winner is "failed" — re-process
          await prisma.webhookEvent.update({
            where: { id: raceWinner.id },
            data: { status: "processing", error: null },
          });
          webhookRecordId = raceWinner.id;
        } else {
          throw insertError;
        }
      }
    }

    // ── Process the event ──────────────────────────────────────────────────
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    // Mark as processed
    await prisma.webhookEvent.update({
      where: { id: webhookRecordId },
      data: { status: "processed", processedAt: new Date() },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] Processing error:", error);

    // Best-effort: mark the existing record as failed (if it was inserted)
    await prisma.webhookEvent
      .updateMany({
        where: { externalEventId: event.id },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      })
      .catch(() => {});

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const orgId = session.metadata?.orgId;
  if (!orgId) {
    console.error("[stripe-webhook] No orgId in checkout session metadata");
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) return;

  // Fetch the subscription to get the plan details
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId = stripeSubscription.items.data[0]?.price?.id;

  // Find or create subscription plan
  let plan = priceId
    ? await prisma.subscriptionPlan.findUnique({
        where: { stripePriceId: priceId },
      })
    : null;

  if (!plan) {
    plan = await prisma.subscriptionPlan.create({
      data: {
        name: "Starter",
        stripePriceId: priceId ?? undefined,
        monthlyPrice: 0,
        isActive: true,
      },
    });
  }

  // Update org with subscription ID
  await prisma.organization.update({
    where: { id: orgId },
    data: { stripeSubscriptionId: subscriptionId },
  });

  // Extract period dates from subscription items (Stripe v2025+ moved these off the root)
  const firstItem = stripeSubscription.items.data[0];
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000)
    : new Date();
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000)
    : new Date();

  // Create or update subscription record
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscriptionId },
    create: {
      organizationId: orgId,
      planId: plan.id,
      stripeSubscriptionId: subscriptionId,
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
    update: {
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!existing) return;

  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "canceled",
    trialing: "trialing",
    incomplete: "past_due",
    incomplete_expired: "canceled",
    unpaid: "past_due",
    paused: "past_due",
  };

  const subItem = subscription.items.data[0];
  const startDate = subItem?.current_period_start
    ? new Date(subItem.current_period_start * 1000)
    : undefined;
  const endDate = subItem?.current_period_end
    ? new Date(subItem.current_period_end * 1000)
    : undefined;

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: statusMap[subscription.status] ?? "active",
      ...(startDate && { currentPeriodStart: startDate }),
      ...(endDate && { currentPeriodEnd: endDate }),
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await prisma.subscription
    .update({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: "canceled" },
    })
    .catch(() => {
      // Subscription might not exist in our DB yet
    });
}

/**
 * Handle invoice.paid — mint credits for all brands under the subscription's org.
 *
 * Path: invoice -> subscription -> organization -> clients -> brands
 * Credit amount is determined by the subscription plan name via CREDITS_PER_PLAN.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subRef = invoice.parent?.subscription_details?.subscription ?? null;
  const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id ?? null;

  if (!subscriptionId) return;

  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    include: {
      plan: { select: { name: true } },
      organization: {
        include: {
          clients: {
            include: { brands: { select: { id: true } } },
          },
        },
      },
    },
  });

  if (!subscription) return;

  const creditAmount = CREDITS_PER_PLAN[subscription.plan.name] ?? 0;
  if (creditAmount <= 0) return;

  const brands = subscription.organization.clients.flatMap((c) => c.brands);

  for (const brand of brands) {
    await mint(brand.id, creditAmount, `invoice.paid: ${invoice.id}`, {
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subscriptionId,
      planName: subscription.plan.name,
    });
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // In Stripe v2025+, subscription info is under invoice.parent.subscription_details
  const subRef = invoice.parent?.subscription_details?.subscription ?? null;
  const subscriptionId = typeof subRef === "string" ? subRef : subRef?.id ?? null;

  if (!subscriptionId) return;

  await prisma.subscription
    .update({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: "past_due" },
    })
    .catch(() => {});
}
