"use client";

import { useMemo, useState } from "react";
import { PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type KeywordGroup = {
  label: string;
  keywords: string[];
};

type UnifiedKeywordSelectorProps = {
  groups: KeywordGroup[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Text typed but not added yet, so the parent can enable its search button. */
  onPendingChange?: (text: string) => void;
  className?: string;
};

/** How many suggestions to show before "Show more". */
const SUGGESTIONS_SHOWN = 12;

/**
 * Type anything to search for (Enter or comma adds it), or tap a suggestion.
 * Whatever is typed but not yet added is added when the field loses focus,
 * so pressing the search button right after typing still counts it.
 */
export function UnifiedKeywordSelector({
  groups,
  selected,
  onChange,
  onPendingChange,
  className,
}: UnifiedKeywordSelectorProps) {
  const [query, setQueryState] = useState("");
  const setQuery = (text: string) => {
    setQueryState(text);
    onPendingChange?.(text.trim());
  };
  const [showAll, setShowAll] = useState(false);

  const selectedLower = useMemo(() => new Set(selected.map((s) => s.toLowerCase())), [selected]);

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const all: string[] = [];
    for (const group of groups) {
      for (const keyword of group.keywords) {
        const lower = keyword.toLowerCase();
        if (seen.has(lower) || selectedLower.has(lower)) continue;
        seen.add(lower);
        all.push(keyword);
      }
    }
    const typed = query.trim().toLowerCase();
    return typed ? all.filter((k) => k.toLowerCase().includes(typed)) : all;
  }, [groups, selectedLower, query]);

  function add(raw: string) {
    const parts = raw
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p && !selectedLower.has(p.toLowerCase()));
    if (parts.length > 0) onChange([...selected, ...new Set(parts)]);
    setQuery("");
  }

  function remove(value: string) {
    onChange(selected.filter((s) => s.toLowerCase() !== value.toLowerCase()));
  }

  const visible = showAll ? suggestions : suggestions.slice(0, SUGGESTIONS_SHOWN);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-1.5">
        <label htmlFor="creator-search-words" className="text-sm font-medium">
          What to search for
        </label>
        <div className="flex gap-2">
          <Input
            id="creator-search-words"
            value={query}
            onChange={(e) => {
              const value = e.target.value;
              if (value.endsWith(",")) add(value);
              else setQuery(value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(query);
              } else if (e.key === "Backspace" && !query && selected.length > 0) {
                remove(selected[selected.length - 1]);
              }
            }}
            onBlur={() => query.trim() && add(query)}
            placeholder="Anything, like mom entrepreneur or night routine"
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => add(query)}
            disabled={!query.trim()}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40"
          >
            <PlusIcon className="size-4" aria-hidden />
            Add
          </button>
        </div>
        <p className="text-sm text-muted-foreground">Press Enter after each one. Bios and names are matched against these.</p>
      </div>

      {selected.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Searching for">
          {selected.map((value) => (
            <li key={`kw-${value}`}>
              <Badge variant="default" className="gap-1 rounded-full py-1 pl-3 pr-1 text-sm">
                {value}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-white/20"
                  onClick={() => remove(value)}
                  aria-label={`Remove ${value}`}
                >
                  <XIcon className="size-3.5" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {visible.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{query.trim() ? "Matching suggestions" : "Suggestions"}</p>
          <div className="flex flex-wrap gap-2">
            {visible.map((keyword) => (
              <button
                key={keyword}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange([...selected, keyword]);
                  setQuery("");
                }}
                className="rounded-full border px-3 py-1 text-sm transition-colors hover:bg-muted"
              >
                {keyword}
              </button>
            ))}
            {!showAll && suggestions.length > SUGGESTIONS_SHOWN && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="rounded-full px-3 py-1 text-sm font-medium underline"
              >
                Show {suggestions.length - SUGGESTIONS_SHOWN} more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
