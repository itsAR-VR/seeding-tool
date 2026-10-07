"use client";

import { Input } from "@/components/ui/input";
import type { useCreatorsState } from "../hooks/use-creators-state";

type FilterProps = Pick<
  ReturnType<typeof useCreatorsState>,
  | "search"
  | "setSearch"
  | "minFollowers"
  | "setMinFollowers"
  | "maxFollowers"
  | "setMaxFollowers"
  | "minViews"
  | "setMinViews"
  | "maxViews"
  | "setMaxViews"
  | "category"
  | "setCategory"
  | "source"
  | "setSource"
  | "setPage"
  | "facets"
>;

/** Plain names for where a creator came from. Keys are the stored source values. */
export const SOURCE_LABELS: Record<string, string> = {
  apify: "Instagram search",
  apify_search: "Instagram search",
  apify_keyword_email: "Instagram search",
  phantombuster: "Instagram list",
  collabstr: "Collabstr",
  creator_marketplace: "Collabstr",
  approved_seed_following: "Followed by your creators",
  csv_import: "Imported list",
  manual: "Added by hand",
};

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Added by hand";
  return SOURCE_LABELS[source] ?? source.replace(/_/g, " ");
}

const SOURCE_OPTIONS = [
  { value: "", label: "Any source" },
  { value: "apify", label: "Instagram search" },
  { value: "creator_marketplace", label: "Collabstr" },
  { value: "phantombuster", label: "Instagram list" },
  { value: "csv_import", label: "Imported list" },
  { value: "manual", label: "Added by hand" },
];

const selectClass =
  "h-9 w-full rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CreatorFilters({
  search,
  setSearch,
  minFollowers,
  setMinFollowers,
  maxFollowers,
  setMaxFollowers,
  minViews,
  setMinViews,
  maxViews,
  setMaxViews,
  category,
  setCategory,
  source,
  setSource,
  setPage,
  facets,
}: FilterProps) {
  return (
    <section aria-label="Filter creators" className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label htmlFor="creator-search" className="text-sm font-medium">
            Name or handle
          </label>
          <Input
            id="creator-search"
            placeholder="Search creators"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Followers</legend>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              aria-label="Fewest followers"
              placeholder="From"
              value={minFollowers}
              onChange={(e) => {
                setMinFollowers(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="number"
              min={0}
              aria-label="Most followers"
              placeholder="To"
              value={maxFollowers}
              onChange={(e) => {
                setMaxFollowers(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Average views</legend>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              aria-label="Fewest average views"
              placeholder="From"
              value={minViews}
              onChange={(e) => {
                setMinViews(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="number"
              min={0}
              aria-label="Most average views"
              placeholder="To"
              value={maxViews}
              onChange={(e) => {
                setMaxViews(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label htmlFor="creator-category" className="text-sm font-medium">
              Category
            </label>
            <select
              id="creator-category"
              className={selectClass}
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Any</option>
              {facets.categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} ({option.count})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="creator-source" className="text-sm font-medium">
              Found through
            </label>
            <select
              id="creator-source"
              className={selectClass}
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
