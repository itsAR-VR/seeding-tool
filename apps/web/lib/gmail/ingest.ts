import { prisma } from "@/lib/prisma";
import { resolveProviderCredential } from "@/lib/integrations/state";

type GmailMessageHeader = {
  name: string;
  value: string;
};

type GmailMessagePart = {
  mimeType: string;
  body?: { data?: string; size?: number };
  parts?: GmailMessagePart[];
};

type GmailMessage = {
  id: string;
  threadId: string;
  internalDate: string;
  payload: {
    headers: GmailMessageHeader[];
    mimeType: string;
    body?: { data?: string; size?: number };
    parts?: GmailMessagePart[];
  };
};

/**
 * Exchange a refresh token for a fresh access token.
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
    throw new Error(`Token refresh failed: ${await response.text()}`);
  }

  return ((await response.json()) as { access_token: string }).access_token;
}

/**
 * Decode base64url-encoded string.
 */
function decodeBase64Url(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf-8");
}

/**
 * Extract header value from Gmail message headers.
 */
function getHeader(headers: GmailMessageHeader[], name: string): string {
  return (
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

/**
 * Extract text body from a Gmail message payload.
 */
function extractBody(payload: GmailMessage["payload"]): {
  text: string;
  html: string;
} {
  let text = "";
  let html = "";

  function walkParts(parts?: GmailMessagePart[]) {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        text = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data) {
        html = decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        walkParts(part.parts);
      }
    }
  }

  if (payload.body?.data) {
    if (payload.mimeType === "text/html") {
      html = decodeBase64Url(payload.body.data);
    } else {
      text = decodeBase64Url(payload.body.data);
    }
  }

  walkParts(payload.parts);

  return { text, html };
}

/**
 * Fetch new messages from Gmail for a brand.
 * Returns normalized message data ready for processing.
 */
export async function fetchNewMessages(brandId: string) {
  const resolved = await resolveProviderCredential(brandId, "gmail");

  if (!resolved.decryptedValue) {
    throw new Error("No valid Gmail credential for brand");
  }

  const refreshToken = resolved.decryptedValue;
  const accessToken = await getAccessToken(refreshToken);

  // List recent messages (last 24 hours of unread)
  const listResponse = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?" +
      new URLSearchParams({
        q: "is:inbox newer_than:1d",
        maxResults: "50",
      }),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!listResponse.ok) {
    throw new Error(`Gmail list failed: ${await listResponse.text()}`);
  }

  const listData = (await listResponse.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
  };

  if (!listData.messages || listData.messages.length === 0) {
    return [];
  }

  // Fetch full details for each message
  const messages = [];
  for (const msg of listData.messages) {
    const msgResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!msgResponse.ok) continue;

    const gmailMsg = (await msgResponse.json()) as GmailMessage;
    const headers = gmailMsg.payload.headers;
    const { text, html } = extractBody(gmailMsg.payload);

    messages.push({
      id: gmailMsg.id,
      threadId: gmailMsg.threadId,
      from: getHeader(headers, "From"),
      to: getHeader(headers, "To"),
      subject: getHeader(headers, "Subject"),
      body: text || html.replace(/<[^>]*>/g, " ").trim(),
      bodyHtml: html || undefined,
      internalDate: gmailMsg.internalDate,
    });
  }

  return messages;
}

/**
 * Look up the brand and campaign creator associated with an external Gmail thread ID.
 */
export async function resolveThreadByExternalId(externalThreadId: string) {
  return prisma.conversationThread.findUnique({
    where: { externalThreadId },
    include: {
      campaignCreator: {
        include: {
          creator: true,
          campaign: true,
        },
      },
    },
  });
}

/**
 * Look up a brand's connection by the recipient email address.
 */
export async function resolveBrandByEmail(emailAddress: string) {
  const alias = await prisma.emailAlias.findFirst({
    where: { address: emailAddress },
    include: { brand: true },
  });

  return alias?.brand ?? null;
}
