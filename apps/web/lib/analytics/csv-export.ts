/**
 * Client-side CSV export utility.
 * Generates CSV files from analytics data and triggers browser download.
 */

import type { AnalyticsResponse } from "./types";

function escapeCSVField(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCSVString(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[]
): string {
  const headerLine = headers.map(escapeCSVField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSVField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

function buildLifecycleSection(data: AnalyticsResponse): string {
  const headers = ["Stage", "Count", "Conversion Rate (%)"] as const;
  const conversionKeys: Record<string, keyof typeof data.conversionRates> = {
    ready: "readyToOutreachSent",
    outreach_sent: "outreachSentToReplied",
    replied: "repliedToAddressConfirmed",
    address_confirmed: "addressConfirmedToOrderCreated",
    order_created: "orderCreatedToShipped",
    shipped: "shippedToDelivered",
    delivered: "deliveredToPosted",
  };

  const stages = [
    "ready",
    "outreach_sent",
    "replied",
    "address_confirmed",
    "order_created",
    "shipped",
    "delivered",
    "posted",
    "completed",
    "opted_out",
    "stalled",
  ];

  const rows = stages.map((stage) => {
    const count = data.lifecycle[stage] ?? 0;
    const rateKey = conversionKeys[stage];
    const rate = rateKey != null ? data.conversionRates[rateKey] : null;
    return [stage, count, rate] as const;
  });

  return buildCSVString(headers, rows);
}

function buildCostSection(data: AnalyticsResponse): string {
  const headers = ["Cost Type", "Amount (cents)"] as const;
  const rows = Object.entries(data.costsByType).map(
    ([type, amount]) => [type, amount] as const
  );
  return buildCSVString(headers, rows);
}

function buildLeaderboardSection(data: AnalyticsResponse): string {
  const headers = [
    "Creator",
    "Handle",
    "Platform",
    "Likes",
    "Comments",
    "Views",
    "Mentions",
  ] as const;
  const rows = data.creatorLeaderboard.map(
    (c) =>
      [
        c.creatorName,
        c.handle,
        c.platform,
        c.totalLikes,
        c.totalComments,
        c.totalViews,
        c.mentionCount,
      ] as const
  );
  return buildCSVString(headers, rows);
}

/**
 * Generates a CSV string from analytics data.
 * Exported for testability.
 */
export function generateCSV(data: AnalyticsResponse): string {
  const sections = [
    "CAMPAIGN ANALYTICS EXPORT",
    `Campaign: ${data.campaignId}`,
    `Total Creators: ${data.summary.totalCreators}`,
    `Total Mentions: ${data.summary.totalMentions}`,
    `Total Orders: ${data.summary.totalOrders}`,
    `Overall Conversion: ${data.conversionRates.overallConversion}%`,
    "",
    "--- LIFECYCLE FUNNEL ---",
    buildLifecycleSection(data),
    "",
    "--- COSTS BY TYPE ---",
    buildCostSection(data),
    "",
    "--- CREATOR LEADERBOARD ---",
    buildLeaderboardSection(data),
  ];

  return sections.join("\n");
}

/**
 * Triggers a browser download of analytics data as CSV.
 */
export function downloadCSV(data: AnalyticsResponse, filename: string): void {
  const csv = generateCSV(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
