"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { InstagramHandleLink } from "@/components/instagram-handle-link";
import { UnifiedKeywordSelector, type KeywordGroup } from "@/components/unified-keyword-selector";
import { LocationInput } from "@/components/location-input";
import type {
  CampaignOption,
  SearchResult,
  SearchJobSummary,
  SearchSourceKey,
} from "../hooks/use-creators-state";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Add to Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No campaigns found. Create a campaign first.
            </p>
          ) : (
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={selectedCampaignId}
              onChange={(e) => setSelectedCampaignId(e.target.value)}
            >
              <option value="">Select a campaign...</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={!selectedCampaignId || addingToCampaign}
            >
              {addingToCampaign ? "Adding..." : "Add"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Search Modal ────────────────────────────────────────────────────────

type SearchModalProps = {
  discoveryApprovalMode: "recommend" | "auto";
  discoveryApprovalThreshold: number;
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
};

export function SearchModal({
  discoveryApprovalMode,
  discoveryApprovalThreshold,
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden">
        <CardHeader className="shrink-0 border-b pb-4">
          <CardTitle>Search Creators</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Discovered creators will use{" "}
            <span className={`font-medium ${discoveryApprovalMode === "recommend" ? "text-green-700" : "text-yellow-700"}`}>
              {discoveryApprovalMode === "recommend" ? "Recommend" : "Auto"} mode
            </span>
            {" "}&middot;{" "}
            <span className="font-medium">{(discoveryApprovalThreshold * 100).toFixed(0)}% threshold</span>
            {" "}&middot;{" "}
            <a href="/settings/brand" className="underline hover:text-foreground">
              Change in Brand Settings &rarr;
            </a>
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
            />
          )}

          {/* Searching state */}
          {searching && (
            <div className="flex flex-1 items-center justify-center py-8 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Running unified creator discovery...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Status: {searchStatus || "starting"}
              </p>
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

          {/* Actions */}
          <div className="mt-4 flex shrink-0 justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose}>
              {searchResults.length > 0 ? "Close" : "Cancel"}
            </Button>

            {searchResults.length === 0 && !searching && (
              <Button
                onClick={onStartSearch}
                disabled={
                  (selectedKeywords.length === 0 && !searchUsernames.trim()) ||
                  Boolean(searchLimitValidation.error)
                }
              >
                Search
              </Button>
            )}

            {searchResults.length > 0 && !searching && (
              <>
                <Button variant="outline" onClick={onNewSearch}>
                  New Search
                </Button>
                <Button
                  onClick={onImportSelected}
                  disabled={selectedResults.size === 0 || importing}
                >
                  {importing
                    ? "Importing..."
                    : `Import Selected (${selectedResults.size})`}
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
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-4 pr-1">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_320px]">
        <div className="space-y-5">
          <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Run one background discovery query across Collabstr,
            Apify search, and optional seed expansion. Add exact
            usernames only when you already know specific handles
            you want to validate.
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Sources</label>
            <div className="flex flex-wrap gap-2">
              {([
                ["collabstr", "Collabstr"],
                ["apify_search", "Apify Search"],
                ["approved_seed_following", "Approved Seed Following"],
                ["apify_keyword_email", "Keyword Email"],
              ] as Array<[SearchSourceKey, string]>).map(
                ([src, label]) => (
                  <Button
                    key={src}
                    type="button"
                    size="sm"
                    variant={searchSources[src] ? "default" : "outline"}
                    className="rounded-full"
                    onClick={() =>
                      setSearchSources((current) => ({
                        ...current,
                        [src]: !current[src],
                      }))
                    }
                  >
                    {label}
                  </Button>
                )
              )}
            </div>
          </div>

          {searchCategoriesLoading ? (
            <p className="text-sm text-muted-foreground">
              Loading keywords...
            </p>
          ) : (
            <UnifiedKeywordSelector
              groups={keywordGroups}
              selected={selectedKeywords}
              onChange={setSelectedKeywords}
            />
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Location</label>
            <LocationInput
              value={searchLocation}
              onChange={setSearchLocation}
              suggestions={locationSuggestions}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Exact usernames{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <textarea
                className="min-h-[108px] w-full rounded-md border px-3 py-2 text-sm"
                placeholder={"creatorone, creatortwo\ncreatorthree"}
                value={searchUsernames}
                onChange={(e) => setSearchUsernames(e.target.value)}
              />
              {usernameSuggestions.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Recent handles:{" "}
                  {usernameSuggestions
                    .slice(0, 4)
                    .map((option) => `@${option.value}`)
                    .join(", ")}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Follower range
              </label>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                <Input
                  type="number"
                  min={0}
                  placeholder="Min"
                  value={searchMinFollowers}
                  onChange={(e) => setSearchMinFollowers(e.target.value)}
                />
                <Input
                  type="number"
                  min={0}
                  placeholder="Max"
                  value={searchMaxFollowers}
                  onChange={(e) => setSearchMaxFollowers(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Creators per day
              </label>
              <Input
                type="number"
                min={1}
                step={1}
                value={searchLimit}
                onChange={(e) => setSearchLimit(e.target.value)}
              />
              {searchLimitValidation.error ? (
                <p className="text-sm text-destructive">
                  {searchLimitValidation.error}
                </p>
              ) : searchLimitWarning ? (
                <p className="text-sm text-amber-700">
                  {searchLimitWarning}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Use any positive integer. Values above 100 will still
                  save.
                </p>
              )}
            </div>
            <div className="space-y-2 md:pt-7">
              <div className="flex flex-wrap gap-2">
                <Badge variant="default">Instagram</Badge>
                <Badge variant="outline" className="opacity-60">
                  TikTok later
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-muted/15 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              How it works
            </p>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>Keywords combine your brand profile, creator data, and discovery categories.</li>
              <li>Type custom keywords or pick from the suggestions.</li>
              <li>Use the X on selected chips to remove them.</li>
              <li>Exact usernames are for known handles only.</li>
            </ul>
          </div>
        </aside>
      </div>
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
  return (
    <div className="min-h-0 flex-1 space-y-3 py-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {results.length} creators found
        </p>
        <Button size="sm" variant="ghost" onClick={onToggleAll}>
          {selectedResults.size === results.length
            ? "Deselect All"
            : "Select All"}
        </Button>
      </div>

      <div className="max-h-[400px] overflow-y-auto border rounded-md">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-background">
            <tr className="border-b text-left">
              <th className="p-2 w-8">
                <input
                  type="checkbox"
                  checked={
                    selectedResults.size === results.length &&
                    results.length > 0
                  }
                  onChange={onToggleAll}
                />
              </th>
              <th className="p-2 font-medium">Creator</th>
              <th className="p-2 font-medium">Sources</th>
              <th className="p-2 font-medium">Followers</th>
              <th className="p-2 font-medium">Avg Views</th>
              <th className="p-2 font-medium">Bio</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr
                key={result.id}
                className="border-b hover:bg-muted/50 cursor-pointer"
                onClick={() => onToggleResult(result.id)}
              >
                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={selectedResults.has(result.id)}
                    onChange={() => onToggleResult(result.id)}
                  />
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {result.imageUrl && (
                      <img
                        src={result.imageUrl}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <InstagramHandleLink
                        handle={result.handle}
                        url={result.profileUrl}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      />
                      {result.name && (
                        <p className="text-xs text-muted-foreground">
                          <InstagramHandleLink
                            handle={result.handle}
                            url={result.profileUrl}
                            className="hover:text-foreground hover:underline"
                          >
                            {result.name}
                          </InstagramHandleLink>
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {(result.sources ?? [
                      result.primarySource || result.source || "manual",
                    ]).map((src) => (
                      <Badge
                        key={`${result.id}-${src}`}
                        variant="outline"
                        className="text-[10px]"
                      >
                        {src}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="p-2 text-xs">
                  {result.followerCount?.toLocaleString() ?? "\u2014"}
                </td>
                <td className="p-2 text-xs">
                  {result.avgViews?.toLocaleString() ?? "\u2014"}
                </td>
                <td className="p-2 text-xs max-w-[200px] truncate">
                  {result.bio || result.bioCategory || "\u2014"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
