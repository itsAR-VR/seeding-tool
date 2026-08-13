"use client";

import { useState, useMemo } from "react";
import type { CreatorLeaderboardEntry } from "@/lib/analytics/types";

type SortField = "totalLikes" | "totalComments" | "totalViews" | "mentionCount";

type CreatorLeaderboardProps = {
  readonly entries: readonly CreatorLeaderboardEntry[];
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
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        No creator mention data yet.
      </div>
    );
  }

  const columns: { field: SortField; label: string }[] = [
    { field: "totalLikes", label: "Likes" },
    { field: "totalComments", label: "Comments" },
    { field: "totalViews", label: "Views" },
    { field: "mentionCount", label: "Mentions" },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="py-2 pr-4 font-medium text-muted-foreground">#</th>
            <th className="py-2 pr-4 font-medium text-muted-foreground">
              Creator
            </th>
            {columns.map((col) => (
              <th
                key={col.field}
                className="py-2 pr-4 font-medium text-muted-foreground text-right cursor-pointer select-none hover:text-foreground"
                onClick={() => handleSort(col.field)}
              >
                {col.label}
                {sortIndicator(col.field)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, idx) => (
            <tr key={entry.creatorId} className="border-b last:border-0">
              <td className="py-2 pr-4 text-muted-foreground">{idx + 1}</td>
              <td className="py-2 pr-4">
                <div className="font-medium">
                  {entry.creatorName || "Unknown"}
                </div>
                {entry.handle && (
                  <div className="text-xs text-muted-foreground">
                    @{entry.handle} ({entry.platform})
                  </div>
                )}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {formatNumber(entry.totalLikes)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {formatNumber(entry.totalComments)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {formatNumber(entry.totalViews)}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                {formatNumber(entry.mentionCount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
