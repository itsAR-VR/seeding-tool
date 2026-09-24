import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { resolveProviderCredential } from "@/lib/integrations/state";
import { decrypt } from "@/lib/encryption";
import {
  isSuppressed,
  SuppressedRecipientError,
  generateUnsubscribeToken,
} from "@/lib/compliance/suppression";
import {
  DailyLimitExceededError,
  AliasPausedError,
  CrossBrandAliasError,
} from "@/lib/outreach/errors";
import { getEffectiveDailyLimit } from "@/lib/outreach/warmup";
import {
  getGmailAccessToken,
  invalidateGmailAccessToken,
} from "@/lib/gmail/token";

/** Gmail clips messages longer than 102KB. Warn at 100KB to leave headroom. */
const GMAIL_SIZE_WARN_BYTES = 100 * 1024;

/**
 * Build the unsubscribe URL for a given recipient email.
 * Shared by both the List-Unsubscribe MIME header and the visible HTML footer link.
 */
export function buildUnsubscribeUrl(recipientEmail: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.seedscale.io";
  const token = generateUnsubscribeToken(recipientEmail);
  return `${appUrl}/api/webhooks/unsubscribe?email=${encodeURIComponent(recipientEmail)}&token=${token}`;
}

/**
 * Build RFC 2822 formatted email message with List-Unsubscribe headers.
 *
 * When `bodyHtml` is provided, emits a multipart/alternative message with
 * both text/plain and text/html parts. Otherwise emits text/plain only
 * (backward-compatible).
 */
export function buildRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const unsubUrl = buildUnsubscribeUrl(params.to);

  // Sanitize header values to prevent CRLF injection
  const sanitize = (v: string) => v.replace(/[\r\n]/g, "");

  const headers = [
    `From: ${sanitize(params.from)}`,
    `To: ${sanitize(params.to)}`,
    `Subject: ${sanitize(params.subject)}`,
    "MIME-Version: 1.0",
  ];

  // List-Unsubscribe header (CAN-SPAM + RFC 8058 one-click)
  headers.push(`List-Unsubscribe: <${unsubUrl}>`);
  headers.push("List-Unsubscribe-Post: List-Unsubscribe=One-Click");

  if (params.inReplyTo) {
    headers.push(`In-Reply-To: ${sanitize(params.inReplyTo)}`);
  }
  if (params.references) {
    headers.push(`References: ${sanitize(params.references)}`);
  }

  let messageBody: string;

  if (params.bodyHtml) {
    // Multipart/alternative: text/plain + text/html
    const boundary = `boundary-${randomUUID()}`;
    headers.push(
      `Content-Type: multipart/alternative; boundary="${boundary}"`
    );

    messageBody = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "",
      params.body,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "",
      params.bodyHtml,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    // Plain text only (backward-compatible)
    headers.push('Content-Type: text/plain; charset="UTF-8"');
    messageBody = params.body;
  }

  const raw = [...headers, "", messageBody].join("\r\n");

  // Warn if email exceeds Gmail clipping threshold
  const sizeBytes = Buffer.byteLength(raw, "utf-8");
  if (sizeBytes > GMAIL_SIZE_WARN_BYTES) {
    console.warn(
      `[buildRawEmail] Email to ${params.to} is ${sizeBytes} bytes — may be clipped by Gmail (limit ~102KB)`
    );
  }

  return raw;
}

/**
 * URL-safe Base64 encoding for Gmail API.
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

type SendEmailParams = {
  aliasId: string;
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  threadId?: string; // ConversationThread ID for persisting
  externalThreadId?: string; // Gmail thread ID for threading
  /** Brand ID of the sender — used for cross-brand alias validation. */
  senderBrandId?: string;
};

type GmailSendResult = { id: string; threadId: string };

/**
 * Send via Gmail API, retrying once on 401 with a fresh token.
 */
async function sendWithRetryOn401(
  refreshToken: string,
  accessToken: string,
  sendBody: Record<string, string>
): Promise<GmailSendResult> {
  const attempt = async (token: string) =>
    fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sendBody),
      }
    );

  const firstResponse = await attempt(accessToken);

  if (firstResponse.ok) {
    return (await firstResponse.json()) as GmailSendResult;
  }

  // Retry once on 401: invalidate cache, get fresh token, retry
  if (firstResponse.status === 401) {
    invalidateGmailAccessToken(refreshToken);
    const freshToken = await getGmailAccessToken(refreshToken);
    const retryResponse = await attempt(freshToken);

    if (retryResponse.ok) {
      return (await retryResponse.json()) as GmailSendResult;
    }

    const errText = await retryResponse.text();
    throw new Error(`Gmail send failed after 401 retry: ${errText}`);
  }

  const errText = await firstResponse.text();
  throw new Error(`Gmail send failed: ${errText}`);
}

/**
 * Send an email via Gmail API.
 *
 * // INVARIANT: AI drafts are NEVER auto-sent. Send only fires on explicit human action.
 * This function must only be called with human-confirmed sends.
 *
 * Flow:
 * 1. Decrypt refresh token from ProviderCredential
 * 2. Exchange for access token
 * 3. Send via Gmail API
 * 4. Persist Message row with direction: "outbound"
 */
