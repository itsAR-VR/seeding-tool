"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  className?: string;
};

type ResolvedOption = {
  value: string;
  group: string;
};

function buildDeduplicatedOptions(groups: KeywordGroup[]): ResolvedOption[] {
  const seen = new Set<string>();
  const result: ResolvedOption[] = [];

  for (const group of groups) {
    for (const keyword of group.keywords) {
      const lower = keyword.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push({ value: keyword, group: group.label });
      }
    }
  }

  return result;
}

export function UnifiedKeywordSelector({
  groups,
  selected,
  onChange,
  className,
}: UnifiedKeywordSelectorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  const allOptions = useMemo(() => buildDeduplicatedOptions(groups), [groups]);

  const filteredByGroup = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? allOptions.filter((opt) => opt.value.toLowerCase().includes(normalizedQuery))
      : allOptions;

    const grouped = new Map<string, ResolvedOption[]>();
    for (const opt of filtered) {
      const arr = grouped.get(opt.group) ?? [];
      arr.push(opt);
      grouped.set(opt.group, arr);
    }
    return grouped;
  }, [allOptions, query]);

  const selectedLower = useMemo(
    () => new Set(selected.map((s) => s.toLowerCase())),
    [selected]
  );

  const canAddFreeText =
    query.trim().length > 0 && !selectedLower.has(query.trim().toLowerCase());

  const noGroupMatches = filteredByGroup.size === 0;

  function toggleValue(value: string) {
    if (selectedLower.has(value.toLowerCase())) {
      onChange(selected.filter((s) => s.toLowerCase() !== value.toLowerCase()));
    } else {
      onChange([...selected, value]);
    }
  }

  function addFreeText() {
    const trimmed = query.trim();
    if (!trimmed || selectedLower.has(trimmed.toLowerCase())) return;
    onChange([...selected, trimmed]);
    setQuery("");
  }

  function removeValue(value: string) {
    onChange(selected.filter((s) => s.toLowerCase() !== value.toLowerCase()));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (canAddFreeText) {
        addFreeText();
      }
    }
  }

  const triggerLabel =
    selected.length === 0
      ? "Choose keywords"
      : `${selected.length} keyword${selected.length === 1 ? "" : "s"} selected`;

  return (
    <div ref={rootRef} className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">Keywords</label>
        {selected.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {selected.length} selected
          </span>
        )}
      </div>

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-between px-3 font-normal"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((c) => !c)}
        >
          <span className="truncate text-left text-sm text-foreground/80">
            {triggerLabel}
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </Button>

        {isOpen && (
          <div className="absolute left-0 right-0 z-30 mt-2 rounded-xl border bg-background p-3 shadow-lg">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search or type a custom keyword…"
                className="flex-1"
              />
              {canAddFreeText && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1 px-2"
                  onClick={addFreeText}
                >
                  <PlusIcon className="size-3.5" />
                  Add
                </Button>
              )}
            </div>

            <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">
              {noGroupMatches && !canAddFreeText && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No matching keywords. Type a custom one and press Enter.
                </p>
              )}

              {Array.from(filteredByGroup.entries()).map(([groupLabel, options]) => (
                <div key={groupLabel}>
                  <p className="sticky top-0 bg-background px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {groupLabel}
                  </p>
                  {options.map((opt) => {
                    const isSelected = selectedLower.has(opt.value.toLowerCase());
                    return (
                      <button
                        key={`${groupLabel}-${opt.value}`}
                        type="button"
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                          isSelected && "bg-muted"
                        )}
                        onClick={() => toggleValue(opt.value)}
                      >
                        <span className="min-w-0 truncate">{opt.value}</span>
                        {isSelected && <CheckIcon className="ml-2 size-3.5 shrink-0 text-muted-foreground" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((value) => (
            <Badge
              key={`kw-${value}`}
              variant="secondary"
              className="gap-1 rounded-full pr-1"
            >
              <span>{value}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-black/10"
                onClick={() => removeValue(value)}
                aria-label={`Remove ${value}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
