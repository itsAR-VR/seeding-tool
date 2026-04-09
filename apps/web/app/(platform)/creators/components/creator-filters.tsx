"use client";

import { Card, CardContent } from "@/components/ui/card";
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

const SOURCE_OPTIONS = [
  { value: "", label: "All Sources" },
  { value: "phantombuster", label: "PhantomBuster" },
  { value: "apify", label: "Apify" },
  { value: "csv_import", label: "CSV Import" },
  { value: "manual", label: "Manual" },
  { value: "creator_marketplace", label: "Marketplace" },
];

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
    <Card>
      <CardContent className="pt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            placeholder="Search by handle or name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min followers"
              value={minFollowers}
              onChange={(e) => {
                setMinFollowers(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="number"
              placeholder="Max followers"
              value={maxFollowers}
              onChange={(e) => {
                setMaxFollowers(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Min views"
              value={minViews}
              onChange={(e) => {
                setMinViews(e.target.value);
                setPage(1);
              }}
            />
            <Input
              type="number"
              placeholder="Max views"
              value={maxViews}
              onChange={(e) => {
                setMaxViews(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {facets.categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value} ({option.count})
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-3 py-2 text-sm"
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
      </CardContent>
    </Card>
  );
}
