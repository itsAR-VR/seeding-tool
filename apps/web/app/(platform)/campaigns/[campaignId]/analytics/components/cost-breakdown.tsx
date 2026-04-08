"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type CostBreakdownProps = {
  readonly costsByType: Readonly<Record<string, number>>;
};

const TYPE_COLORS: Record<string, string> = {
  product: "#3b82f6",
  shipping: "#14b8a6",
  platform_fee: "#f59e0b",
  other: "#9ca3af",
};

const DEFAULT_COLOR = "#6366f1";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatLabel(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function CostBreakdown({ costsByType }: CostBreakdownProps) {
  const chartData = useMemo(() => {
    return Object.entries(costsByType)
      .filter(([, amount]) => amount > 0)
      .map(([type, amount]) => ({
        name: formatLabel(type),
        value: amount,
        color: TYPE_COLORS[type] ?? DEFAULT_COLOR,
      }));
  }, [costsByType]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No cost records yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{ fontSize: 13 }}
        />
        <Legend
          formatter={(value: string) => (
            <span className="text-sm">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
