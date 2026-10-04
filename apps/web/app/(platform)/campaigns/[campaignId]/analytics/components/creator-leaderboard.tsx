"use client";

import { useState, useMemo } from "react";
import type { CreatorLeaderboardEntry } from "@/lib/analytics/types";

type SortField = "totalLikes" | "totalComments" | "totalViews" | "mentionCount";

type CreatorLeaderboardProps = {
  readonly entries: readonly CreatorLeaderboardEntry[];
};

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function CreatorLeaderboard({ entries }: CreatorLeaderboardProps) {
  const [sortBy, setSortBy] = useState<SortField>("totalLikes");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...entries];
    copy.sort((a, b) => {
      const diff = a[sortBy] - b[sortBy];
      return sortDesc ? -diff : diff;
    });
    return copy;
  }, [entries, sortBy, sortDesc]);

  function handleSort(field: SortField) {
    if (field === sortBy) {
      setSortDesc((prev) => !prev);
    } else {
      setSortBy(field);
      setSortDesc(true);
    }
  }

  function sortIndicator(field: SortField): string {
    if (field !== sortBy) return "";
    return sortDesc ? " \u25BC" : " \u25B2";
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 text-muted-foreground">
        No posts with likes or views yet. Creators show up here once their posts get some.
      </div>
    );
  }

  const columns: { field: SortField; label: string }[] = [
    { field: "totalLikes", label: "Likes" },
    { field: "totalComments", label: "Comments" },
    { field: "totalViews", label: "Views" },
    { field: "mentionCount", label: "Posts" },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-5 py-3 font-medium">Creator</th>
            {columns.map((col) => (
              <th
                key={col.field}
                className="px-5 py-3 text-right font-medium"
                aria-sort={col.field === sortBy ? (sortDesc ? "descending" : "ascending") : "none"}
              >
                <button
                  type="button"
                  onClick={() => handleSort(col.field)}
                  className="hover:text-foreground"
                >
                  {col.label}
                  {sortIndicator(col.field)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((entry) => (
            <tr key={entry.creatorId}>
              <td className="px-5 py-3">
                <div className="font-medium">{entry.creatorName || "Unnamed creator"}</div>
                {entry.handle && (
                  <div className="text-muted-foreground">
                    @{entry.handle} on {PLATFORM_LABELS[entry.platform] ?? "social media"}
                  </div>
                )}
              </td>
              <td className="px-5 py-3 text-right tabular-nums">{formatNumber(entry.totalLikes)}</td>
              <td className="px-5 py-3 text-right tabular-nums">{formatNumber(entry.totalComments)}</td>
              <td className="px-5 py-3 text-right tabular-nums">{formatNumber(entry.totalViews)}</td>
              <td className="px-5 py-3 text-right tabular-nums">{formatNumber(entry.mentionCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
