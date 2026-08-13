import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 27d — Campaign Health Watchdog
 *
 * Tests cover:
 * - Healthy campaign: good reply rate, integrations connected → "healthy"
 * - Low reply rate (<5%) → "warning" with alert
 * - Integration down (BrandConnection disconnected) → "critical"
 * - Integration expired (ProviderCredential invalid or expired) → "critical"
 * - Zero sends in 48h → "critical"
 * - Mention gap >10 (excluding opted_out/stalled) → "warning"
 * - InterventionCase created for critical
 * - InterventionCase dedup — no duplicate if open case exists
 * - Outreach velocity from CampaignOutcome.outreachSentAt (not SendingMetric)
 * - Reply rate from CampaignOutcome.repliedAt (not SendingMetric)
 * - computeConversionRates reused
 * - Paused campaigns included
 * - HealthAlert type — alerts contain typed objects
 */

// ── Hoisted mocks ──────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const capturedHandlers: Record<string, (...args: unknown[]) => unknown> = {};

  return {
    capturedHandlers,
    logFn: vi.fn(),

    // Prisma mocks
    campaignFindMany: vi.fn(),
    campaignOutcomeCount: vi.fn(),
    campaignOutcomeFindFirst: vi.fn(),
    campaignCreatorGroupBy: vi.fn(),
    brandConnectionFindFirst: vi.fn(),
    providerCredentialFindFirst: vi.fn(),
    campaignHealthSnapshotCreate: vi.fn(),
    interventionCaseFindFirst: vi.fn(),
    interventionCaseCreate: vi.fn(),

    mockCreateFunction: vi.fn(
      (_config: unknown, _trigger: unknown, handler: (...args: unknown[]) => unknown) => {
        const config = _config as { id: string };
        capturedHandlers[config.id] = handler;
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
    campaign: {
      findMany: mocks.campaignFindMany,
    },
    campaignOutcome: {
      count: mocks.campaignOutcomeCount,
      findFirst: mocks.campaignOutcomeFindFirst,
    },
    campaignCreator: {
      groupBy: mocks.campaignCreatorGroupBy,
    },
    brandConnection: {
      findFirst: mocks.brandConnectionFindFirst,
    },
    providerCredential: {
      findFirst: mocks.providerCredentialFindFirst,
    },
    campaignHealthSnapshot: {
      create: mocks.campaignHealthSnapshotCreate,
    },
    interventionCase: {
      findFirst: mocks.interventionCaseFindFirst,
      create: mocks.interventionCaseCreate,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  log: mocks.logFn,
}));

// Import the function to register the handler
import "@/lib/inngest/functions/campaign-health-check";

// ── Helpers ────────────────────────────────────────────────

function getHandler(id: string) {
  const handler = mocks.capturedHandlers[id];
  if (!handler) {
    throw new Error(
      `Handler ${id} was not captured. Available: ${Object.keys(mocks.capturedHandlers).join(", ")}`
    );
  }
  return handler;
}

function makeStep() {
  return {
    run: vi.fn((_name: string, fn: (...args: unknown[]) => unknown) => fn()),
    sleep: vi.fn(),
  };
}

const DEFAULT_CAMPAIGN = {
  id: "campaign-1",
  name: "Test Campaign",
  brandId: "brand-1",
  status: "active",
};

/**
 * Sets up prisma mocks for a health check scenario.
 */
function setupScenario(overrides: {
  campaigns?: typeof DEFAULT_CAMPAIGN[];
  recentOutreach?: number;
  recentWithReply?: number;
  lastSendAt?: Date | null;
  mentionGap?: number;
  lifecycle?: Record<string, number>;
  gmailConnected?: boolean;
  gmailCredentialValid?: boolean;
  shopifyConnected?: boolean;
  shopifyCredentialValid?: boolean;
  instagramConnected?: boolean;
  instagramCredentialValid?: boolean;
  existingInterventionCase?: boolean;
} = {}) {
  const {
    campaigns = [DEFAULT_CAMPAIGN],
    recentOutreach = 20,
    recentWithReply = 5,
    lastSendAt = new Date(),
    mentionGap = 2,
    lifecycle = { ready: 5, outreach_sent: 10, replied: 5 },
    gmailConnected = true,
    gmailCredentialValid = true,
    shopifyConnected = true,
    shopifyCredentialValid = true,
    instagramConnected = true,
    instagramCredentialValid = true,
    existingInterventionCase = false,
  } = overrides;

  mocks.campaignFindMany.mockResolvedValue(campaigns);

  // CampaignOutcome.count is called multiple times with different where clauses
  // Call order: recentOutreach, recentWithReply, mentionGap
  mocks.campaignOutcomeCount
    .mockResolvedValueOnce(recentOutreach) // outreach velocity
    .mockResolvedValueOnce(recentWithReply) // reply count
    .mockResolvedValueOnce(mentionGap); // mention gap

  mocks.campaignOutcomeFindFirst.mockResolvedValue(
    lastSendAt ? { outreachSentAt: lastSendAt } : null
  );

  mocks.campaignCreatorGroupBy.mockResolvedValue(
    Object.entries(lifecycle).map(([status, count]) => ({
      lifecycleStatus: status,
      _count: count,
    }))
  );

  // Integration health: each provider checks BrandConnection then ProviderCredential
  // Order: gmail, shopify, instagram
  mocks.brandConnectionFindFirst
    .mockResolvedValueOnce(gmailConnected ? { id: "bc-gmail" } : null)
    .mockResolvedValueOnce(
      shopifyConnected ? { id: "bc-shopify" } : null
    )
    .mockResolvedValueOnce(
      instagramConnected ? { id: "bc-instagram" } : null
    );

  mocks.providerCredentialFindFirst
    .mockResolvedValueOnce(
      gmailCredentialValid ? { id: "pc-gmail" } : null
    )
    .mockResolvedValueOnce(
      shopifyCredentialValid ? { id: "pc-shopify" } : null
    )
    .mockResolvedValueOnce(
      instagramCredentialValid ? { id: "pc-instagram" } : null
    );

  mocks.campaignHealthSnapshotCreate.mockResolvedValue({
    id: "snapshot-1",
  });

  mocks.interventionCaseFindFirst.mockResolvedValue(
    existingInterventionCase
      ? { id: "case-existing", type: "health_critical", status: "open" }
      : null
  );
  mocks.interventionCaseCreate.mockResolvedValue({
    id: "case-1",
  });
}

// ── Tests ──────────────────────────────────────────────────

describe("Phase 27d — Campaign Health Watchdog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns completed with 0 campaigns when none active/paused", async () => {
    mocks.campaignFindMany.mockResolvedValue([]);

    const handler = getHandler("campaign-health-check");
    const result = await handler({ step: makeStep() });

    expect(result).toEqual({
      status: "completed",
      campaignsChecked: 0,
      results: {},
    });
  });

  // ── Healthy campaign ─────────────────────────────────────

  describe("healthy campaign", () => {
    it("produces healthy status with good reply rate and integrations", async () => {
      setupScenario({
        recentOutreach: 20,
        recentWithReply: 5, // 25% reply rate
        mentionGap: 2,
      });

      const handler = getHandler("campaign-health-check");
      const result = await handler({ step: makeStep() });

      expect(result.results["campaign-1"]).toEqual({
        status: "healthy",
        alertCount: 0,
      });

      // Verify snapshot was persisted
      expect(mocks.campaignHealthSnapshotCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            campaignId: "campaign-1",
            status: "healthy",
          }),
        })
      );
    });
  });

  // ── Warning: low reply rate ──────────────────────────────

  describe("low reply rate warning", () => {
    it("produces warning when reply rate < 5%", async () => {
      setupScenario({
        recentOutreach: 100,
        recentWithReply: 3, // 3% reply rate
        mentionGap: 2,
      });

      const handler = getHandler("campaign-health-check");
      const result = await handler({ step: makeStep() });

      expect(result.results["campaign-1"].status).toBe("warning");
      expect(result.results["campaign-1"].alertCount).toBeGreaterThan(0);

      // Check alert content
      const createCall =
        mocks.campaignHealthSnapshotCreate.mock.calls[0][0];
      const alerts = createCall.data.alerts as Array<{
        severity: string;
        metric: string;
      }>;
      expect(
        alerts.some(
          (a) => a.severity === "warning" && a.metric === "replyRate"
        )
      ).toBe(true);
    });
  });

  // ── Critical: reply rate < 2% ────────────────────────────

  describe("critical reply rate", () => {
    it("produces critical when reply rate < 2%", async () => {
      setupScenario({
        recentOutreach: 100,
        recentWithReply: 1, // 1% reply rate
        mentionGap: 2,
      });

      const handler = getHandler("campaign-health-check");
      const result = await handler({ step: makeStep() });

      expect(result.results["campaign-1"].status).toBe("critical");
    });
  });

  // ── Critical: integration down ───────────────────────────

  describe("integration down", () => {
    it("produces critical when BrandConnection is disconnected", async () => {
      setupScenario({
        recentOutreach: 20,
        recentWithReply: 5,
        gmailConnected: false,
      });

      const handler = getHandler("campaign-health-check");
      const result = await handler({ step: makeStep() });

      expect(result.results["campaign-1"].status).toBe("critical");

      const createCall =
        mocks.campaignHealthSnapshotCreate.mock.calls[0][0];
      const alerts = createCall.data.alerts as Array<{
        severity: string;
        metric: string;
      }>;
      expect(
        alerts.some(
          (a) =>
            a.severity === "critical" &&
            a.metric === "integrationHealth.gmail"
        )
      ).toBe(true);
    });

    it("produces critical when ProviderCredential is invalid", async () => {
      vi.clearAllMocks();

      mocks.campaignFindMany.mockResolvedValue([DEFAULT_CAMPAIGN]);

      mocks.campaignOutcomeCount
        .mockResolvedValueOnce(20) // outreach velocity
        .mockResolvedValueOnce(5)  // reply count
        .mockResolvedValueOnce(2); // mention gap

      mocks.campaignOutcomeFindFirst.mockResolvedValue({
        outreachSentAt: new Date(),
      });

      mocks.campaignCreatorGroupBy.mockResolvedValue([
        { lifecycleStatus: "ready", _count: 5 },
      ]);

      // Use implementation-based mock to check provider argument
      mocks.brandConnectionFindFirst.mockImplementation(
        async (args: { where: { provider: string } }) => {
          // All providers are connected
          return { id: `bc-${args.where.provider}` };
        }
      );

      mocks.providerCredentialFindFirst.mockImplementation(
        async (args: { where: { provider: string } }) => {
          // Shopify credential is invalid; gmail and instagram are valid
          if (args.where.provider === "shopify") return null;
          return { id: `pc-${args.where.provider}` };
        }
      );

      mocks.campaignHealthSnapshotCreate.mockResolvedValue({
        id: "snapshot-1",
      });
      mocks.interventionCaseFindFirst.mockResolvedValue(null);
      mocks.interventionCaseCreate.mockResolvedValue({ id: "case-1" });

      const handler = getHandler("campaign-health-check");
      const result = await handler({ step: makeStep() });

      expect(result.results["campaign-1"].status).toBe("critical");

      const createCall =
        mocks.campaignHealthSnapshotCreate.mock.calls[0][0];
      const metrics = createCall.data.metrics as {
        integrationHealth: { gmail: boolean; shopify: boolean; instagram: boolean };
      };

      expect(metrics.integrationHealth.gmail).toBe(true);
      expect(metrics.integrationHealth.shopify).toBe(false);
      expect(metrics.integrationHealth.instagram).toBe(true);
    });
  });

  // ── Critical: zero sends in 48h ──────────────────────────

  describe("zero sends in 48h", () => {
    it("produces critical when no outreach in trailing window and last send > 48h ago", async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      setupScenario({
        recentOutreach: 0,
        recentWithReply: 0,
        lastSendAt: threeDaysAgo,
        mentionGap: 0,
      });

      const handler = getHandler("campaign-health-check");
      const result = await handler({ step: makeStep() });

      expect(result.results["campaign-1"].status).toBe("critical");

      const createCall =
        mocks.campaignHealthSnapshotCreate.mock.calls[0][0];
      const alerts = createCall.data.alerts as Array<{
        severity: string;
        metric: string;
      }>;
      expect(
        alerts.some(
          (a) =>
            a.severity === "critical" &&
            a.metric === "outreachVelocity"
        )
      ).toBe(true);
    });

    it("produces critical when no sends ever (lastSendAt is null)", async () => {
      setupScenario({
        recentOutreach: 0,
        recentWithReply: 0,
        lastSendAt: null,
        mentionGap: 0,
      });

      const handler = getHandler("campaign-health-check");
      const result = await handler({ step: makeStep() });

      expect(result.results["campaign-1"].status).toBe("critical");
    });
  });

  // ── Warning: mention gap > 10 ────────────────────────────

  describe("mention gap warning", () => {
    it("produces warning when mention gap > 10 (excluding opted_out/stalled)", async () => {
      setupScenario({
        recentOutreach: 20,
        recentWithReply: 5,
        mentionGap: 15,
      });

      const handler = getHandler("campaign-health-check");
      const result = await handler({ step: makeStep() });

      expect(result.results["campaign-1"].status).toBe("warning");

      const createCall =
        mocks.campaignHealthSnapshotCreate.mock.calls[0][0];
      const alerts = createCall.data.alerts as Array<{
        severity: string;
        metric: string;
        value: number;
      }>;
      expect(
        alerts.some(
          (a) =>
            a.severity === "warning" &&
            a.metric === "mentionGap" &&
            a.value === 15
        )
      ).toBe(true);
    });
  });

  // ── InterventionCase creation ────────────────────────────

  describe("InterventionCase", () => {
    it("creates intervention case for critical status", async () => {
      setupScenario({
        gmailConnected: false,
        existingInterventionCase: false,
      });

      const handler = getHandler("campaign-health-check");
      await handler({ step: makeStep() });

      expect(mocks.interventionCaseCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: "health_critical",
            priority: "critical",
            brandId: "brand-1",
          }),
        })
      );
    });

    it("deduplicates: does NOT create case if open health_critical exists", async () => {
      setupScenario({
        gmailConnected: false,
        existingInterventionCase: true,
      });

      const handler = getHandler("campaign-health-check");
      await handler({ step: makeStep() });

      expect(mocks.interventionCaseCreate).not.toHaveBeenCalled();
    });

    it("does NOT create intervention case for healthy status", async () => {
      setupScenario();

      const handler = getHandler("campaign-health-check");
      await handler({ step: makeStep() });

      expect(mocks.interventionCaseCreate).not.toHaveBeenCalled();
    });
  });

  // ── Outreach velocity from CampaignOutcome ───────────────

  describe("outreach velocity source", () => {
    it("queries CampaignOutcome.outreachSentAt for velocity", async () => {
      setupScenario({ recentOutreach: 14 });

      const handler = getHandler("campaign-health-check");
      await handler({ step: makeStep() });

      // First call to campaignOutcome.count is for outreach velocity
      const firstCall = mocks.campaignOutcomeCount.mock.calls[0][0];
      expect(firstCall.where).toHaveProperty("campaignId", "campaign-1");
      expect(firstCall.where).toHaveProperty("outreachSentAt");
    });
  });

  // ── Reply rate from CampaignOutcome ──────────────────────

  describe("reply rate source", () => {
    it("queries CampaignOutcome.repliedAt for reply rate", async () => {
      setupScenario({ recentOutreach: 20, recentWithReply: 4 });

      const handler = getHandler("campaign-health-check");
      await handler({ step: makeStep() });

      // Second call to campaignOutcome.count is for reply rate
      const secondCall = mocks.campaignOutcomeCount.mock.calls[1][0];
      expect(secondCall.where).toHaveProperty("campaignId", "campaign-1");
      expect(secondCall.where).toHaveProperty("repliedAt");
    });
  });

  // ── computeConversionRates reuse ─────────────────────────

  describe("conversion rate reuse", () => {
    it("persists conversionRate in metrics from computeConversionRates", async () => {
      setupScenario({
        lifecycle: {
          ready: 10,
          outreach_sent: 8,
          replied: 5,
          address_confirmed: 3,
          order_created: 2,
          shipped: 2,
          delivered: 1,
          posted: 1,
        },
      });

      const handler = getHandler("campaign-health-check");
      await handler({ step: makeStep() });

      const createCall =
        mocks.campaignHealthSnapshotCreate.mock.calls[0][0];
      const metrics = createCall.data.metrics as {
        conversionRate: number;
      };
      // countAtOrBeyondStage sums all stages from index 0: 10+8+5+3+2+2+1+1 = 32
      // posted+completed = 1, safeRate(1, 32) = 3.13
      expect(metrics.conversionRate).toBe(3.13);
    });
  });

  // ── Paused campaigns included ────────────────────────────

  describe("paused campaigns", () => {
    it("includes paused campaigns in health check", async () => {
      const pausedCampaign = {
        ...DEFAULT_CAMPAIGN,
        id: "campaign-paused",
        status: "paused",
      };

      setupScenario({ campaigns: [pausedCampaign] });

      const handler = getHandler("campaign-health-check");
      const result = await handler({ step: makeStep() });

      expect(result.campaignsChecked).toBe(1);
      expect(result.results).toHaveProperty("campaign-paused");
    });
  });

  // ── HealthAlert type validation ──────────────────────────

  describe("HealthAlert type", () => {
    it("alerts contain severity, message, and metric fields", async () => {
      setupScenario({
        recentOutreach: 100,
        recentWithReply: 3, // 3% → warning
        mentionGap: 15, // >10 → warning
      });

      const handler = getHandler("campaign-health-check");
      await handler({ step: makeStep() });

      const createCall =
        mocks.campaignHealthSnapshotCreate.mock.calls[0][0];
      const alerts = createCall.data.alerts as Array<{
        severity: string;
        message: string;
        metric?: string;
      }>;

      expect(alerts.length).toBeGreaterThan(0);
      for (const alert of alerts) {
        expect(alert).toHaveProperty("severity");
        expect(alert).toHaveProperty("message");
        expect(typeof alert.severity).toBe("string");
        expect(typeof alert.message).toBe("string");
        expect(["critical", "warning", "info"]).toContain(alert.severity);
      }
    });
  });

  // ── Metrics persisted correctly ──────────────────────────

  describe("metrics persistence", () => {
    it("persists full HealthMetrics in snapshot", async () => {
      setupScenario({
        recentOutreach: 21,
        recentWithReply: 7,
        mentionGap: 3,
        lifecycle: { ready: 5, outreach_sent: 10, stalled: 2 },
      });

      const handler = getHandler("campaign-health-check");
      await handler({ step: makeStep() });

      const createCall =
        mocks.campaignHealthSnapshotCreate.mock.calls[0][0];
      const metrics = createCall.data.metrics as Record<string, unknown>;

      expect(metrics).toHaveProperty("outreachVelocity", 3);
      expect(metrics).toHaveProperty("replyRate");
      expect(metrics).toHaveProperty("conversionRate");
      expect(metrics).toHaveProperty("mentionGap", 3);
      expect(metrics).toHaveProperty("stalledCount", 2);
      expect(metrics).toHaveProperty("integrationHealth");
      expect(metrics).toHaveProperty("pipelineBottlenecks");
    });
  });

  // ── Completion logging ───────────────────────────────────

  describe("completion logging", () => {
    it("logs health check completion with counts", async () => {
      setupScenario();

      const handler = getHandler("campaign-health-check");
      await handler({ step: makeStep() });

      expect(mocks.logFn).toHaveBeenCalledWith(
        "info",
        "health.check_complete",
        expect.objectContaining({
          campaignsChecked: 1,
        })
      );
    });
  });
});
