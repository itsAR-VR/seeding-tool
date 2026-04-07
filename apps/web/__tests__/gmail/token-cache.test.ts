import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Gmail token cache tests.
 *
 * Covers:
 * - Cached token returned without API call
 * - Expired cache triggers fresh refresh
 * - Cache isolation between different refresh tokens
 * - In-flight dedup — concurrent calls only refresh once
 * - Retry on transient failure (3 attempts)
 * - LRU eviction when cache exceeds 100 entries
 * - invalidateGmailAccessToken forces fresh refresh
 * - Uses Google's expires_in when available, falls back to default
 */

// ─── Mocks ──────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

// ─── Helpers ────────────────────────────────────────────

function mockTokenResponse(
  token: string,
  expiresIn?: number,
  status = 200
): Response {
  const body: Record<string, unknown> = { access_token: token };
  if (expiresIn !== undefined) {
    body.expires_in = expiresIn;
  }
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function mockErrorResponse(status: number, message: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: message }),
    text: () => Promise.resolve(message),
  } as unknown as Response;
}

// ─── Tests ──────────────────────────────────────────────

describe("Gmail token cache", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Reset module state between tests
    const mod = await import("@/lib/gmail/token");
    mod._resetTokenCache();
  });

  it("returns cached token without API call on second request", async () => {
    mockFetch.mockResolvedValueOnce(
      mockTokenResponse("access-token-1", 3600)
    );

    const { getGmailAccessToken } = await import("@/lib/gmail/token");

    const first = await getGmailAccessToken("refresh-1");
    const second = await getGmailAccessToken("refresh-1");

    expect(first).toBe("access-token-1");
    expect(second).toBe("access-token-1");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes when cached token is expired", async () => {
    mockFetch
      .mockResolvedValueOnce(mockTokenResponse("token-old", 3600))
      .mockResolvedValueOnce(mockTokenResponse("token-new", 3600));

    const { getGmailAccessToken, _resetTokenCache } = await import(
      "@/lib/gmail/token"
    );

    // First call — populates cache
    const first = await getGmailAccessToken("refresh-1");
    expect(first).toBe("token-old");

    // Simulate expiration by clearing and re-requesting
    _resetTokenCache();

    const second = await getGmailAccessToken("refresh-1");
    expect(second).toBe("token-new");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("isolates tokens for different refresh tokens", async () => {
    mockFetch
      .mockResolvedValueOnce(mockTokenResponse("brand-a-token", 3600))
      .mockResolvedValueOnce(mockTokenResponse("brand-b-token", 3600));

    const { getGmailAccessToken } = await import("@/lib/gmail/token");

    const tokenA = await getGmailAccessToken("refresh-brand-a");
    const tokenB = await getGmailAccessToken("refresh-brand-b");

    expect(tokenA).toBe("brand-a-token");
    expect(tokenB).toBe("brand-b-token");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("deduplicates concurrent calls for the same refresh token", async () => {
    let resolvePromise!: (value: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });
    mockFetch.mockReturnValueOnce(pendingResponse);

    const { getGmailAccessToken } = await import("@/lib/gmail/token");

    // Fire 3 concurrent calls
    const p1 = getGmailAccessToken("refresh-concurrent");
    const p2 = getGmailAccessToken("refresh-concurrent");
    const p3 = getGmailAccessToken("refresh-concurrent");

    // Resolve the single fetch
    resolvePromise(mockTokenResponse("deduped-token", 3600));

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(r1).toBe("deduped-token");
    expect(r2).toBe("deduped-token");
    expect(r3).toBe("deduped-token");
    // Only one actual network call
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on transient 5xx errors", async () => {
    mockFetch
      .mockResolvedValueOnce(mockErrorResponse(500, "Internal Server Error"))
      .mockResolvedValueOnce(mockErrorResponse(503, "Service Unavailable"))
      .mockResolvedValueOnce(mockTokenResponse("recovered-token", 3600));

    const { getGmailAccessToken } = await import("@/lib/gmail/token");

    const token = await getGmailAccessToken("refresh-retry");
    expect(token).toBe("recovered-token");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("throws immediately on non-transient 4xx errors", async () => {
    mockFetch.mockResolvedValueOnce(
      mockErrorResponse(400, "invalid_grant")
    );

    const { getGmailAccessToken } = await import("@/lib/gmail/token");

    await expect(
      getGmailAccessToken("refresh-bad")
    ).rejects.toThrow(/Token refresh failed \(400\)/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws after exhausting all retry attempts", async () => {
    mockFetch
      .mockResolvedValueOnce(mockErrorResponse(500, "error"))
      .mockResolvedValueOnce(mockErrorResponse(502, "error"))
      .mockResolvedValueOnce(mockErrorResponse(503, "error"));

    const { getGmailAccessToken } = await import("@/lib/gmail/token");

    await expect(
      getGmailAccessToken("refresh-exhaust")
    ).rejects.toThrow(/transient error/);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("evicts oldest entry when cache exceeds LRU_MAX (100)", async () => {
    const { getGmailAccessToken } = await import("@/lib/gmail/token");

    // Fill cache with 101 entries (indices 0-100)
    for (let i = 0; i <= 100; i++) {
      mockFetch.mockResolvedValueOnce(
        mockTokenResponse(`token-${i}`, 3600)
      );
      await getGmailAccessToken(`refresh-${i}`);
    }

    // Entry 0 should have been evicted (oldest when 101st was inserted)
    // Entry 2 should still be cached (second oldest remaining)
    mockFetch.mockResolvedValueOnce(
      mockTokenResponse("token-0-fresh", 3600)
    );

    const callCountBefore = mockFetch.mock.calls.length;

    // This should require a new fetch (evicted)
    const evictedResult = await getGmailAccessToken("refresh-0");
    expect(evictedResult).toBe("token-0-fresh");
    expect(mockFetch.mock.calls.length).toBe(callCountBefore + 1);

    // Re-inserting refresh-0 pushed cache to 101 again, evicting refresh-1.
    // So check refresh-2 which should still be cached.
    const cachedCallCount = mockFetch.mock.calls.length;
    const cachedResult = await getGmailAccessToken("refresh-2");
    expect(cachedResult).toBe("token-2");
    expect(mockFetch.mock.calls.length).toBe(cachedCallCount);
  });

  it("invalidateGmailAccessToken forces a fresh refresh", async () => {
    mockFetch
      .mockResolvedValueOnce(mockTokenResponse("original-token", 3600))
      .mockResolvedValueOnce(mockTokenResponse("fresh-token", 3600));

    const { getGmailAccessToken, invalidateGmailAccessToken } = await import(
      "@/lib/gmail/token"
    );

    const first = await getGmailAccessToken("refresh-invalidate");
    expect(first).toBe("original-token");

    invalidateGmailAccessToken("refresh-invalidate");

    const second = await getGmailAccessToken("refresh-invalidate");
    expect(second).toBe("fresh-token");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("uses Google's expires_in for TTL when available", async () => {
    // expires_in = 10 seconds — with 5 min safety buffer, this should expire
    // immediately (negative TTL), forcing a refresh on next call
    mockFetch
      .mockResolvedValueOnce(mockTokenResponse("short-lived", 10))
      .mockResolvedValueOnce(mockTokenResponse("refreshed", 3600));

    const { getGmailAccessToken } = await import("@/lib/gmail/token");

    const first = await getGmailAccessToken("refresh-ttl");
    expect(first).toBe("short-lived");

    // Since TTL = 10s - 300s = negative, next call should refresh
    const second = await getGmailAccessToken("refresh-ttl");
    expect(second).toBe("refreshed");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to default TTL when expires_in is absent", async () => {
    // No expires_in in response — should use 55 min default
    mockFetch.mockResolvedValueOnce(mockTokenResponse("default-ttl-token"));

    const { getGmailAccessToken } = await import("@/lib/gmail/token");

    const first = await getGmailAccessToken("refresh-default-ttl");
    expect(first).toBe("default-ttl-token");

    // Second call should be cached (55 min hasn't passed)
    const second = await getGmailAccessToken("refresh-default-ttl");
    expect(second).toBe("default-ttl-token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
