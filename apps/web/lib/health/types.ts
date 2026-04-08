/**
 * Campaign health monitoring types.
 *
 * Used by the health check cron, health API routes, and dashboard widget.
 */

export type HealthAlert = {
  readonly severity: "critical" | "warning" | "info";
  readonly message: string;
  readonly metric?: string;
  readonly value?: number;
  readonly threshold?: number;
};

export type IntegrationHealthMap = {
  readonly gmail: boolean;
  readonly shopify: boolean;
  readonly instagram: boolean;
};

export type PipelineBottleneck = {
  readonly stage: string;
  readonly count: number;
  readonly avgDwellDays: number;
};

export type HealthMetrics = {
  readonly outreachVelocity: number;
  readonly replyRate: number;
  readonly conversionRate: number;
  readonly pipelineBottlenecks: readonly PipelineBottleneck[];
  readonly mentionGap: number;
  readonly stalledCount: number;
  readonly integrationHealth: IntegrationHealthMap;
};

export type HealthStatus = "healthy" | "warning" | "critical";

export type HealthSnapshotData = {
  readonly id: string;
  readonly createdAt: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly status: HealthStatus;
  readonly metrics: HealthMetrics;
  readonly alerts: readonly HealthAlert[];
};
