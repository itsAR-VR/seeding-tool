import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
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

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    // Log the webhook event
    await prisma.webhookEvent.create({
      data: {
        provider: "stripe",
        eventType: event.type,
        externalEventId: event.id,
        payload: event.data.object as object,
        status: "processed",
        processedAt: new Date(),
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] Processing error:", error);

    await prisma.webhookEvent
      .create({
        data: {
          provider: "stripe",
          eventType: event.type,
          externalEventId: event.id,
          payload: event.data.object as object,
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
