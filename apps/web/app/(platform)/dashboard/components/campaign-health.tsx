"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { HealthSnapshotData, HealthStatus } from "@/lib/health/types";

// ── Status styling ────────────────────────────────────────────

const statusConfig: Record<
  HealthStatus,
  { color: string; bg: string; label: string }
> = {
  healthy: {
    color: "bg-green-500",
    bg: "bg-green-50 text-green-800",
    label: "Healthy",
  },
  warning: {
    color: "bg-yellow-500",
    bg: "bg-yellow-50 text-yellow-800",
    label: "Warning",
  },
  critical: {
    color: "bg-red-500",
    bg: "bg-red-50 text-red-800",
    label: "Critical",
  },
};

const severityColors: Record<string, string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  warning: "border-yellow-200 bg-yellow-50 text-yellow-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

// ── Component ─────────────────────────────────────────────────

type CampaignHealthWidgetProps = {
  readonly snapshots: readonly HealthSnapshotData[];
};

export function CampaignHealthWidget({
  snapshots,
}: CampaignHealthWidgetProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (snapshots.length === 0) {
    return (
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Campaign Health</CardTitle>
          <CardDescription>
            Health data will appear after the first daily check
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-col items-center py-6 text-center">
            <span className="text-3xl">🏥</span>
            <p className="mt-2 text-sm font-medium">No health data yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Health checks run daily at 6 AM UTC for active campaigns.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalCount = snapshots.filter(
    (s) => s.status === "critical"
  ).length;
  const warningCount = snapshots.filter(
    (s) => s.status === "warning"
  ).length;
  const healthyCount = snapshots.filter(
    (s) => s.status === "healthy"
  ).length;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Campaign Health</CardTitle>
            <CardDescription>
              {criticalCount > 0
                ? `${criticalCount} campaign${criticalCount !== 1 ? "s" : ""} need attention`
                : warningCount > 0
                  ? `${warningCount} campaign${warningCount !== 1 ? "s" : ""} with warnings`
                  : "All campaigns healthy"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                {criticalCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                {warningCount}
              </span>
            )}
            {healthyCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                {healthyCount}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-2">
          {snapshots.map((snapshot) => {
            const config = statusConfig[snapshot.status];
            const isExpanded = expandedId === snapshot.id;

            return (
              <div key={snapshot.id} className="rounded-lg border">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(isExpanded ? null : snapshot.id)
                  }
                  className="flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "inline-block h-3 w-3 rounded-full",
                        config.color
                      )}
                      title={config.label}
                    />
                    <span className="text-sm font-medium">
                      {snapshot.campaignName}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        config.bg
                      )}
                    >
                      {config.label}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {isExpanded ? "−" : "+"}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t px-3 pb-3 pt-2">
                    {/* Key metrics */}
                    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MetricPill
                        label="Outreach/day"
                        value={snapshot.metrics.outreachVelocity.toFixed(
                          1
                        )}
                      />
                      <MetricPill
                        label="Reply rate"
                        value={`${(snapshot.metrics.replyRate * 100).toFixed(1)}%`}
                      />
                      <MetricPill
                        label="Conversion"
                        value={`${snapshot.metrics.conversionRate.toFixed(1)}%`}
                      />
                      <MetricPill
                        label="Mention gap"
                        value={String(snapshot.metrics.mentionGap)}
                      />
                    </div>

                    {/* Alerts */}
                    {snapshot.alerts.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {snapshot.alerts.map((alert, idx) => (
                          <div
                            key={`${snapshot.id}-alert-${idx}`}
                            className={cn(
                              "rounded border px-2 py-1 text-xs",
                              severityColors[alert.severity] ??
                                severityColors.info
                            )}
                          >
                            {alert.message}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Integration status */}
                    <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <IntegrationDot
                        label="Gmail"
                        ok={snapshot.metrics.integrationHealth.gmail}
                      />
                      <IntegrationDot
                        label="Shopify"
                        ok={snapshot.metrics.integrationHealth.shopify}
                      />
                      <IntegrationDot
                        label="Instagram"
                        ok={
                          snapshot.metrics.integrationHealth.instagram
                        }
                      />
                    </div>

                    <Link
                      href={`/campaigns/${snapshot.campaignId}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View campaign details →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Sub-components ────────────────────────────────────────────

function MetricPill({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded-md bg-muted/50 px-2 py-1 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function IntegrationDot({
  label,
  ok,
}: {
  readonly label: string;
  readonly ok: boolean;
}) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={cn(
          "inline-block h-1.5 w-1.5 rounded-full",
          ok ? "bg-green-500" : "bg-red-500"
        )}
      />
      {label}
    </span>
  );
}
