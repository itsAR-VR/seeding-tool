/**
 * Send Instagram DMs via Unipile API.
 */

import type { UnipileClient } from "./client";

type SendDMResult = {
  success: boolean;
  chatId?: string;
  error?: string;
};

/**
 * Look up a user by Instagram handle and send them a DM.
 *
 * Unipile API notes (confirmed 2026-03-09):
 * - User search: GET /api/v1/users/search?account_id=<id>&q=<handle>
 *   Returns a single UserProfile (not an array) with `provider_messaging_id`.
 * - Chat creation: POST /api/v1/chats with `attendees_ids: [provider_messaging_id]`
 *   For Instagram, use the `provider_messaging_id` (not `id`) from the search result.
 */
export async function sendInstagramDM(
  client: UnipileClient,
  accountId: string,
  instagramHandle: string,
  message: string
): Promise<SendDMResult> {
  try {
    const handle = instagramHandle.replace(/^@/, "").trim();

    // Look up user by handle — correct endpoint: /api/v1/users/search
    const userRes = await client.fetch(
      `/api/v1/users/search?account_id=${encodeURIComponent(accountId)}&q=${encodeURIComponent(handle)}`,
      { method: "GET" }
    );

    if (!userRes.ok) {
      const errText = await userRes.text();
      return {
        success: false,
        error: `User lookup failed: ${userRes.status} ${errText}`,
      };
    }

    const userData = (await userRes.json()) as {
      provider_messaging_id?: string;
      public_identifier?: string;
    };

    const providerMessagingId = userData.provider_messaging_id;
    if (!providerMessagingId) {
      return {
        success: false,
        error: `No Unipile user found for handle: ${handle}`,
      };
    }

    // Start chat / send message — use provider_messaging_id in attendees_ids for Instagram
    const chatRes = await client.fetch("/api/v1/chats", {
      method: "POST",
      body: JSON.stringify({
        attendees_ids: [providerMessagingId],
        account_id: accountId,
        text: message,
      }),
    });

    if (!chatRes.ok) {
      const errText = await chatRes.text();
      return {
        success: false,
        error: `DM send failed: ${chatRes.status} ${errText}`,
      };
    }

    const chatData = (await chatRes.json()) as { chat_id?: string };

    return {
      success: true,
      chatId: chatData.chat_id,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown DM send error",
    };
  }
}