export async function sendEmail(params: SendEmailParams) {
  // INVARIANT: Suppressed recipients never receive email — checked before every send
  if (await isSuppressed(params.to)) {
    throw new SuppressedRecipientError(params.to);
  }

  // 1. Look up alias with pause/limit fields
  const alias = await prisma.emailAlias.findUnique({
    where: { id: params.aliasId },
    select: {
      id: true,
      address: true,
      displayName: true,
      brandId: true,
      isPaused: true,
      dailyLimit: true,
      isWarmedUp: true,
      warmupStartedAt: true,
      encryptedRefreshToken: true,
    },
  });

  if (!alias) {
    throw new Error("Email alias not found");
  }

  // Safety: reject paused aliases
  if (alias.isPaused) {
    throw new AliasPausedError(params.aliasId);
  }

  // Safety: prevent cross-brand alias use
  if (params.senderBrandId && alias.brandId !== params.senderBrandId) {
    throw new CrossBrandAliasError(
      params.aliasId,
      alias.brandId,
      params.senderBrandId
    );
  }

  // Daily limit enforcement: atomically reserve one unit of capacity
  // BEFORE the external send. A read-then-send check lets concurrent
  // requests all observe the same count and overshoot the limit together;
  // the conditional increment can only succeed for `limit` senders.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const effectiveLimit = getEffectiveDailyLimit(alias);
  let reserved = false;

  if (effectiveLimit <= 0) {
    throw new DailyLimitExceededError(params.aliasId, 0, effectiveLimit);
  }

  const reservation = await prisma.sendingMetric.updateMany({
    where: {
      aliasId: params.aliasId,
      date: today,
      sent: { lt: effectiveLimit },
    },
    data: { sent: { increment: 1 } },
  });
  if (reservation.count > 0) {
    reserved = true;
  } else {
    // No row for today yet, or the limit is already reached. Try to create
    // the day's row; if we lose the create race, retry the conditional
    // reservation once before concluding the limit is exhausted.
    try {
      await prisma.sendingMetric.create({
        data: {
          aliasId: params.aliasId,
          brandId: alias.brandId,
          date: today,
          sent: 1,
        },
      });
      reserved = true;
    } catch (createError) {
      const isRace =
        createError instanceof Error &&
        "code" in createError &&
        (createError as { code?: string }).code === "P2002";
      if (!isRace) throw createError;
      const retry = await prisma.sendingMetric.updateMany({
        where: {
          aliasId: params.aliasId,
          date: today,
          sent: { lt: effectiveLimit },
        },
        data: { sent: { increment: 1 } },
      });
      reserved = retry.count > 0;
    }
  }

  if (!reserved) {
    const current = await prisma.sendingMetric.findUnique({
      where: { aliasId_date: { aliasId: params.aliasId, date: today } },
      select: { sent: true },
    });
    throw new DailyLimitExceededError(
      params.aliasId,
      current?.sent ?? effectiveLimit,
      effectiveLimit
    );
  }

  let sentExternally = false;
  try {
  // 2. Use this address's own token; older aliases fall back to the brand token.
  const refreshToken = alias.encryptedRefreshToken
    ? decrypt(alias.encryptedRefreshToken)
    : (await resolveProviderCredential(alias.brandId, "gmail")).decryptedValue;
  if (!refreshToken) {
    throw new Error("No valid Gmail credential for this brand");
  }

  const accessToken = await getGmailAccessToken(refreshToken);

  // 3. Build and send email
  const fromAddress = alias.displayName
    ? `${alias.displayName} <${alias.address}>`
    : alias.address;

  const rawEmail = buildRawEmail({
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    body: params.body,
    bodyHtml: params.bodyHtml,
  });

  const sendBody: Record<string, string> = {
    raw: base64UrlEncode(rawEmail),
  };

  if (params.externalThreadId) {
    sendBody.threadId = params.externalThreadId;
  }

  const sentMessage = await sendWithRetryOn401(
    refreshToken,
    accessToken,
    sendBody
  );
  sentExternally = true;

  // 4. Persist outbound message
  // INVARIANT: Message dedupe on externalId prevents replay duplicates.
  if (params.threadId) {
    await prisma.message.create({
      data: {
        threadId: params.threadId,
        direction: "outbound",
        channel: "email",
        fromAddress: alias.address,
        toAddress: params.to,
        subject: params.subject,
        body: params.body,
        bodyHtml: params.bodyHtml ?? null,
        externalMessageId: sentMessage.id,
      },
    });

    // Update external thread ID if not yet set
    await prisma.conversationThread.update({
      where: { id: params.threadId },
      data: {
        externalThreadId: sentMessage.threadId,
        updatedAt: new Date(),
      },
    });
  }

  // Capacity was already reserved atomically before the send — no
  // post-send metric write here.
  return {
    gmailMessageId: sentMessage.id,
    gmailThreadId: sentMessage.threadId,
  };
  } catch (error) {
    // Compensate the reservation only when the email never left — if
    // Gmail accepted it, capacity stays consumed even if local
    // persistence afterwards failed.
    if (!sentExternally) {
      try {
        await prisma.sendingMetric.updateMany({
          where: {
            aliasId: params.aliasId,
            date: today,
            sent: { gt: 0 },
          },
          data: { sent: { decrement: 1 } },
        });
      } catch {
        // best-effort compensation; the original send error takes precedence
      }
    }
    throw error;
  }
}
