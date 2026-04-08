"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { bucketTimeToPost } from "@/lib/analytics/conversion";

type TimeToPostChartProps = {
  readonly timeToPost: readonly number[];
};

export function TimeToPostChart({ timeToPost }: TimeToPostChartProps) {
  const buckets = useMemo(() => bucketTimeToPost(timeToPost), [timeToPost]);

  const hasData = timeToPost.length > 0;

  if (!hasData) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No time-to-post data yet. Data appears once creators post after receiving outreach.
      </div>
    );
  }

  const chartData = buckets.map((b) => ({
    name: b.label,
    count: b.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [Number(value), "Creators"]}
          contentStyle={{ fontSize: 13 }}
        />
        <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
