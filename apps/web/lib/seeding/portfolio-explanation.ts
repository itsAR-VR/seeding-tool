import type { PortfolioResult } from "@/lib/seeding/portfolio-optimizer";

export function generatePortfolioExplanation<T>(result: PortfolioResult<T>) {
  const dimensionLines = Object.entries(result.diversityMetrics.perDimension).map(
    ([dimension, metric]) => {
      const buckets = Object.entries(metric.distribution)
        .map(([bucket, share]) => `${bucket} ${(share * 100).toFixed(0)}%`)
        .join(", ");
      return `${dimension}: ${buckets || "n/a"}`;
    }
  );

  return [
    `Seed list of ${result.selected.length} creators optimized for diversity + quality.`,
    ...dimensionLines,
    `Mean score ${(result.qualityMetrics.meanScore * 100).toFixed(0)}%.`,
  ].join(" ");
}
