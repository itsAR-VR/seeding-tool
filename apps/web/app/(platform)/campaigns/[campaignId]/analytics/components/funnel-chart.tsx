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
  Cell,
} from "recharts";

type FunnelChartProps = {
  readonly initialLifecycle: Readonly<Record<string, number>>;
};

const STAGE_CONFIG = [
  { key: "ready", label: "Ready", color: "#9ca3af" },
  { key: "outreach_sent", label: "Outreach Sent", color: "#3b82f6" },
  { key: "replied", label: "Replied", color: "#8b5cf6" },
  { key: "address_confirmed", label: "Addr Confirmed", color: "#22c55e" },
  { key: "order_created", label: "Order Created", color: "#14b8a6" },
  { key: "shipped", label: "Shipped", color: "#6366f1" },
  { key: "delivered", label: "Delivered", color: "#10b981" },
  { key: "posted", label: "Posted", color: "#ec4899" },
  { key: "completed", label: "Completed", color: "#16a34a" },
  { key: "opted_out", label: "Opted Out", color: "#ef4444" },
  { key: "stalled", label: "Stalled", color: "#f59e0b" },
] as const;

export function FunnelChart({ initialLifecycle }: FunnelChartProps) {
  const chartData = useMemo(
    () =>
      STAGE_CONFIG.map((stage) => ({
        name: stage.label,
        count: initialLifecycle[stage.key] ?? 0,
        color: stage.color,
      })),
    [initialLifecycle]
  );

  const hasData = chartData.some((d) => d.count > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No creators in this campaign yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 48, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          angle={-35}
          textAnchor="end"
          height={60}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [Number(value), "Creators"]}
          contentStyle={{ fontSize: 13 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
