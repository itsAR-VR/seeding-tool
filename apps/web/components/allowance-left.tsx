"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format/date";

export type Allowance = { leftPercent: number; resetsAt: string | null };

/** This month's search allowance, or null while loading or when Apify can't say. */
export function useSearchAllowance(): Allowance | null {
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/apify")
      .then((res) =>
        res.ok
          ? (res.json() as Promise<{ allowanceLeftPercent?: number | null; allowanceResetsAt?: string | null }>)
          : null,
      )
      .then((data) => {
        if (cancelled || data?.allowanceLeftPercent == null) return;
        setAllowance({ leftPercent: data.allowanceLeftPercent, resetsAt: data.allowanceResetsAt ?? null });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  return allowance;
}

/** True when nothing is left, so a search would fail. */
export function allowanceUsedUp(allowance: Allowance | null): boolean {
  return allowance != null && allowance.leftPercent <= 0;
}

/** The words for it: "62% of this month's allowance is left." or, at 0%, when it comes back. */
export function allowanceText(allowance: Allowance): string {
  if (allowance.leftPercent <= 0) {
    return allowance.resetsAt
      ? `This month's search allowance is used up. Searches can run again after ${formatDate(allowance.resetsAt)}.`
      : "This month's search allowance is used up. Searches can run again when it resets next month.";
  }
  return `${allowance.leftPercent}% of this month's allowance is left.`;
}

/** Shown next to search-size advice. */
export function AllowanceLeft({ allowance }: { allowance: Allowance | null }) {
  if (!allowance) return null;
  return (
    <span className={allowanceUsedUp(allowance) ? "block font-medium text-destructive" : undefined}>
      {" "}
      {allowanceText(allowance)}
    </span>
  );
}
