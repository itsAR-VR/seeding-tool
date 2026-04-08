import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────
const mocks = vi.hoisted(() => {
  const capturedHandler = { fn: null as Function | null };

  return {
    capturedHandler,
    providerCredentialFindMany: vi.fn(),
    providerCredentialUpdate: vi.fn(),
    interventionCaseCreate: vi.fn(),
    interventionCaseCount: vi.fn(),
    refreshLongLivedToken: vi.fn(),
    decrypt: vi.fn(),
    encrypt: vi.fn(),
    log: vi.fn(),
    mockCreateFunction: vi.fn(
      (_config: unknown, _trigger: unknown, handler: Function) => {
        capturedHandler.fn = handler;
        return handler;
      }
    ),
  };
});

vi.mock("@/lib/inngest/client", () => ({
  inngest: {
    createFunction: mocks.mockCreateFunction,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    providerCredential: {
      findMany: mocks.providerCredentialFindMany,
      update: mocks.providerCredentialUpdate,
    },
    interventionCase: {
      create: mocks.interventionCaseCreate,
      count: mocks.interventionCaseCount,
    },
  },
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: mocks.decrypt,
  encrypt: mocks.encrypt,
}));

vi.mock("@/lib/instagram/client", () => ({
  refreshLongLivedToken: mocks.refreshLongLivedToken,
  InstagramApiError: class InstagramApiError extends Error {
    code: number;
    type: string;
    statusCode: number;
    constructor(
      message: string,
      code: number,
      type: string,
      statusCode: number
    ) {
      super(message);
      this.name = "InstagramApiError";
      this.code = code;
      this.type = type;
      this.statusCode = statusCode;
    }
    get isAuthError() {
      return this.code === 190 || this.statusCode === 401;
    }
  },
}));

vi.mock("@/lib/logger", () => ({
  log: mocks.log,
}));

// Synchronous import triggers createFunction registration with hoisted mock
import "@/lib/inngest/functions/instagram-token-refresh";

// ── Helpers ────────────────────────────────────────────────

type StepMock = {
  run: (name: string, fn: () => Promise<unknown>) => Promise<unknown>;
};

function getHandler() {
  const handler = mocks.capturedHandler.fn;
  if (!handler) throw new Error("createFunction handler was not captured");
  return handler as (ctx: { step: StepMock }) => Promise<unknown>;
}

function makeStepMock(): StepMock {
  return {
    run: async (_name: string, fn: () => Promise<unknown>) => fn(),
  };
}

function makeCredential(overrides: Record<string, unknown> = {}) {
  return {
    id: "cred-1",
    brandId: "brand-1",
    encryptedValue: "encrypted-value",
    expiresAt: new Date("2026-04-12T00:00:00Z"),
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────

describe("instagramTokenRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T04:00:00Z"));

    mocks.decrypt.mockReturnValue(
      JSON.stringify({ accessToken: "old-token", igUserId: "ig-123" })
    );
    mocks.encrypt.mockReturnValue("new-encrypted-value");
    mocks.interventionCaseCount.mockResolvedValue(0);
  });

  it("refreshes near-expiry tokens (< 7 days)", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeCredential(),
    ]);

    mocks.refreshLongLivedToken.mockResolvedValue({
      access_token: "new-token-abc",
      token_type: "bearer",
      expires_in: 5184000, // 60 days
    });

    mocks.providerCredentialUpdate.mockResolvedValue({});

    const handler = getHandler();
    const result = (await handler({ step: makeStepMock() })) as {
      refreshed: number;
      failed: number;
      results: Array<{ status: string }>;
    };

    expect(result.refreshed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.results[0].status).toBe("refreshed");

    // Verify refresh was called with old token
    expect(mocks.refreshLongLivedToken).toHaveBeenCalledWith("old-token");

    // Verify new encrypted value was stored
    expect(mocks.encrypt).toHaveBeenCalledWith(
      expect.stringContaining("new-token-abc")
    );

    expect(mocks.providerCredentialUpdate).toHaveBeenCalledWith({
      where: { id: "cred-1" },
      data: {
        encryptedValue: "new-encrypted-value",
        expiresAt: expect.any(Date),
      },
    });
  });

  it("creates InterventionCase on refresh failure", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeCredential(),
    ]);

    mocks.refreshLongLivedToken.mockRejectedValue(
      new Error("Network timeout")
    );
    mocks.interventionCaseCount.mockResolvedValue(0);
    mocks.interventionCaseCreate.mockResolvedValue({});

    const handler = getHandler();
    const result = (await handler({ step: makeStepMock() })) as {
      refreshed: number;
      failed: number;
    };

    expect(result.refreshed).toBe(0);
    expect(result.failed).toBe(1);

    expect(mocks.interventionCaseCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "auth_failure",
        status: "open",
        priority: "high",
        brandId: "brand-1",
        title: expect.stringContaining("Instagram token refresh failed"),
      }),
    });
  });

  it("marks credential invalid after 3 consecutive failures", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([
      makeCredential(),
    ]);

    mocks.refreshLongLivedToken.mockRejectedValue(
      new Error("Token invalid")
    );

    // 2 previous failures exist
    mocks.interventionCaseCount.mockResolvedValue(2);
    mocks.interventionCaseCreate.mockResolvedValue({});
    mocks.providerCredentialUpdate.mockResolvedValue({});

    const handler = getHandler();
    await handler({ step: makeStepMock() });

    // Should mark credential as invalid (2 previous + 1 current = 3)
    expect(mocks.providerCredentialUpdate).toHaveBeenCalledWith({
      where: { id: "cred-1" },
      data: { isValid: false },
    });

    // Should also log the invalidation
    expect(mocks.log).toHaveBeenCalledWith(
      "warn",
      "instagram.token_refresh.credential_invalidated",
      expect.objectContaining({
        credentialId: "cred-1",
        consecutiveFailures: 3,
      })
    );
  });

  it("returns no_expiring_tokens when no credentials need refresh", async () => {
    mocks.providerCredentialFindMany.mockResolvedValue([]);

    const handler = getHandler();
    const result = (await handler({ step: makeStepMock() })) as {
      status: string;
      refreshed: number;
      failed: number;
    };

    expect(result.status).toBe("no_expiring_tokens");
    expect(result.refreshed).toBe(0);
    expect(result.failed).toBe(0);
    expect(mocks.refreshLongLivedToken).not.toHaveBeenCalled();
  });
});
