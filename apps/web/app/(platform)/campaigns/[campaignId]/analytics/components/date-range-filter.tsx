"use client";

import { useState, useCallback } from "react";

type DateRangeFilterProps = {
  readonly onRangeChange: (from: string | undefined, to: string | undefined) => void;
};

export function DateRangeFilter({ onRangeChange }: DateRangeFilterProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const handleApply = useCallback(() => {
    onRangeChange(from || undefined, to || undefined);
  }, [from, to, onRangeChange]);

  const handleClear = useCallback(() => {
    setFrom("");
    setTo("");
    onRangeChange(undefined, undefined);
  }, [onRangeChange]);

  return (
    <div className="flex items-end gap-3 flex-wrap">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm"
        />
      </div>
      <button
        onClick={handleApply}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Apply
      </button>
      {(from || to) && (
        <button
          onClick={handleClear}
          className="rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Clear
        </button>
      )}
    </div>
  );
}
