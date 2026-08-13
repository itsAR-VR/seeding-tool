import { Prisma } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { computeConversionRates } from "@/lib/analytics/conversion";
import type {
  HealthAlert,
  HealthMetrics,
  HealthStatus,
  IntegrationHealthMap,
} from "@/lib/health/types";

// ── Thresholds ────────────────────────────────────────────────

const REPLY_RATE_CRITICAL = 0.02;
const REPLY_RATE_WARNING = 0.05;
const MENTION_GAP_WARNING = 10;
const ZERO_SENDS_HOURS = 48;
const TRAILING_WINDOW_DAYS = 7;

// ── Integration health helper ─────────────────────────────────

async function checkIntegration(
  brandId: string,
  provider: string
): Promise<boolean> {
  const connection = await prisma.brandConnection.findFirst({
    where: { brandId, provider, status: "connected" },
  });
  if (!connection) return false;

  const credential = await prisma.providerCredential.findFirst({
    where: {
      brandId,
      provider,
      isValid: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  return !!credential;
}

// ── Status determination ──────────────────────────────────────

function determineStatus(
  replyRate: number,
  recentOutreach: number,
  mentionGap: number,
  integrationHealth: IntegrationHealthMap,
  hoursSinceLastSend: number | null
): HealthStatus {
  const integrationDown =
    !integrationHealth.gmail ||
    !integrationHealth.shopify ||
    !integrationHealth.instagram;

  const zeroSendsRecently =
    hoursSinceLastSend === null || hoursSinceLastSend > ZERO_SENDS_HOURS;

  // Critical: reply < 2%, integration down, or 0 sends in 48h
  if (
    (recentOutreach > 0 && replyRate < REPLY_RATE_CRITICAL) ||
    integrationDown ||
    (recentOutreach === 0 && zeroSendsRecently)
  ) {
    return "critical";
  }

  // Warning: reply < 5%, mention gap > 10
  if (
    (recentOutreach > 0 && replyRate < REPLY_RATE_WARNING) ||
    mentionGap > MENTION_GAP_WARNING
  ) {
    return "warning";
  }

  return "healthy";
}

// ── Alert generation ──────────────────────────────────────────

function generateAlerts(
  replyRate: number,
  recentOutreach: number,
  mentionGap: number,
  integrationHealth: IntegrationHealthMap,
  hoursSinceLastSend: number | null
): readonly HealthAlert[] {
  const alerts: HealthAlert[] = [];

  const zeroSendsRecently =
    hoursSinceLastSend === null || hoursSinceLastSend > ZERO_SENDS_HOURS;

  if (recentOutreach > 0 && replyRate < REPLY_RATE_CRITICAL) {
    alerts.push({
      severity: "critical",
      message: `Reply rate dropped to ${(replyRate * 100).toFixed(1)}% (below ${REPLY_RATE_CRITICAL * 100}% threshold)`,
      metric: "replyRate",
      value: replyRate,
      threshold: REPLY_RATE_CRITICAL,
    });
  } else if (recentOutreach > 0 && replyRate < REPLY_RATE_WARNING) {
    alerts.push({
      severity: "warning",
      message: `Reply rate at ${(replyRate * 100).toFixed(1)}% (below ${REPLY_RATE_WARNING * 100}% threshold)`,
      metric: "replyRate",
      value: replyRate,
      threshold: REPLY_RATE_WARNING,
    });
  }

  if (!integrationHealth.gmail) {
    alerts.push({
      severity: "critical",
      message:
        "Gmail connection expired — re-authenticate in Settings",
      metric: "integrationHealth.gmail",
    });
  }
  if (!integrationHealth.shopify) {
    alerts.push({
      severity: "critical",
      message:
        "Shopify connection down — re-authenticate in Settings",
      metric: "integrationHealth.shopify",
    });
  }
  if (!integrationHealth.instagram) {
    alerts.push({
      severity: "critical",
      message:
        "Instagram connection expired — re-authenticate in Settings",
      metric: "integrationHealth.instagram",
    });
  }

  if (recentOutreach === 0 && zeroSendsRecently) {
    alerts.push({
      severity: "critical",
      message: "No outreach sent in the last 48 hours",
      metric: "outreachVelocity",
      value: 0,
    });
  }

  if (mentionGap > MENTION_GAP_WARNING) {
    alerts.push({
      severity: "warning",
      message: `${mentionGap} creators delivered >14 days ago with no post`,
      metric: "mentionGap",
      value: mentionGap,
      threshold: MENTION_GAP_WARNING,
    });
  }

  return alerts;
}

// ── Main cron function ────────────────────────────────────────

/**
 * Inngest cron function: Campaign Health Watchdog.
 *
 * Runs daily at 6 AM UTC. For each active or paused campaign,
 * computes health metrics and persists a CampaignHealthSnapshot.
 * Creates InterventionCase for critical campaigns (with dedup).
 */
export const campaignHealthCheck = inngest.createFunction(
  {
    id: "campaign-health-check",
    name: "Campaign Health Watchdog",
    retries: 2,
  },
  { cron: "0 6 * * *" },
  async ({ step }) => {
    const results: Record<
      string,
      { status: HealthStatus; alertCount: number }
    > = {};

    // Fetch all active/paused campaigns grouped by brand
    const campaigns = await step.run("fetch-campaigns", async () => {
      return prisma.campaign.findMany({
        where: { status: { in: ["active", "paused"] } },
        select: { id: true, name: true, brandId: true, status: true },
      });
    });

    if (campaigns.length === 0) {
      log("info", "health.no_campaigns", {});
      return { status: "completed", campaignsChecked: 0, results: {} };
    }

    const now = new Date();
    const sevenDaysAgo = new Date(
      now.getTime() - TRAILING_WINDOW_DAYS * 24 * 60 * 60 * 1000
    );
    const fortyEightHoursAgo = new Date(
      now.getTime() - ZERO_SENDS_HOURS * 60 * 60 * 1000
    );

    for (const campaign of campaigns) {
      const snapshot = await step.run(
        `health-check-${campaign.id}`,
        async () => {
          // ── Outreach velocity (CampaignOutcome.outreachSentAt) ──
          const recentOutreach = await prisma.campaignOutcome.count({
            where: {
              campaignId: campaign.id,
              outreachSentAt: { gte: sevenDaysAgo },
            },
          });
          const outreachVelocity = recentOutreach / TRAILING_WINDOW_DAYS;

          // ── Reply rate (CampaignOutcome) ──
          const recentWithReply = await prisma.campaignOutcome.count({
            where: {
              campaignId: campaign.id,
              outreachSentAt: { gte: sevenDaysAgo },
              repliedAt: { not: null },
            },
          });
          const replyRate =
            recentOutreach > 0 ? recentWithReply / recentOutreach : 0;

          // ── Hours since last send ──
          const lastSend = await prisma.campaignOutcome.findFirst({
            where: {
              campaignId: campaign.id,
              outreachSentAt: { not: null },
            },
            orderBy: { outreachSentAt: "desc" },
            select: { outreachSentAt: true },
          });
          const hoursSinceLastSend = lastSend?.outreachSentAt
            ? (now.getTime() - new Date(lastSend.outreachSentAt).getTime()) /
              (1000 * 60 * 60)
            : null;

          // ── Conversion rate (reuse computeConversionRates) ──
          const lifecycleCounts = await prisma.campaignCreator.groupBy({
            by: ["lifecycleStatus"],
            where: { campaignId: campaign.id },
            _count: true,
          });
          const lifecycle = lifecycleCounts.reduce<Record<string, number>>(
            (acc, row) => ({
              ...acc,
              [row.lifecycleStatus]: row._count,
            }),
            {}
          );
          const conversionRates = computeConversionRates(lifecycle);

          // ── Mention gap (delivered, no post, exclude opted_out/stalled) ──
          const mentionGap = await prisma.campaignOutcome.count({
            where: {
              campaignId: campaign.id,
              deliveredAt: { not: null },
              postedAt: null,
              campaignCreator: {
                lifecycleStatus: { notIn: ["opted_out", "stalled"] },
              },
            },
          });

          // ── Stalled count ──
          const stalledCount = lifecycle["stalled"] ?? 0;

          // ── Pipeline bottlenecks ──
          const bottleneckStages = [
            "outreach_sent",
            "replied",
            "address_confirmed",
            "shipped",
            "delivered",
          ] as const;

          const pipelineBottlenecks = bottleneckStages
            .map((stage) => ({
              stage,
              count: lifecycle[stage] ?? 0,
              avgDwellDays: 0,
            }))
            .filter((b) => b.count > 0);

          // ── Integration health ──
          const integrationHealth: IntegrationHealthMap = {
            gmail: await checkIntegration(campaign.brandId, "gmail"),
            shopify: await checkIntegration(campaign.brandId, "shopify"),
            instagram: await checkIntegration(
              campaign.brandId,
              "instagram"
            ),
          };

          // ── Determine status and alerts ──
          const status = determineStatus(
            replyRate,
            recentOutreach,
            mentionGap,
            integrationHealth,
            hoursSinceLastSend
          );

          const alerts = generateAlerts(
            replyRate,
            recentOutreach,
            mentionGap,
            integrationHealth,
            hoursSinceLastSend
          );

          const metrics: HealthMetrics = {
            outreachVelocity,
            replyRate,
            conversionRate: conversionRates.overallConversion,
            pipelineBottlenecks,
            mentionGap,
            stalledCount,
            integrationHealth,
          };

          // ── Persist snapshot ──
          const created = await prisma.campaignHealthSnapshot.create({
            data: {
              campaignId: campaign.id,
              status,
              metrics: metrics as unknown as Prisma.InputJsonValue,
              alerts: alerts as unknown as Prisma.InputJsonValue,
            },
            select: { id: true },
          });

          // ── InterventionCase for critical (with dedup) ──
          if (status === "critical") {
            const existingCase = await prisma.interventionCase.findFirst({
              where: {
                brandId: campaign.brandId,
                type: "health_critical",
                status: { in: ["open", "in_progress"] },
              },
            });

            if (!existingCase) {
              const alertSummary = alerts
                .filter((a) => a.severity === "critical")
                .map((a) => a.message)
                .join("; ");

              await prisma.interventionCase.create({
                data: {
                  type: "health_critical",
                  priority: "critical",
                  title: `Campaign "${campaign.name}" health critical`,
                  description: alertSummary || "Campaign health is critical",
                  brandId: campaign.brandId,
                },
              });
            }
          }

          return {
            snapshotId: created.id,
            status,
            alertCount: alerts.length,
          };
        }
      );

      results[campaign.id] = {
        status: snapshot.status,
        alertCount: snapshot.alertCount,
      };
    }

    const criticalCount = Object.values(results).filter(
      (r) => r.status === "critical"
    ).length;
    const warningCount = Object.values(results).filter(
      (r) => r.status === "warning"
    ).length;

    log("info", "health.check_complete", {
      campaignsChecked: campaigns.length,
      criticalCount,
      warningCount,
    });

    return {
      status: "completed",
      campaignsChecked: campaigns.length,
      criticalCount,
      warningCount,
      results,
    };
  }
);
