/**
 * Shared Gmail OAuth token cache.
 *
 * Single source of truth for exchanging refresh tokens for access tokens.
 * Features:
 * - In-memory cache with dynamic TTL from Google's `expires_in`
 * - In-flight deduplication (thundering herd prevention)
 * - LRU eviction (max 100 entries)
 * - Retry with exponential backoff on transient failures
 * - Explicit invalidation for 401 retry flows
 */

// ─── Types ──────────────────────────────────────────────

type CachedToken = {
  readonly token: string;
  readonly expiresAt: number;
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
};

// ─── Constants ──────────────────────────────────────────

const LRU_MAX = 100;
const SAFETY_BUFFER_MS = 5 * 60 * 1000; // 5 min before expiry
const DEFAULT_TTL_MS = 55 * 60 * 1000; // 55 min fallback
const RETRY_DELAYS_MS = [0, 200, 400] as const;

// ─── State ──────────────────────────────────────────────

const tokenCache = new Map<string, CachedToken>();
const pendingRefresh = new Map<string, Promise<string>>();

// ─── Private helpers ────────────────────────────────────

function evictOldestIfNeeded(): void {
  if (tokenCache.size <= LRU_MAX) return;

  // Map iteration order is insertion order; first key is oldest
  const oldest = tokenCache.keys().next().value as string;
  tokenCache.delete(oldest);
}

function isTransient(status: number): boolean {
  return status >= 500 && status < 600;
}

async function delay(ms: number): Promise<void> {
  if (ms <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshFromGoogle(refreshToken: string): Promise<string> {
  let lastError: Error | null = null;

  for (const waitMs of RETRY_DELAYS_MS) {
    await delay(waitMs);

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

    if (response.ok) {
      const data = (await response.json()) as GoogleTokenResponse;

      const ttlMs = data.expires_in
        ? data.expires_in * 1000 - SAFETY_BUFFER_MS
        : DEFAULT_TTL_MS;

      const entry: CachedToken = {
        token: data.access_token,
        expiresAt: Date.now() + ttlMs,
      };

      tokenCache.delete(refreshToken); // re-insert at end for LRU
      tokenCache.set(refreshToken, entry);
      evictOldestIfNeeded();

      return data.access_token;
    }

    if (isTransient(response.status)) {
      lastError = new Error(
        `Token refresh transient error (${response.status}): ${await response.text()}`
      );
      continue;
    }

    // Non-transient error (4xx) — fail immediately
    const errText = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${errText}`);
  }

  throw lastError ?? new Error("Token refresh failed after retries");
}

// ─── Public API ─────────────────────────────────────────

/**
 * Get a cached Gmail access token, refreshing from Google if needed.
 *
 * Concurrent calls for the same refresh token are deduplicated so only
 * one network request is made (thundering herd prevention).
 */
export async function getGmailAccessToken(
  refreshToken: string
): Promise<string> {
  // Check cache
  const cached = tokenCache.get(refreshToken);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.token;
  }

  // In-flight dedup (thundering herd prevention)
  const pending = pendingRefresh.get(refreshToken);
  if (pending) return pending;

  const promise = refreshFromGoogle(refreshToken);
  pendingRefresh.set(refreshToken, promise);
  try {
    return await promise;
  } finally {
    pendingRefresh.delete(refreshToken);
  }
}

/**
 * Invalidate a cached token (e.g., after a Gmail 401).
 * The next call to `getGmailAccessToken` will fetch a fresh token.
 */
export function invalidateGmailAccessToken(refreshToken: string): void {
  tokenCache.delete(refreshToken);
}

// ─── Test helpers (not for production use) ──────────────

/** @internal Clear all caches. Only for tests. */
export function _resetTokenCache(): void {
  tokenCache.clear();
  pendingRefresh.clear();
}
