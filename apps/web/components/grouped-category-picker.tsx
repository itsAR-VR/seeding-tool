"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type CategoryGroups = {
  apify: string[];
  collabstr: string[];
};

export type CategorySelection = {
  apify: string[];
  collabstr: string[];
};

type GroupedCategoryPickerProps = {
  categories: CategoryGroups;
  selected: CategorySelection;
  onChange: (next: CategorySelection) => void;
};

const GROUP_LABELS = {
  apify: "Apify",
  collabstr: "Collabstr",
} as const;

function toggleValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function SelectedSummary({
  label,
  values,
  variant,
}: {
  label: string;
  values: string[];
  variant: "default" | "secondary";
}) {
  if (values.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {values.map((value) => (
        <Badge key={`${label}-${value}`} variant={variant}>
          {value}
        </Badge>
      ))}
    </div>
  );
}

export function GroupedCategoryPicker({
  categories,
  selected,
  onChange,
}: GroupedCategoryPickerProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return categories;
    }

    return {
      apify: categories.apify.filter((value) =>
        value.toLowerCase().includes(normalizedQuery)
      ),
      collabstr: categories.collabstr.filter((value) =>
        value.toLowerCase().includes(normalizedQuery)
      ),
    };
  }, [categories, query]);

  function toggleGroupValue(
    group: keyof CategorySelection,
    value: string
  ) {
    onChange({
      ...selected,
      [group]: toggleValue(selected[group], value),
    });
  }

  const totalSelected = selected.apify.length + selected.collabstr.length;

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search categories"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="rounded-lg border bg-muted/15 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected categories</p>
            {totalSelected === 0 ? (
              <p className="text-xs text-muted-foreground">
                Pick at least one category to guide discovery.
              </p>
            ) : (
              <div className="space-y-2">
                <SelectedSummary
                  label="Apify"
                  values={selected.apify}
                  variant="default"
                />
                <SelectedSummary
                  label="Collabstr"
                  values={selected.collabstr}
                  variant="secondary"
                />
              </div>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {totalSelected} selected
          </span>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {(Object.keys(filtered) as Array<keyof CategorySelection>).map((group) => (
          <div key={group} className="space-y-2 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{GROUP_LABELS[group]}</p>
              <span className="text-xs text-muted-foreground">
                {filtered[group].length} options
              </span>
            </div>
            {filtered[group].length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No {GROUP_LABELS[group]} categories match this search.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filtered[group].map((value) => {
                  const isSelected = selected[group].includes(value);

                  return (
                    <Button
                      key={`${group}-${value}`}
                      type="button"
                      size="sm"
                      variant={isSelected ? "default" : "outline"}
                      className="h-8 rounded-full px-3 text-xs"
                      onClick={() => toggleGroupValue(group, value)}
                    >
                      {value}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
