"use client";

import { Badge } from "@/components/ui/badge";
import {
  FacetSelector,
  type FacetSelectorOption,
} from "@/components/facet-selector";

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

function buildCombinedOptions(categories: CategoryGroups): FacetSelectorOption[] {
  return Array.from(
    new Set([...categories.apify, ...categories.collabstr].map((value) => value.trim()))
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value }));
}

function flattenSelection(selected: CategorySelection) {
  return Array.from(
    new Set([...selected.apify, ...selected.collabstr].map((value) => value.trim()))
  ).filter(Boolean);
}

function splitSelection(
  values: string[],
  categories: CategoryGroups
): CategorySelection {
  const apifySet = new Set(categories.apify);
  const collabstrSet = new Set(categories.collabstr);

  return {
    apify: values.filter((value) => apifySet.has(value)),
    collabstr: values.filter((value) => collabstrSet.has(value)),
  };
}

export function GroupedCategoryPicker({
  categories,
  selected,
  onChange,
}: GroupedCategoryPickerProps) {
  function removeValue(value: string) {
    const nextValues = flattenSelection(selected).filter((entry) => entry !== value);
    onChange(splitSelection(nextValues, categories));
  }

  const combinedOptions = buildCombinedOptions(categories);
  const selectedValues = flattenSelection(selected);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-muted/15 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-sm font-medium">Selected keywords</p>
            {selectedValues.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Pick at least one keyword to guide discovery.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {selectedValues.map((value) => (
                  <Badge
                    key={`selected-${value}`}
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
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {selectedValues.length} selected
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <FacetSelector
          label="Discovery keywords"
          options={combinedOptions}
          selected={selectedValues}
          onChange={(nextValues) => onChange(splitSelection(nextValues, categories))}
          placeholder="Choose supported keywords"
          searchPlaceholder="Filter supported keywords"
          emptyText="No supported keywords match."
        />
      </div>
    </div>
  );
}
