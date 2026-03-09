"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InstagramHandleLink } from "@/components/instagram-handle-link";

type CreatorProfile = {
  platform: string;
  handle: string;
  url: string | null;
  followerCount: number | null;
};

type CampaignCreatorLink = {
  id: string;
  campaignId: string;
  reviewStatus: string;
  campaign: { id: string; name: string };
};

type Creator = {
  id: string;
  name: string | null;
  email: string | null;
  instagramHandle: string | null;
  discoverySource: string;
  followerCount: number | null;
  avgViews: number | null;
  bioCategory: string | null;
  optedOut: boolean;
  createdAt: string;
  profiles: CreatorProfile[];
  campaignCreators: CampaignCreatorLink[];
};

type CampaignOption = {
  id: string;
  name: string;
};

type SearchResult = {
  id: string;
  handle: string;
  name: string | null;
  followerCount: number | null;
  engagementRate: number | null;
  profileUrl: string | null;
  imageUrl: string | null;
  bio: string | null;
  bioCategory: string | null;
  platform: string;
};

type FacetOption = {
  value: string;
  count: number;
};

type CreatorFacets = {
  categories: FacetOption[];
  keywords: FacetOption[];
  hashtags: FacetOption[];
  usernames: FacetOption[];
};

const EMPTY_FACETS: CreatorFacets = {
  categories: [],
  keywords: [],
  hashtags: [],
  usernames: [],
};

