"use client";

import { useEffect, useState } from "react";

/** " 62% of this month's allowance is left." next to search-size advice, or nothing if unknown. */
export function AllowanceLeft() {
  const [percent, setPercent] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/apify")
      .then((res) => (res.ok ? (res.json() as Promise<{ allowanceLeftPercent?: number | null }>) : null))
      .then((data) => {
        if (!cancelled && data?.allowanceLeftPercent != null) setPercent(data.allowanceLeftPercent);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  if (percent == null) return null;
  return (
    <>
      {" "}
      <span className="font-semibold tabular-nums">{percent}%</span> of this month&apos;s allowance is left.
    </>
  );
}
