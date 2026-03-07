import { prisma } from "@/lib/prisma";
import { getUnipileClient, type UnipileClient } from "./client";

// INVARIANT: Unipile DMs limited to 20/day per brand account
const DAILY_DM_LIMIT = 20;

/**
 * Check daily DM send limit for a brand.
 * Returns { allowed: boolean, sent: number, limit: number }.
 *
 * // INVARIANT: Unipile DMs limited to 20/day per brand account
 */
export async function checkDailyLimit(brandId: string): Promise<{
  allowed: boolean;
  sent: number;
  limit: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Count outbound DMs sent today via instagram_dm channel
  const sent = await prisma.message.count({
    where: {
      direction: "outbound",
      channel: "instagram_dm",
      thread: {
        brandId,
      },
      createdAt: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  return {
    allowed: sent < DAILY_DM_LIMIT,
    sent,
    limit: DAILY_DM_LIMIT,
  };
}

type UnipileUser = {
  id: string;
  provider_id: string;
};

type UnipileChat = {
  id: string;
  attendees?: Array<{
    provider_id?: string;
  }>;
};

/**
 * Lookup a user by Instagram username via Unipile API.
 */
async function lookupUser(
  client: UnipileClient,
  instagramUsername: string
): Promise<UnipileUser | null> {
  const res = await client.fetch(`/api/v1/users/${encodeURIComponent(instagramUsername)}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Unipile user lookup failed: ${res.status}`);
  }
  return (await res.json()) as UnipileUser;
}

/**
 * Search for an existing chat with a user via paginated chat listing.
 * Returns the chat ID if found, null otherwise.
 */
async function findExistingChat(
  client: UnipileClient,
  targetProviderId: string
): Promise<string | null> {
  let cursor: string | null = null;

  // Paginate through all chats to find one with the target user
  do {
    const params = new URLSearchParams();
    if (client.accountId) params.set("account_id", client.accountId);
    if (cursor) params.set("cursor", cursor);

    const res = await client.fetch(`/api/v1/chats?${params}`);
    if (!res.ok) {
      throw new Error(`Unipile chat search failed: ${res.status}`);
    }

    const data = (await res.json()) as {
      items: UnipileChat[];
      cursor: string | null;
    };

    for (const chat of data.items) {
      if (
        chat.attendees?.some(
          (a) => a.provider_id === targetProviderId
        )
      ) {
        return chat.id;
      }
    }

    cursor = data.cursor;
  } while (cursor);

  return null;
}

/**
 * Get or create a Unipile chat for an Instagram user.
 *
 * 1. Lookup user by username → get provider_id
 * 2. Search existing chats for a match
 * 3. If no match, create new chat (first message sent during creation)
 *
 * Returns { chatId, isNew }
 */
export async function getOrCreateChat(
  brandId: string,
  instagramUsername: string,
  initialMessage?: string
): Promise<{ chatId: string; isNew: boolean }> {
  const client = await getUnipileClient(brandId);

  // Step 1: Lookup user
  const user = await lookupUser(client, instagramUsername);
  if (!user) {
    throw new Error(
      `Instagram user @${instagramUsername} not found via Unipile`
    );
  }

  // Step 2: Search for existing chat
  const existingChatId = await findExistingChat(client, user.provider_id);
  if (existingChatId) {
    return { chatId: existingChatId, isNew: false };
  }

  // Step 3: Create new chat with initial message
  if (!initialMessage) {
    throw new Error(
      "Cannot create new chat without an initial message"
    );
  }

  const res = await client.fetch("/api/v1/chats", {
    method: "POST",
    body: JSON.stringify({
      account_id: client.accountId,
      attendees_ids: [user.provider_id],
      text: initialMessage,
    }),
  });

  if (!res.ok) {
    throw new Error(`Unipile chat creation failed: ${res.status}`);
  }

  const chat = (await res.json()) as { chat_id: string };
  return { chatId: chat.chat_id, isNew: true };
}

/**
 * Send a DM to an existing Unipile chat.
 */
export async function sendDm(
  brandId: string,
  chatId: string,
  message: string
): Promise<{ messageId: string }> {
  const client = await getUnipileClient(brandId);

  const res = await client.fetch(`/api/v1/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ text: message }),
  });

  if (!res.ok) {
    throw new Error(`Unipile DM send failed: ${res.status}`);
  }

  const data = (await res.json()) as { message_id: string };
  return { messageId: data.message_id };
}
