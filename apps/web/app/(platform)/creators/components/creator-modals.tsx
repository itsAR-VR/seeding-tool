"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InstagramHandleLink } from "@/components/instagram-handle-link";
import { UnifiedKeywordSelector, type KeywordGroup } from "@/components/unified-keyword-selector";
import { LocationInput } from "@/components/location-input";
import type {
  CampaignOption,
  SearchResult,
  SearchSourceKey,
} from "../hooks/use-creators-state";
import { sourceLabel } from "./creator-filters";

// ── Campaign Modal ──────────────────────────────────────────────────────

type CampaignModalProps = {
  campaigns: CampaignOption[];
  selectedCampaignId: string;
  setSelectedCampaignId: (id: string) => void;
  addingToCampaign: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function CampaignModal({
  campaigns,
  selectedCampaignId,
  setSelectedCampaignId,
  addingToCampaign,
  onConfirm,
  onClose,
}: CampaignModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card
        className="w-full max-w-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-to-campaign-title"
      >
        <CardHeader>
          <CardTitle id="add-to-campaign-title">Add to a campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaigns.length === 0 ? (
            <div className="space-y-1">
              <p className="text-sm">You don&apos;t have a campaign yet.</p>
              <p className="text-sm text-muted-foreground">
                Start one first, then come back to add this creator.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="campaign-select" className="text-sm font-medium">
                Campaign
              </label>
              <select
                id="campaign-select"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
              >
                <option value="">Choose a campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {campaigns.length === 0 ? (
              <Link href="/campaigns/new" className={buttonVariants()}>
                Start a campaign
              </Link>
            ) : (
              <Button onClick={onConfirm} disabled={!selectedCampaignId || addingToCampaign}>
                {addingToCampaign ? "Adding..." : "Add to campaign"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Search Modal ────────────────────────────────────────────────────────

type SearchModalProps = {
  searchResults: SearchResult[];
  searching: boolean;
  searchStatus: string | null;
  selectedResults: Set<string>;
  importing: boolean;
  searchSources: Record<SearchSourceKey, boolean>;
  setSearchSources: (fn: (current: Record<SearchSourceKey, boolean>) => Record<SearchSourceKey, boolean>) => void;
  searchCategoriesLoading: boolean;
  keywordGroups: KeywordGroup[];
  selectedKeywords: string[];
  setSelectedKeywords: (keywords: string[]) => void;
  searchLocation: string;
  setSearchLocation: (location: string) => void;
  locationSuggestions: { value: string; count: number }[];
  searchUsernames: string;
  setSearchUsernames: (value: string) => void;
  usernameSuggestions: { value: string; count: number }[];
  searchMinFollowers: string;
  setSearchMinFollowers: (value: string) => void;
  searchMaxFollowers: string;
  setSearchMaxFollowers: (value: string) => void;
  searchLimit: string;
  setSearchLimit: (value: string) => void;
  searchLimitValidation: { value: number | null; error: string | null };
  searchLimitWarning: string | null;

  onStartSearch: () => void;
  onToggleResult: (id: string) => void;
  onToggleAll: () => void;
  onImportSelected: () => void;
  onClose: () => void;
  onNewSearch: () => void;
  /** Why the search didn't start, shown above the buttons. */
  searchError?: string | null;
};

export function SearchModal({
  searchError,
  searchResults,
  searching,
  searchStatus,
  selectedResults,
  importing,
  searchSources,
  setSearchSources,
  searchCategoriesLoading,
  keywordGroups,
  selectedKeywords,
  setSelectedKeywords,
  searchLocation,
  setSearchLocation,
  locationSuggestions,
  searchUsernames,
  setSearchUsernames,
  usernameSuggestions,
  searchMinFollowers,
  setSearchMinFollowers,
  searchMaxFollowers,
  setSearchMaxFollowers,
  searchLimit,
  setSearchLimit,
  searchLimitValidation,
  searchLimitWarning,
  onStartSearch,
  onToggleResult,
  onToggleAll,
  onImportSelected,
  onClose,
  onNewSearch,
}: SearchModalProps) {
  const [pendingWords, setPendingWords] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden">
        <CardHeader className="shrink-0 border-b pb-4">
          <CardTitle>Find creators</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Type what their content is about. We search Instagram and Collabstr and score each creator against your
            brand.
          </p>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          {/* Search Form */}
          {searchResults.length === 0 && !searching && (
            <SearchForm
              searchSources={searchSources}
              setSearchSources={setSearchSources}
              searchCategoriesLoading={searchCategoriesLoading}
              keywordGroups={keywordGroups}
              selectedKeywords={selectedKeywords}
              setSelectedKeywords={setSelectedKeywords}
              searchLocation={searchLocation}
              setSearchLocation={setSearchLocation}
              locationSuggestions={locationSuggestions}
              searchUsernames={searchUsernames}
              setSearchUsernames={setSearchUsernames}
              usernameSuggestions={usernameSuggestions}
              searchMinFollowers={searchMinFollowers}
              setSearchMinFollowers={setSearchMinFollowers}
              searchMaxFollowers={searchMaxFollowers}
              setSearchMaxFollowers={setSearchMaxFollowers}
              searchLimit={searchLimit}
              setSearchLimit={setSearchLimit}
              searchLimitValidation={searchLimitValidation}
              searchLimitWarning={searchLimitWarning}
              onPendingWordsChange={setPendingWords}
            />
          )}

          {/* Searching state */}
          {searching && (
            <div className="flex flex-1 items-center justify-center py-8 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="font-medium">Finding creators...</p>
              <p className="mt-1 text-sm text-muted-foreground">
                This takes a few minutes. You can close this and keep working; results stay on the Creators page.
              </p>
              <span className="sr-only">Status: {searchStatus || "starting"}</span>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && !searching && (
            <SearchResultsTable
              results={searchResults}
              selectedResults={selectedResults}
              onToggleResult={onToggleResult}
              onToggleAll={onToggleAll}
            />
          )}

          {searchError && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {searchError}
            </p>
          )}

          {/* Actions */}
          <div className="mt-4 flex shrink-0 justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              {searchResults.length > 0 ? "Close" : "Cancel"}
            </Button>

            {searchResults.length === 0 && !searching && (
              <Button
                onClick={onStartSearch}
                disabled={
                  (selectedKeywords.length === 0 && !pendingWords && !searchUsernames.trim()) ||
                  Boolean(searchLimitValidation.error)
                }
              >
                Find creators
              </Button>
            )}

            {searchResults.length > 0 && !searching && (
              <>
                <Button variant="outline" onClick={onNewSearch}>
                  New search
                </Button>
                <Button
                  onClick={onImportSelected}
                  disabled={selectedResults.size === 0 || importing}
                >
                  {importing
                    ? "Adding..."
                    : `Add ${selectedResults.size} to my creators`}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Search Form (inner) ─────────────────────────────────────────────────

function SearchForm({
  searchSources,
  setSearchSources,
  searchCategoriesLoading,
  keywordGroups,
  selectedKeywords,
  setSelectedKeywords,
  searchLocation,
  setSearchLocation,
  locationSuggestions,
  searchUsernames,
  setSearchUsernames,
  usernameSuggestions,
  searchMinFollowers,
  setSearchMinFollowers,
  searchMaxFollowers,
  setSearchMaxFollowers,
  searchLimit,
  setSearchLimit,
  searchLimitValidation,
  searchLimitWarning,
  onPendingWordsChange,
}: {
  searchSources: Record<SearchSourceKey, boolean>;
  setSearchSources: (fn: (current: Record<SearchSourceKey, boolean>) => Record<SearchSourceKey, boolean>) => void;
  searchCategoriesLoading: boolean;
  keywordGroups: KeywordGroup[];
  selectedKeywords: string[];
  setSelectedKeywords: (keywords: string[]) => void;
  searchLocation: string;
  setSearchLocation: (location: string) => void;
  locationSuggestions: { value: string; count: number }[];
  searchUsernames: string;
  setSearchUsernames: (value: string) => void;
  usernameSuggestions: { value: string; count: number }[];
  searchMinFollowers: string;
  setSearchMinFollowers: (value: string) => void;
  searchMaxFollowers: string;
  setSearchMaxFollowers: (value: string) => void;
  searchLimit: string;
  setSearchLimit: (value: string) => void;
  searchLimitValidation: { value: number | null; error: string | null };
  searchLimitWarning: string | null;
  onPendingWordsChange: (text: string) => void;
}) {
  // Only suggest words tied to this brand and its creators; the generic
  // category list (Automotive, Gaming...) is noise for most brands.
  const brandGroups = keywordGroups.filter((g) => g.label !== "Categories");
  const sourceOptions: Array<[SearchSourceKey, string, string]> = [
    ["apify_search", "Instagram", "Search Instagram profiles for your words."],
    ["collabstr", "Collabstr", "Creators listed on the Collabstr marketplace."],
    ["approved_seed_following", "Who your approved creators follow", "Finds similar creators. Slower."],
    ["apify_keyword_email", "Instagram, emails first", "Only creators with a public email. Slower."],
  ];
  const sourceCount = Object.values(searchSources).filter(Boolean).length;

  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-5 pr-1">
      {searchCategoriesLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      ) : (
        <UnifiedKeywordSelector
          groups={brandGroups}
          selected={selectedKeywords}
          onChange={setSelectedKeywords}
          onPendingChange={onPendingWordsChange}
        />
      )}

      <div className="flex flex-wrap gap-6">
        <div className="space-y-1.5">
          <label htmlFor="search-limit" className="block text-sm font-medium">
            How many creators
          </label>
          <Input
            id="search-limit"
            type="number"
            min={1}
            step={1}
            value={searchLimit}
            onChange={(e) => setSearchLimit(e.target.value)}
            className="w-28"
          />
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Followers</legend>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              placeholder="Any"
              aria-label="Fewest followers"
              value={searchMinFollowers}
              onChange={(e) => setSearchMinFollowers(e.target.value)}
              className="w-32"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="number"
              min={0}
              placeholder="Any"
              aria-label="Most followers"
              value={searchMaxFollowers}
              onChange={(e) => setSearchMaxFollowers(e.target.value)}
              className="w-32"
            />
          </div>
        </fieldset>
      </div>
      {searchLimitValidation.error ? (
        <p className="-mt-3 text-sm text-destructive">{searchLimitValidation.error}</p>
      ) : searchLimitWarning ? (
        <p className="-mt-3 text-sm text-amber-700">{searchLimitWarning}</p>
      ) : (
        <p className="-mt-3 text-sm text-muted-foreground">
          Start with 10 to 25. Bigger searches take longer and use more Apify credit.
        </p>
      )}

      <details className="group rounded-lg border">
        <summary className="cursor-pointer list-none px-4 py-3 font-medium marker:hidden">
          More options
          <span className="ml-2 font-normal text-muted-foreground">
            {sourceCount} {sourceCount === 1 ? "place" : "places"} to look
            {searchLocation ? `, near ${searchLocation}` : ""}
          </span>
        </summary>
        <div className="space-y-5 border-t px-4 py-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Where to look</legend>
            {sourceOptions.map(([src, label, hint]) => (
              <label key={src} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  checked={searchSources[src]}
                  onChange={() => setSearchSources((current) => ({ ...current, [src]: !current[src] }))}
                />
                <span>
                  <span className="font-medium">{label}</span>
                  <span className="block text-sm text-muted-foreground">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium">Location (optional)</label>
            <LocationInput value={searchLocation} onChange={setSearchLocation} suggestions={locationSuggestions} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="search-usernames" className="block text-sm font-medium">
              Specific creators to check (optional)
            </label>
            <textarea
              id="search-usernames"
              className="min-h-20 w-full rounded-lg border bg-background px-3 py-2"
              placeholder="Instagram handles, separated by commas"
              value={searchUsernames}
              onChange={(e) => setSearchUsernames(e.target.value)}
            />
            {usernameSuggestions.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Recent: {usernameSuggestions.slice(0, 4).map((option) => `@${option.value}`).join(", ")}
              </p>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}

// ── Search Results Table (inner) ────────────────────────────────────────

function SearchResultsTable({
  results,
  selectedResults,
  onToggleResult,
  onToggleAll,
}: {
  results: SearchResult[];
  selectedResults: Set<string>;
  onToggleResult: (id: string) => void;
  onToggleAll: () => void;
}) {
  const allSelected = selectedResults.size === results.length && results.length > 0;
  return (
    <div className="min-h-0 flex-1 space-y-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {results.length} {results.length === 1 ? "creator" : "creators"} found.{" "}
          <span className="font-normal text-muted-foreground">
            {selectedResults.size} selected.
          </span>
        </p>
        <Button variant="ghost" onClick={onToggleAll}>
          {allSelected ? "Clear selection" : "Select all"}
        </Button>
      </div>

      <div className="max-h-[400px] overflow-y-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b text-left text-muted-foreground">
              <th scope="col" className="w-10 p-3">
                <input
                  type="checkbox"
                  aria-label="Select all creators"
                  className="h-4 w-4"
                  checked={allSelected}
                  onChange={onToggleAll}
                />
              </th>
              <th scope="col" className="p-3 font-medium">Creator</th>
              <th scope="col" className="p-3 font-medium">Found through</th>
              <th scope="col" className="p-3 font-medium">Followers</th>
              <th scope="col" className="p-3 font-medium">Average views</th>
              <th scope="col" className="p-3 font-medium">Bio</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {results.map((result) => {
              const labels = Array.from(
                new Set(
                  (result.sources ?? [result.primarySource || result.source || "manual"]).map(
                    (src) => sourceLabel(src)
                  )
                )
              );
              const checked = selectedResults.has(result.id);
              return (
                <tr
                  key={result.id}
                  className={`cursor-pointer hover:bg-muted/50 ${checked ? "bg-muted/30" : ""}`}
                  onClick={() => onToggleResult(result.id)}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      aria-label={`Select @${result.handle}`}
                      className="h-4 w-4"
                      checked={checked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleResult(result.id)}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {result.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={result.imageUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      )}
                      <div>
                        {result.name && <p className="font-medium">{result.name}</p>}
                        <InstagramHandleLink
                          handle={result.handle}
                          url={result.profileUrl}
                          className="text-blue-700 hover:underline"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="p-3">{labels.join(", ")}</td>
                  <td className="whitespace-nowrap p-3 tabular-nums">
                    {result.followerCount?.toLocaleString() ?? (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 tabular-nums">
                    {result.avgViews?.toLocaleString() ?? (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </td>
                  <td className="max-w-[240px] truncate p-3" title={result.bio || result.bioCategory || undefined}>
                    {result.bio || result.bioCategory || <span className="text-muted-foreground">No bio</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
