import { prisma } from "@/lib/prisma";
import { resolveProviderCredential } from "@/lib/integrations/state";
import {
  isSuppressed,
  SuppressedRecipientError,
} from "@/lib/compliance/suppression";

/**
 * Exchange a refresh token for a fresh access token via Google OAuth2.
 */
async function getAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Token refresh failed: ${errText}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Build RFC 2822 formatted email message.
 */
function buildRawEmail(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];

  if (params.inReplyTo) {
    lines.push(`In-Reply-To: ${params.inReplyTo}`);
  }
  if (params.references) {
    lines.push(`References: ${params.references}`);
  }

  lines.push("", params.body);

  return lines.join("\r\n");
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
  threadId?: string; // ConversationThread ID for persisting
  externalThreadId?: string; // Gmail thread ID for threading
};

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

  // 1. Look up alias and brand credential
  const alias = await prisma.emailAlias.findUnique({
    where: { id: params.aliasId },
    select: {
      id: true,
      address: true,
      displayName: true,
      brandId: true,
    },
  });

  if (!alias) {
    throw new Error("Email alias not found");
  }

  const resolved = await resolveProviderCredential(alias.brandId, "gmail");
  if (!resolved.decryptedValue) {
    throw new Error("No valid Gmail credential for this brand");
  }

  // 2. Decrypt refresh token and get access token
  const refreshToken = resolved.decryptedValue;
  const accessToken = await getAccessToken(refreshToken);

  // 3. Build and send email
  const fromAddress = alias.displayName
    ? `${alias.displayName} <${alias.address}>`
    : alias.address;

  const rawEmail = buildRawEmail({
    from: fromAddress,
    to: params.to,
    subject: params.subject,
    body: params.body,
  });

  const sendBody: Record<string, string> = {
    raw: base64UrlEncode(rawEmail),
  };

  if (params.externalThreadId) {
    sendBody.threadId = params.externalThreadId;
  }

  const sendResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendBody),
    }
  );

  if (!sendResponse.ok) {
    const errText = await sendResponse.text();
    throw new Error(`Gmail send failed: ${errText}`);
  }

  const sentMessage = (await sendResponse.json()) as {
    id: string;
    threadId: string;
  };

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

  // Update sending metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.sendingMetric.upsert({
    where: {
      aliasId_date: { aliasId: params.aliasId, date: today },
    },
    create: {
      aliasId: params.aliasId,
      brandId: alias.brandId,
      date: today,
      sent: 1,
    },
    update: {
      sent: { increment: 1 },
    },
  });

  return {
    gmailMessageId: sentMessage.id,
    gmailThreadId: sentMessage.threadId,
  };
}
