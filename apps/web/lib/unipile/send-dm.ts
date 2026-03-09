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
 */
export async function sendInstagramDM(
  client: UnipileClient,
  accountId: string,
  instagramHandle: string,
  message: string
): Promise<SendDMResult> {
  try {
    const handle = instagramHandle.replace(/^@/, "").trim();

    // Look up user by handle
    const userRes = await client.fetch(
      `/api/v1/users?search=${encodeURIComponent(handle)}&account_id=${accountId}`,
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
      items?: Array<{ id: string; provider_id?: string }>;
    };

    const user = userData.items?.[0];
    if (!user) {
      return {
        success: false,
        error: `No Unipile user found for handle: ${handle}`,
      };
    }

    // Start chat / send message
    const chatRes = await client.fetch("/api/v1/chats", {
      method: "POST",
      body: JSON.stringify({
        attendees_ids: [user.id],
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
