/**
 * Send Instagram DMs via Unipile API.
 *
 * SAFETY INVARIANTS (enforced in this file):
 * 1. Exact handle match required — Unipile /users/search is fuzzy; we verify
 *    public_identifier === intended handle before sending. Abort on mismatch.
 * 2. providerMessagingId must be present and resolve to a confirmed user.
 * 3. Never silently fall through to a send when identity is ambiguous.
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
 *   ⚠️  This endpoint is FUZZY — it may return a partial/closest match.
 *   We MUST verify `public_identifier === handle` before proceeding.
 * - Chat creation: POST /api/v1/chats with `attendees_ids: [provider_messaging_id]`
 *   For Instagram, use the `provider_messaging_id` (not `id`) from the search result.
 *
 * FAIL-CLOSED: Any ambiguity in recipient identity aborts the send.
 */
export async function sendInstagramDM(
  client: UnipileClient,
  accountId: string,
  instagramHandle: string,
  message: string
): Promise<SendDMResult> {
  try {
    const handle = instagramHandle.replace(/^@/, "").trim().toLowerCase();

    if (!handle) {
      return { success: false, error: "Instagram handle is empty after normalisation" };
    }

    // ── Step 1: Look up user by handle (fuzzy search endpoint) ──────────────
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

    // ── Step 2: EXACT HANDLE VERIFICATION (RC-1 fix) ─────────────────────────
    // Unipile /users/search is a fuzzy/prefix search. The returned
    // public_identifier is the actual Instagram username of the resolved user.
    // If it doesn't exactly match the intended handle, abort — do NOT send.
    const returnedIdentifier = userData.public_identifier
      ?.replace(/^@/, "")
      .trim()
      .toLowerCase();

    if (!returnedIdentifier) {
      return {
        success: false,
        error: `Unipile search returned no public_identifier for handle @${handle}. Cannot confirm recipient identity — aborting send.`,
      };
    }

    if (returnedIdentifier !== handle) {
      return {
        success: false,
        error: `Handle mismatch: intended @${handle} but Unipile resolved to @${userData.public_identifier}. Aborting to prevent wrong-recipient send.`,
      };
    }

    const providerMessagingId = userData.provider_messaging_id;
    if (!providerMessagingId) {
      return {
        success: false,
        error: `Unipile returned no provider_messaging_id for handle @${handle}`,
      };
    }

    // ── Step 3: Create chat + send message ───────────────────────────────────
    // Use provider_messaging_id in attendees_ids for Instagram
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
