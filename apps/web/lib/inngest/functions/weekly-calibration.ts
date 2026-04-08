import type { Prisma } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { getFeatureFlags } from "@/lib/feature-flags";
import { generateCalibrationReport } from "@/lib/seeding/score-calibration";
import { DEFAULT_WEIGHTS, normalizeWeights } from "@/lib/creator-search/scoring/composite";
import type { ScoreWeights } from "@/lib/creator-search/scoring/composite";

/** Minimum days since campaign creation for an outcome to be considered mature. */
const MIN_OUTCOME_AGE_DAYS = 30;

/** Minimum number of mature outcomes required to generate a calibration report. */
const MIN_OUTCOME_COUNT = 50;

/**
 * Weekly calibration cron — Monday 2 AM UTC.
 *
 * For each brand with outcomeLearningEnabled:
 *   1. Count mature outcomes (campaign >= 30 days old)
 *   2. If >= 50: generate calibration report and store snapshot
 *   3. Suggested weights = DEFAULT_WEIGHTS + clamped adjustments, re-normalized
 */
export const weeklyCalibration = inngest.createFunction(
  {
    id: "weekly-calibration",
    name: "Weekly Score Calibration",
    concurrency: [{ limit: 1 }],
  },
  { cron: "0 2 * * 1" },
  async () => {
    const brands = await fetchEnabledBrands();
    const results: Array<{ brandId: string; status: string; outcomeCount?: number }> = [];

    for (const brand of brands) {
      const result = await processBrandCalibration(brand.id);
      results.push(result);
    }

    log("info", "calibration.weekly_complete", {
      brandsProcessed: results.length,
      snapshotsCreated: results.filter((r) => r.status === "snapshot_created").length,
    });

    return { results };
  }
);

async function fetchEnabledBrands(): Promise<Array<{ id: string }>> {
  const allBrands = await prisma.brand.findMany({ select: { id: true } });
  const enabled: Array<{ id: string }> = [];

  for (const brand of allBrands) {
    const flags = await getFeatureFlags(brand.id);
    if (flags.outcomeLearningEnabled) {
      enabled.push(brand);
    }
  }

  return enabled;
}

async function processBrandCalibration(
  brandId: string
): Promise<{ brandId: string; status: string; outcomeCount?: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MIN_OUTCOME_AGE_DAYS);

  const outcomes = await prisma.campaignOutcome.findMany({
    where: {
      campaign: {
        brandId,
        createdAt: { lte: cutoffDate },
      },
    },
    select: {
      reviewDecision: true,
      completedAt: true,
      fitScoreAtSeed: true,
      scoreComponentsAtSeed: true,
    },
  });

  if (outcomes.length < MIN_OUTCOME_COUNT) {
    log("info", "calibration.skipped_insufficient", {
      brandId,
      outcomeCount: outcomes.length,
      required: MIN_OUTCOME_COUNT,
    });
    return { brandId, status: "skipped_insufficient", outcomeCount: outcomes.length };
  }

  const report = await generateCalibrationReport(undefined, outcomes);

  const suggestedWeights = buildSuggestedWeights(report.componentCorrelations);

  await prisma.calibrationSnapshot.create({
    data: {
      brandId,
      outcomeCount: outcomes.length,
      reportJson: JSON.parse(JSON.stringify(report)) as Prisma.InputJsonValue,
      weightsBefore: JSON.parse(JSON.stringify(DEFAULT_WEIGHTS)) as Prisma.InputJsonValue,
      suggestedWeights: JSON.parse(JSON.stringify(suggestedWeights)) as Prisma.InputJsonValue,
    },
  });

  log("info", "calibration.snapshot_created", {
    brandId,
    outcomeCount: outcomes.length,
  });

  return { brandId, status: "snapshot_created", outcomeCount: outcomes.length };
}

/**
 * Apply clamped component adjustments to DEFAULT_WEIGHTS, then re-normalize to sum 1.0.
 */
function buildSuggestedWeights(
  correlations: Record<string, { suggestedWeightAdjustment: number }>
): ScoreWeights {
  const adjusted = { ...DEFAULT_WEIGHTS };
  for (const [key, value] of Object.entries(correlations)) {
    if (key in adjusted) {
      const k = key as keyof ScoreWeights;
      // Adjustments are already clamped to +/- 0.05 by generateCalibrationReport
      adjusted[k] = Math.max(0, adjusted[k] + value.suggestedWeightAdjustment);
    }
  }
  return normalizeWeights(adjusted);
}
