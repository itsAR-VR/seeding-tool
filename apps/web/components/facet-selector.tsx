"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FacetSelectorOption = {
  value: string;
  count?: number;
  label?: string;
};

type FacetSelectorProps = {
  label: string;
  options: FacetSelectorOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  multiple?: boolean;
  className?: string;
};

export function FacetSelector({
  label,
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder = "Filter options",
  emptyText = "No matching options.",
  multiple = true,
  className,
}: FacetSelectorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
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

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      (option.label ?? option.value).toLowerCase().includes(normalizedQuery)
    );
  }, [options, query]);

  const selectedOptions = useMemo(() => {
    const optionMap = new Map(
      options.map((option) => [option.value, option.label ?? option.value])
    );
    return selected.map((value) => ({
      value,
      label: optionMap.get(value) ?? value,
    }));
  }, [options, selected]);

  function toggleValue(value: string) {
    if (multiple) {
      onChange(
        selected.includes(value)
          ? selected.filter((entry) => entry !== value)
          : [...selected, value]
      );
      return;
    }

    onChange(selected[0] === value ? [] : [value]);
    setIsOpen(false);
  }

  function removeValue(value: string) {
    onChange(selected.filter((entry) => entry !== value));
  }

  const triggerLabel =
    selectedOptions.length === 0
      ? placeholder
      : multiple
        ? `${selectedOptions.length} selected`
        : selectedOptions[0]?.label ?? placeholder;

  return (
    <div ref={rootRef} className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium">{label}</label>
        {selectedOptions.length > 0 ? (
          <span className="text-xs text-muted-foreground">
            {selectedOptions.length} selected
          </span>
        ) : null}
      </div>

      <div className="relative">
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-between px-3 font-normal"
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="truncate text-left text-sm text-foreground/80">
            {triggerLabel}
          </span>
          <ChevronDownIcon className="size-4 text-muted-foreground" />
        </Button>

        {isOpen ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 rounded-xl border bg-background p-3 shadow-lg">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
            />
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  {emptyText}
                </p>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = selected.includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                        isSelected && "bg-muted"
                      )}
                      onClick={() => toggleValue(option.value)}
                    >
                      <span className="min-w-0 truncate">
                        {option.label ?? option.value}
                      </span>
                      <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {typeof option.count === "number" ? `(${option.count})` : null}
                        {isSelected ? <CheckIcon className="size-3.5" /> : null}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>

      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <Badge
              key={`${label}-${option.value}`}
              variant="secondary"
              className="gap-1 rounded-full pr-1"
            >
              <span>{option.label}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-black/10"
                onClick={() => removeValue(option.value)}
                aria-label={`Remove ${option.label}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
