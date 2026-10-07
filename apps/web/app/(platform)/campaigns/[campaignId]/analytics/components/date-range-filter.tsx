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
        <label htmlFor="results-from" className="block text-sm font-medium text-muted-foreground">
          From
        </label>
        <input
          id="results-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="results-to" className="block text-sm font-medium text-muted-foreground">
          To
        </label>
        <input
          id="results-to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={handleApply}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Show these dates
      </button>
      {(from || to) && (
        <button
          type="button"
          onClick={handleClear}
          className="rounded-md border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Show all dates
        </button>
      )}
    </div>
  );
}