function appendDelimitedValue(current: string, nextValue: string) {
  const normalized = nextValue.trim().replace(/^[@#]/, "");
  if (!normalized) return current;

  const existing = current
    .split(/[\n,]+/)
    .map((value) => value.trim().replace(/^[@#]/, ""))
    .filter(Boolean);

  if (existing.some((value) => value.toLowerCase() === normalized.toLowerCase())) {
    return current;
  }

  return [...existing, normalized].join(", ");
}

function parsePositiveInteger(value: string) {
  if (!value.trim()) {
    return { value: null, error: "Creator discovery limit is required." };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return {
      value: null,
      error: "Creator discovery limit must be a positive integer.",
    };
  }

  return { value: parsed, error: null };
}

export default function CreatorsPage() {
  const router = useRouter();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [minViews, setMinViews] = useState("");
  const [maxViews, setMaxViews] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<CreatorFacets>(EMPTY_FACETS);

  // Add-to-campaign modal state
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(
    null
  );
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [addingToCampaign, setAddingToCampaign] = useState(false);

  // Search Creators modal state
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchMode, setSearchMode] = useState<"hashtag" | "profile">(
    "hashtag"
  );
  const [searchHashtag, setSearchHashtag] = useState("");
  const [searchUsernames, setSearchUsernames] = useState("");
  const [searchLimit, setSearchLimit] = useState("50");
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(
    new Set()
  );
  const [importing, setImporting] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCreators = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (minFollowers) params.set("minFollowers", minFollowers);
    if (maxFollowers) params.set("maxFollowers", maxFollowers);
    if (minViews) params.set("minViews", minViews);
    if (maxViews) params.set("maxViews", maxViews);
    if (category) params.set("category", category);
    if (source) params.set("source", source);
    params.set("page", page.toString());
    params.set("limit", "50");
    params.set("includeFacets", "1");

    try {
      const res = await fetch(`/api/creators?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCreators(data.creators);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
        setFacets(data.facets ?? EMPTY_FACETS);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [
    search,
    minFollowers,
    maxFollowers,
    minViews,
    maxViews,
    category,
    source,
    page,
  ]);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  // Cleanup poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function fetchCampaigns() {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(
          (Array.isArray(data) ? data : data.campaigns ?? []).map(
            (c: { id: string; name: string }) => ({
              id: c.id,
              name: c.name,
            })
          )
        );
      }
    } catch {
      // ignore
    }
  }

  function handleAddToCampaign(creatorId: string) {
    setSelectedCreatorId(creatorId);
    setSelectedCampaignId("");
    setShowCampaignModal(true);
    fetchCampaigns();
  }

  async function confirmAddToCampaign() {
    if (!selectedCreatorId || !selectedCampaignId) return;

    setAddingToCampaign(true);
    try {
      const res = await fetch(
        `/api/campaigns/${selectedCampaignId}/creators`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorId: selectedCreatorId }),
        }
      );

      if (res.ok) {
        setShowCampaignModal(false);
        fetchCreators();
      } else if (res.status === 409) {
        alert("Creator is already in this campaign");
      }
    } catch {
      alert("Failed to add creator to campaign");
    } finally {
      setAddingToCampaign(false);
    }
  }

  // ── Search Creators Logic ──

  async function startSearch() {
    const limitState = parsePositiveInteger(searchLimit);
    if (limitState.error) {
      alert(limitState.error);
      return;
    }

    setSearching(true);
    setSearchResults([]);
    setSelectedResults(new Set());
    setSearchStatus("pending");

    try {
      const body: Record<string, unknown> = {
        searchMode,
        platform: "instagram",
        limit: limitState.value,
      };

      if (searchMode === "hashtag") {
        body.hashtag = searchHashtag;
      } else {
        body.usernames = searchUsernames
          .split(/[\n,]+/)
          .map((u) => u.trim())
          .filter(Boolean);
      }

      const res = await fetch("/api/creators/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to start search");
        setSearching(false);
        setSearchStatus(null);
        return;
      }

      const data = await res.json();
      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(
            `/api/creators/search/${data.jobId}`
          );
          if (!pollRes.ok) return;

          const pollData = await pollRes.json();
          setSearchStatus(pollData.status);

          if (
            pollData.status === "completed" ||
            pollData.status === "failed"
          ) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setSearching(false);

            if (pollData.status === "completed") {
              setSearchResults(pollData.results || []);
            } else {
              alert(`Search failed: ${pollData.error || "Unknown error"}`);
            }
          }
        } catch {
          // ignore poll errors
        }
      }, 3000);
    } catch {
      alert("Failed to start search");
      setSearching(false);
      setSearchStatus(null);
    }
  }

  function toggleResultSelection(resultId: string) {
    setSelectedResults((prev) => {
      const next = new Set(prev);
      if (next.has(resultId)) {
        next.delete(resultId);
      } else {
        next.add(resultId);
      }
      return next;
    });
  }

  function toggleAllResults() {
    if (selectedResults.size === searchResults.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(searchResults.map((r) => r.id)));
    }
  }

  async function importSelected() {
    if (selectedResults.size === 0) return;

    setImporting(true);
    try {
      const selected = searchResults.filter((r) => selectedResults.has(r.id));
      const rows = selected.map((r) => ({
        username: r.handle,
        name: r.name,
        bio: r.bio,
        followerCount: r.followerCount,
        bioCategory: r.bioCategory,
        imageUrl: r.imageUrl,
        profileUrl: r.profileUrl,
        engagementRate: r.engagementRate,
        discoverySource: "apify",
      }));

      const res = await fetch("/api/creators/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(
          `Imported: ${data.created} new, ${data.updated} updated, ${data.skipped} skipped`
        );
        setShowSearchModal(false);
        resetSearchState();
        fetchCreators();
      } else {
        alert("Failed to import creators");
      }
    } catch {
      alert("Failed to import creators");
    } finally {
      setImporting(false);
    }
  }

  function resetSearchState() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setSearchStatus(null);
    setSearchResults([]);
    setSelectedResults(new Set());
    setSearching(false);
    setSearchHashtag("");
    setSearchUsernames("");
    setSearchLimit("50");
    setSearchMode("hashtag");
  }

  const hashtagSuggestions = useMemo(
    () => facets.hashtags.slice(0, 12),
    [facets.hashtags]
  );

  const keywordSuggestions = useMemo(
    () => facets.keywords.slice(0, 16),
    [facets.keywords]
  );

  const usernameSuggestions = useMemo(
    () => facets.usernames.slice(0, 18),
    [facets.usernames]
  );
  const searchLimitValidation = useMemo(
    () => parsePositiveInteger(searchLimit),
    [searchLimit]
  );
  const searchLimitWarning =
    searchLimitValidation.value && searchLimitValidation.value > 100
      ? "Values above 100 are allowed, but expect heavier daily discovery volume."
      : null;

  function addHashtagSuggestion(value: string) {
    setSearchHashtag(value.replace(/^#/, ""));
  }

  function addUsernameSuggestion(value: string) {
    setSearchUsernames((current) => appendDelimitedValue(current, value));
  }

  const sourceOptions = [
    { value: "", label: "All Sources" },
    { value: "phantombuster", label: "PhantomBuster" },
    { value: "apify", label: "Apify" },
    { value: "csv_import", label: "CSV Import" },
    { value: "manual", label: "Manual" },
    { value: "creator_marketplace", label: "Marketplace" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creators</h1>
          <p className="text-muted-foreground">
            Search, filter, and manage your creator database.
            {total > 0 && ` ${total} creators total.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              resetSearchState();
              setShowSearchModal(true);
            }}
          >
            🔍 Search Creators
          </Button>
          <Button onClick={() => router.push("/creators/import")}>
            Import CSV
          </Button>
          <Button
            variant="outline"
            disabled={enriching || creators.filter((c) => !c.email).length === 0}
            onClick={async () => {
              const withoutEmail = creators.filter((c) => !c.email);
              if (withoutEmail.length === 0) {
                alert("All visible creators already have emails.");
                return;
              }
              setEnriching(true);
              try {
                const res = await fetch("/api/creators/enrich", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    creatorIds: withoutEmail.map((c) => c.id),
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  alert(data.error || "Enrichment failed");
                } else {
                  alert(
                    `Enrichment complete: ${data.enriched} found, ${data.notFound} not found, ${data.alreadyHasEmail || 0} already had email, ${data.skipped} skipped`
                  );
                  fetchCreators();
                }
              } catch {
                alert("Enrichment request failed");
              } finally {
                setEnriching(false);
              }
            }}
          >
            {enriching ? "Enriching..." : `📧 Enrich Emails (${creators.filter((c) => !c.email).length})`}
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Search by handle or name…"
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
                {sourceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Creators Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? "Loading…" : `${total} Creators`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {creators.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No creators found. Try adjusting your filters or{" "}
              <button
                className="underline"
                onClick={() => router.push("/creators/import")}
              >
                import from CSV
              </button>
              .
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium">Handle</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 pr-4 font-medium">Followers</th>
                    <th className="pb-2 pr-4 font-medium">Avg Views</th>
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 pr-4 font-medium">Source</th>
                    <th className="pb-2 pr-4 font-medium">Campaigns</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((creator) => {
                    const instagramProfile = creator.profiles.find(
                      (profile) => profile.platform === "instagram"
                    );

                    return (
                      <tr key={creator.id} className="border-b">
                      <td className="py-2 pr-4">
                        <div>
                          <InstagramHandleLink
                            handle={creator.instagramHandle}
                            url={instagramProfile?.url}
                            className="font-mono text-xs text-blue-600 hover:underline"
                          />
                          {creator.name &&
                            creator.name !== creator.instagramHandle && (
                              <p className="text-xs text-muted-foreground">
                                {creator.instagramHandle ? (
                                  <InstagramHandleLink
                                    handle={creator.instagramHandle}
                                    url={instagramProfile?.url}
                                    className="hover:text-foreground hover:underline"
                                  >
                                    {creator.name}
                                  </InstagramHandleLink>
                                ) : (
                                  creator.name
                                )}
                              </p>
                            )}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {creator.email ? (
                          <span className="text-green-600">{creator.email}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {creator.followerCount?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {creator.avgViews?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {creator.bioCategory || "—"}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">
                          {creator.discoverySource}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {creator.campaignCreators.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {creator.campaignCreators.map((cc) => (
                              <Badge
                                key={cc.id}
                                variant="secondary"
                                className="text-xs"
                              >
                                {cc.campaign.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddToCampaign(creator.id)}
                        >
                          Add to Campaign
                        </Button>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add to Campaign Modal */}
      {showCampaignModal && (
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
                  <option value="">Select a campaign…</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCampaignModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmAddToCampaign}
                  disabled={!selectedCampaignId || addingToCampaign}
                >
                  {addingToCampaign ? "Adding…" : "Add"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Creators Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <Card className="w-full max-w-2xl mx-4">
            <CardHeader>
              <CardTitle>Search Creators</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Form — only shown before results */}
              {searchResults.length === 0 && !searching && (
                <>
                  {/* Search mode toggle */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={
                        searchMode === "hashtag" ? "default" : "outline"
                      }
                      onClick={() => setSearchMode("hashtag")}
                    >
                      By Hashtag
                    </Button>
                    <Button
                      size="sm"
                      variant={
                        searchMode === "profile" ? "default" : "outline"
                      }
                      onClick={() => setSearchMode("profile")}
                    >
                      By Username List
                    </Button>
                  </div>

                  {searchMode === "hashtag" ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                        Hashtag search looks for creators posting under a topic.
                        Use one of the saved tags below if you want a term that
                        already appears in your creator data.
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Hashtag</label>
                        <Input
                          placeholder="e.g. skincare, pilates, supplements"
                          value={searchHashtag}
                          onChange={(e) => setSearchHashtag(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Suggested hashtags
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {hashtagSuggestions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                              onClick={() => addHashtagSuggestion(option.value)}
                            >
                              {option.value} ({option.count})
                            </button>
                          ))}
                          {hashtagSuggestions.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              No saved hashtag suggestions yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                        Username list search checks exact Instagram handles.
                        Paste handles separated by commas or new lines, or click
                        a saved handle below to avoid typos.
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Usernames
                        </label>
                        <textarea
                          className="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm"
                          placeholder={"creatorone, creatortwo\ncreatorthree"}
                          value={searchUsernames}
                          onChange={(e) => setSearchUsernames(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Saved usernames
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {usernameSuggestions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                              onClick={() => addUsernameSuggestion(option.value)}
                            >
                              @{option.value}
                            </button>
                          ))}
                          {usernameSuggestions.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              No saved usernames yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Popular keywords from your database
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {keywordSuggestions.map((option) => (
                        <Badge key={option.value} variant="outline" className="text-xs">
                          {option.value} ({option.count})
                        </Badge>
                      ))}
                      {keywordSuggestions.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No keyword guidance yet.
                        </p>
                      )}
                    </div>
                  </div>

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

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Platform</label>
                    <div className="flex gap-2">
                      <Badge variant="default">Instagram</Badge>
                      <Badge variant="outline" className="opacity-50">
                        TikTok (coming soon)
                      </Badge>
                    </div>
                  </div>
                </>
              )}

              {/* Searching state */}
              {searching && (
                <div className="py-8 text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Searching creators via Apify…
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Status: {searchStatus || "starting"}
                  </p>
                </div>
              )}

              {/* Search Results */}
              {searchResults.length > 0 && !searching && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {searchResults.length} creators found
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={toggleAllResults}
                    >
                      {selectedResults.size === searchResults.length
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
                                selectedResults.size ===
                                  searchResults.length &&
                                searchResults.length > 0
                              }
                              onChange={toggleAllResults}
                            />
                          </th>
                          <th className="p-2 font-medium">Creator</th>
                          <th className="p-2 font-medium">Followers</th>
                          <th className="p-2 font-medium">Engagement</th>
                          <th className="p-2 font-medium">Bio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((result) => (
                          <tr
                            key={result.id}
                            className="border-b hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleResultSelection(result.id)}
                          >
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={selectedResults.has(result.id)}
                                onChange={() =>
                                  toggleResultSelection(result.id)
                                }
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
                            <td className="p-2 text-xs">
                              {result.followerCount?.toLocaleString() ?? "—"}
                            </td>
                            <td className="p-2 text-xs">
                              {result.engagementRate
                                ? `${(result.engagementRate * 100).toFixed(1)}%`
                                : "—"}
                            </td>
                            <td className="p-2 text-xs max-w-[200px] truncate">
                              {result.bio || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSearchModal(false);
                    resetSearchState();
                  }}
                >
                  {searchResults.length > 0 ? "Close" : "Cancel"}
                </Button>

                {searchResults.length === 0 && !searching && (
                  <Button
                    onClick={startSearch}
                    disabled={
                      (searchMode === "hashtag" && !searchHashtag.trim()) ||
                      (searchMode === "profile" &&
                        !searchUsernames.trim()) ||
                      Boolean(searchLimitValidation.error)
                    }
                  >
                    Search
                  </Button>
                )}

                {searchResults.length > 0 && !searching && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchResults([]);
                        setSelectedResults(new Set());
                        setSearchStatus(null);
                      }}
                    >
                      New Search
                    </Button>
                    <Button
                      onClick={importSelected}
                      disabled={selectedResults.size === 0 || importing}
                    >
                      {importing
                        ? "Importing…"
                        : `Import Selected (${selectedResults.size})`}
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
