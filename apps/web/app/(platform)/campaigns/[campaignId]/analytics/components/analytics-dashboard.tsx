"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AnalyticsResponse } from "@/lib/analytics/types";
import { FunnelChart } from "./funnel-chart";
import { TimeToPostChart } from "./time-to-post-chart";
import { CreatorLeaderboard } from "./creator-leaderboard";
import { CostBreakdown } from "./cost-breakdown";
import { DateRangeFilter } from "./date-range-filter";
import { CSVExportButton } from "./csv-export-button";

type AnalyticsDashboardProps = {
  readonly initialData: AnalyticsResponse;
  readonly campaignName: string;
};

export function AnalyticsDashboard({
  initialData,
  campaignName,
}: AnalyticsDashboardProps) {
  const [data, setData] = useState<AnalyticsResponse>(initialData);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const handleRangeChange = useCallback(
    (newFrom: string | undefined, newTo: string | undefined) => {
      setFrom(newFrom);
      setTo(newTo);
    },
    []
  );

  useEffect(() => {
    if (!from && !to) {
      setData(initialData);
      return;
    }

    let cancelled = false;

    async function fetchFiltered() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const res = await fetch(
          `/api/campaigns/${initialData.campaignId}/analytics?${params.toString()}`
        );
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as AnalyticsResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch {
        // Keep showing existing data on error
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchFiltered();
    return () => {
      cancelled = true;
    };
  }, [from, to, initialData]);

  return (
    <div className="space-y-6">
      {/* Controls bar */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <DateRangeFilter onRangeChange={handleRangeChange} />
        <CSVExportButton
          campaignId={data.campaignId}
          campaignName={campaignName}
        />
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">
          Updating analytics...
        </div>
      )}

      {/* Interactive Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Lifecycle Funnel</CardTitle>
          <CardDescription>
            Creator distribution across all {Object.keys(data.lifecycle).length}{" "}
            pipeline stages. Opted out and stalled shown separately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FunnelChart
            initialLifecycle={data.lifecycle}
          />
          {/* Conversion rates summary */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
            <div>
              <div className="text-muted-foreground">Outreach &rarr; Reply</div>
              <div className="font-semibold">
                {data.conversionRates.outreachSentToReplied}%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Reply &rarr; Address</div>
              <div className="font-semibold">
                {data.conversionRates.repliedToAddressConfirmed}%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">
                Delivered &rarr; Posted
              </div>
              <div className="font-semibold">
                {data.conversionRates.deliveredToPosted}%
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Overall Conversion</div>
              <div className="font-semibold text-green-600">
                {data.conversionRates.overallConversion}%
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Time to Post Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Time to Post</CardTitle>
          <CardDescription>
            Distribution of time from outreach to creator posting. Helps
            estimate campaign timelines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimeToPostChart timeToPost={data.timeToPost} />
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
          <CardDescription>
            Spending by category: product, shipping, platform fees, and other.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CostBreakdown costsByType={data.costsByType} />
        </CardContent>
      </Card>

      {/* Creator Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Creator Leaderboard</CardTitle>
          <CardDescription>
            Top creators by engagement. Click column headers to sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreatorLeaderboard entries={data.creatorLeaderboard} />
        </CardContent>
      </Card>
    </div>
  );
}
