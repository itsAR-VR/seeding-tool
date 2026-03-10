"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type LocationSuggestion = {
  value: string;
  count?: number;
};

type LocationInputProps = {
  value: string;
  onChange: (value: string) => void;
  suggestions: LocationSuggestion[];
  className?: string;
};

const COMMON_LOCATIONS = [
  "Los Angeles, CA",
  "New York, NY",
  "Miami, FL",
  "Chicago, IL",
  "Austin, TX",
  "London, UK",
  "Toronto, Canada",
];

export function LocationInput({
  value,
  onChange,
  suggestions,
  className,
}: LocationInputProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsFocused(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const hasSavedSuggestions = suggestions.length > 0;
  const displaySuggestions: LocationSuggestion[] = hasSavedSuggestions
    ? suggestions
    : COMMON_LOCATIONS.map((v) => ({ value: v }));

  const normalizedValue = value.trim().toLowerCase();
  const filtered = normalizedValue
    ? displaySuggestions.filter((s) => s.value.toLowerCase().includes(normalizedValue))
    : displaySuggestions;

  const showDropdown = isFocused && filtered.length > 0;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        placeholder="e.g. Los Angeles, CA"
      />

      {showDropdown && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border bg-background p-2 shadow-lg">
          {!hasSavedSuggestions && (
            <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Common locations
            </p>
          )}
          {hasSavedSuggestions && (
            <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Saved locations
            </p>
          )}
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {filtered.map((suggestion) => (
              <button
                key={suggestion.value}
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(suggestion.value);
                  setIsFocused(false);
                }}
              >
                <span>{suggestion.value}</span>
                {typeof suggestion.count === "number" && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({suggestion.count})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
