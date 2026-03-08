import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";

/**
 * Unipile Webhook Handler
 *
 * Verifies X-Webhook-Secret header and routes by event type:
 * - message_received — create inbound Message, update lifecycle
 * - account_status (error | credentials) — create InterventionCase
 *
 * // INVARIANT: All webhook handlers are idempotent — upsert by external ID
 */

function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = process.env.UNIPILE_WEBHOOK_SECRET;
  if (!secret) return false;

  const headerSecret = request.headers.get("x-webhook-secret") || "";
  return headerSecret === secret;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify webhook secret
  if (!verifyWebhookSecret(request)) {
    log("warn", "unipile.webhook.invalid_secret", {});
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    log("error", "unipile.webhook.invalid_json", {});
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = String(payload.event || "");
  const webhookId =
    String(payload.webhook_id || payload.id || "") ||
    `unipile:${event}:${Date.now()}`;

  log("info", "unipile.webhook.received", { event, webhookId });

  // Check for existing WebhookEvent (idempotency)
  const existing = await prisma.webhookEvent.findUnique({
    where: { externalEventId: webhookId },
  });

  if (existing && existing.status === "processed") {
    log("info", "unipile.webhook.idempotency_hit", { event, webhookId });
    return NextResponse.json({ status: "already_processed" });
  }

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
          provider: "unipile",
          eventType: event,
          externalEventId: webhookId,
          payload: payload as object,
          status: "processing",
        },
      });

  try {
    switch (event) {
      case "message_received":
        await handleMessageReceived(payload);
        break;
      case "account_status":
        await handleAccountStatus(payload);
        break;
      default:
        log("info", "unipile.webhook.unknown_event", { event });
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

    log("error", "unipile.webhook.processing_error", {
      event,
      webhookId,
      error: errMsg,
    });
  }

  // Always return 200 to prevent retries
  return NextResponse.json({ status: "ok" });
}

/**
 * Handle message_received event.
 *
 * 1. Look up ConversationThread by unipileChatId
 * 2. Create inbound Message record
 * 3. If thread has a CampaignCreator, update lifecycle and emit Inngest event
 *
 * // INVARIANT: All webhook handlers are idempotent — upsert by external ID
 */
async function handleMessageReceived(payload: Record<string, unknown>) {
  const data = (payload.data || payload) as Record<string, unknown>;
  const chatId = String(data.chat_id || data.chatId || "");
  const messageId = String(data.message_id || data.id || "");
  const messageBody = String(data.text || data.body || "");
  const senderName = String(data.sender_name || data.from || "");

  if (!chatId) {
    log("warn", "unipile.webhook.message_no_chat_id", { messageId });
    return;
  }

  // Look up thread by Unipile chat ID
  const thread = await prisma.conversationThread.findFirst({
    where: { unipileChatId: chatId },
    include: { campaignCreator: true },
  });

  if (!thread) {
    log("info", "unipile.webhook.message_no_thread", { chatId, messageId });
    return;
  }

  // Deduplicate by externalMessageId
  if (messageId) {
    const existingMsg = await prisma.message.findUnique({
      where: { externalMessageId: messageId },
    });
    if (existingMsg) {
      log("info", "unipile.webhook.message_duplicate", { messageId });
      return;
    }
  }

  // Create inbound message
  const msg = await prisma.message.create({
    data: {
      direction: "inbound",
      channel: "instagram_dm",
      body: messageBody,
      fromAddress: senderName || null,
      externalMessageId: messageId || null,
      threadId: thread.id,
    },
  });

  log("info", "unipile.webhook.message_created", {
    messageId: msg.id,
    threadId: thread.id,
    chatId,
  });

  // Update thread status to open on new inbound message
  await prisma.conversationThread.update({
    where: { id: thread.id },
    data: { status: "open" },
  });

  // If thread has a CampaignCreator, update lifecycle and emit event
  if (thread.campaignCreator) {
    const cc = thread.campaignCreator;

    // Update lastReplyAt
    await prisma.campaignCreator.update({
      where: { id: cc.id },
      data: { lastReplyAt: new Date() },
    });

    // Update lifecycle if in outreach phase
    if (
      ["outreach_sent", "ready"].includes(cc.lifecycleStatus)
    ) {
      await prisma.campaignCreator.update({
        where: { id: cc.id },
        data: { lifecycleStatus: "replied" },
      });
    }

    // Emit Inngest event for AI processing
    try {
      const { inngest } = await import("@/lib/inngest/client");
      await inngest.send({
        name: "unipile/message.received",
        data: {
          threadId: thread.id,
          messageId: msg.id,
          brandId: thread.brandId,
          campaignCreatorId: cc.id,
          chatId,
        },
      });
    } catch {
      console.warn(
        "[unipile-webhook] Failed to emit Inngest event for message"
      );
    }
  }
}

/**
 * Handle account_status event.
 *
 * If status is "error" or "credentials", create an InterventionCase
 * so operators are alerted to reconnect the account.
 */
async function handleAccountStatus(payload: Record<string, unknown>) {
  const data = (payload.data || payload) as Record<string, unknown>;
  const accountId = String(data.account_id || data.accountId || "");
  const status = String(data.status || "");

  log("info", "unipile.webhook.account_status", { accountId, status });

  if (!["error", "credentials"].includes(status)) {
    return;
  }

  // Look up brand by Unipile provider credential
  const credential = await prisma.providerCredential.findFirst({
    where: {
      provider: "unipile",
      isValid: true,
    },
  });

  const brandId = credential?.brandId;

  if (!brandId) {
    log("warn", "unipile.webhook.account_status_no_brand", {
      accountId,
      status,
    });
    return;
  }

  // Create intervention case
  await prisma.interventionCase.create({
    data: {
      type: "auth_failure",
      status: "open",
      priority: status === "credentials" ? "critical" : "high",
      title: `Unipile account requires attention: ${status}`,
      description: `Unipile account ${accountId} reported status "${status}". ${
        status === "credentials"
          ? "Instagram credentials need to be re-entered in Unipile."
          : "The account connection has an error. Check Unipile dashboard."
      }`,
      brandId,
    },
  });

  // Mark credential as invalid if credentials issue
  if (status === "credentials" && credential) {
    await prisma.providerCredential.update({
      where: { id: credential.id },
      data: { isValid: false },
    });
  }
}
