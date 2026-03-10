"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InstagramHandleLink } from "@/components/instagram-handle-link";
import {
  GroupedCategoryPicker,
  type CategoryGroups,
  type CategorySelection,
} from "@/components/grouped-category-picker";

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
  source?: string;
  primarySource?: string;
  sources?: string[];
  name: string | null;
  email?: string | null;
  followerCount: number | null;
  avgViews?: number | null;
  engagementRate: number | null;
  profileUrl: string | null;
  imageUrl: string | null;
  bio: string | null;
  bioCategory: string | null;
  rawSourceCategory?: string | null;
  platform: string;
  validationStatus?: string;
  validationError?: string | null;
};

type SearchJobSummary = {
  jobId: string;
  status: string;
  requestedCount?: number;
  candidateCount?: number;
  validatedCount?: number;
  invalidCount?: number;
  cachedCount?: number;
  progressPercent?: number;
  etaSeconds?: number | null;
  resultCount?: number;
  error?: string | null;
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

const EMPTY_CATEGORY_GROUPS: CategoryGroups = {
  apify: [],
  collabstr: [],
};

const EMPTY_CATEGORY_SELECTION: CategorySelection = {
  apify: [],
  collabstr: [],
};

type SearchSourceKey =
  | "collabstr"
  | "apify_search"
  | "approved_seed_following"
  | "apify_keyword_email";

const DEFAULT_SEARCH_SOURCES: Record<SearchSourceKey, boolean> = {
  collabstr: true,
  apify_search: true,
  approved_seed_following: false,
  apify_keyword_email: false,
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
  const [searchKeywords, setSearchKeywords] = useState("");
  const [searchUsernames, setSearchUsernames] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchMinFollowers, setSearchMinFollowers] = useState("");
  const [searchMaxFollowers, setSearchMaxFollowers] = useState("");
  const [searchLimit, setSearchLimit] = useState("50");
  const [searchSources, setSearchSources] =
    useState<Record<SearchSourceKey, boolean>>(DEFAULT_SEARCH_SOURCES);
  const [searchCategories, setSearchCategories] =
    useState<CategorySelection>(EMPTY_CATEGORY_SELECTION);
  const [searchCategoryGroups, setSearchCategoryGroups] =
    useState<CategoryGroups>(EMPTY_CATEGORY_GROUPS);
  const [searchCategoriesLoading, setSearchCategoriesLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [activeSearchJob, setActiveSearchJob] =
    useState<SearchJobSummary | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(
    new Set()
  );
  const [importing, setImporting] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Approval settings — shown in search modal for operator context
  const [discoveryApprovalMode, setDiscoveryApprovalMode] = useState<"recommend" | "auto">("recommend");
  const [discoveryApprovalThreshold, setDiscoveryApprovalThreshold] = useState(0.75);
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
    // Fetch approval settings for display in the search modal
    fetch("/api/settings/approval")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { approvalMode?: "recommend" | "auto"; approvalThreshold?: number } | null) => {
        if (data) {
          setDiscoveryApprovalMode(data.approvalMode ?? "recommend");
          setDiscoveryApprovalThreshold(data.approvalThreshold ?? 0.75);
        }
      })
      .catch(() => {/* non-fatal */});
  }, [fetchCreators]);

  // Cleanup poll interval on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showSearchModal) return;

    let ignore = false;

    async function fetchSearchCategories() {
      setSearchCategoriesLoading(true);
      try {
        const response = await fetch("/api/categories");
        if (!response.ok) return;

        const data = (await response.json()) as CategoryGroups;
        if (!ignore) {
          setSearchCategoryGroups(data);
        }
      } catch {
        // ignore
      } finally {
        if (!ignore) {
          setSearchCategoriesLoading(false);
        }
      }
    }

    fetchSearchCategories();

    return () => {
      ignore = true;
    };
  }, [showSearchModal]);

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

  async function pollCreatorSearchJob(jobId: string) {
    try {
      const pollRes = await fetch(`/api/creators/search/${jobId}`);
      if (!pollRes.ok) return;

      const pollData = (await pollRes.json()) as SearchJobSummary & {
        results?: SearchResult[];
      };
      setSearchStatus(pollData.status);
      setActiveSearchJob(pollData);

      if (
        pollData.status === "completed" ||
        pollData.status === "completed_with_shortfall" ||
        pollData.status === "failed"
      ) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setSearching(false);

        if (
          pollData.status === "completed" ||
          pollData.status === "completed_with_shortfall"
        ) {
          setSearchResults(pollData.results || []);
        }
      }
    } catch {
      // ignore
    }
  }

  async function startSearch() {
    const limitState = parsePositiveInteger(searchLimit);
    if (limitState.error) {
      alert(limitState.error);
      return;
    }

    const selectedSources = (
      Object.entries(searchSources) as Array<[SearchSourceKey, boolean]>
    )
      .filter(([, enabled]) => enabled)
      .map(([source]) => source);

    if (selectedSources.length === 0) {
      alert("Select at least one discovery source.");
      return;
    }

    const keywordList = [
      ...searchKeywords
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      ...searchCategories.collabstr,
    ];
    const usernames = searchUsernames
      .split(/[\n,]+/)
      .map((u) => u.trim().replace(/^@/, ""))
      .filter(Boolean);

    if (
      keywordList.length === 0 &&
      searchCategories.apify.length === 0 &&
      usernames.length === 0
    ) {
      alert("Add keywords, categories, or exact usernames before searching.");
      return;
    }

    setSearching(true);
    setSearchResults([]);
    setSelectedResults(new Set());
    setSearchStatus("pending");

    try {
      const body: Record<string, unknown> = {
        sources: selectedSources,
        keywords: keywordList,
        canonicalCategories: searchCategories.apify,
        platform: "instagram",
        limit: limitState.value,
        filters: {
          ...(searchMinFollowers.trim()
            ? { minFollowers: Number(searchMinFollowers) }
            : {}),
          ...(searchMaxFollowers.trim()
            ? { maxFollowers: Number(searchMaxFollowers) }
            : {}),
          requireCategory: searchCategories.apify.length > 0,
          excludeExistingCreators: false,
        },
        emailPrefetch: searchSources.apify_keyword_email,
        seedExpansion: {
          enabled: searchSources.approved_seed_following,
          maxSeedsPerRun: 5,
          maxFollowingPerSeed: 100,
        },
      };
      if (searchLocation.trim()) body.location = searchLocation.trim();
      if (usernames.length > 0) body.usernames = usernames;

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
      const queuedJob = data as SearchJobSummary;
      setActiveSearchJob(queuedJob);
      setShowSearchModal(false);

      pollRef.current = setInterval(() => {
        void pollCreatorSearchJob(queuedJob.jobId);
      }, 3000);

      void pollCreatorSearchJob(queuedJob.jobId);
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
        searchResultId: r.id,
        username: r.handle,
        name: r.name,
        email: r.email,
        bio: r.bio,
        followerCount: r.followerCount,
        bioCategory: r.bioCategory,
        rawSourceCategory: r.rawSourceCategory,
        imageUrl: r.imageUrl,
        profileUrl: r.profileUrl,
        engagementRate: r.engagementRate,
        discoverySource: r.primarySource || r.source || "manual",
      }));

      const res = await fetch("/api/creators/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(
          `Imported: ${data.validImported} valid, ${data.created} new, ${data.updated} updated, ${data.invalidDropped} invalid dropped, ${data.skipped} skipped`
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
    setActiveSearchJob(null);
    setSearchResults([]);
    setSelectedResults(new Set());
    setSearching(false);
    setSearchKeywords("");
    setSearchUsernames("");
    setSearchLocation("");
    setSearchMinFollowers("");
    setSearchMaxFollowers("");
    setSearchLimit("50");
    setSearchSources(DEFAULT_SEARCH_SOURCES);
    setSearchCategories(EMPTY_CATEGORY_SELECTION);
  }

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

      {activeSearchJob ? (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Background creator search
                </p>
                <p className="text-xs text-blue-800">
                  Job {activeSearchJob.jobId} is running in the background. You
                  can keep using the platform while it completes.
                </p>
              </div>
              <div className="flex gap-2">
                {searchResults.length > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSearchModal(true)}
                  >
                    View Results
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={resetSearchState}>
                  Dismiss
                </Button>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full bg-blue-700 transition-all"
                style={{ width: `${activeSearchJob.progressPercent ?? 0}%` }}
              />
            </div>
            <div className="grid gap-2 text-xs text-blue-900 sm:grid-cols-3 lg:grid-cols-6">
              <span>Status: {activeSearchJob.status}</span>
              <span>Requested: {activeSearchJob.requestedCount ?? "—"}</span>
              <span>Ready: {activeSearchJob.resultCount ?? 0}</span>
              <span>Validated: {activeSearchJob.validatedCount ?? 0}</span>
              <span>Invalid: {activeSearchJob.invalidCount ?? 0}</span>
              <span>
                ETA:{" "}
                {typeof activeSearchJob.etaSeconds === "number"
                  ? `${activeSearchJob.etaSeconds}s`
                  : "—"}
              </span>
            </div>
            {activeSearchJob.error ? (
              <p className="text-xs text-red-700">{activeSearchJob.error}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
          <p className="text-xs text-muted-foreground">
            Avg Views means the average of the latest 12 reels/video posts when
            that enrichment has completed.
          </p>
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
              {/* Approval mode context — surfaces the setting operators need without leaving the modal */}
              <p className="text-xs text-muted-foreground mt-1">
                Discovered creators will use{" "}
                <span className={`font-medium ${discoveryApprovalMode === "recommend" ? "text-green-700" : "text-yellow-700"}`}>
                  {discoveryApprovalMode === "recommend" ? "Recommend" : "Auto"} mode
                </span>
                {" "}·{" "}
                <span className="font-medium">{(discoveryApprovalThreshold * 100).toFixed(0)}% threshold</span>
                {" · "}
                <a href="/settings/brand" className="underline hover:text-foreground">
                  Change in Brand Settings →
                </a>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search Form — only shown before results */}
              {searchResults.length === 0 && !searching && (
                <>
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Run one background discovery query across Collabstr,
                    Apify search, and optional approved-seed expansion. Add
                    exact usernames only when you want to validate specific
                    handles.
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
                        ([source, label]) => (
                          <Button
                            key={source}
                            type="button"
                            size="sm"
                            variant={searchSources[source] ? "default" : "outline"}
                            onClick={() =>
                              setSearchSources((current) => ({
                                ...current,
                                [source]: !current[source],
                              }))
                            }
                          >
                            {label}
                          </Button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Keywords</label>
                      <Input
                        placeholder="e.g. sleep, wellness, skincare"
                        value={searchKeywords}
                        onChange={(e) => setSearchKeywords(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Location</label>
                      <Input
                        placeholder="e.g. United States"
                        value={searchLocation}
                        onChange={(e) => setSearchLocation(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Exact usernames{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </label>
                      <textarea
                        className="min-h-[96px] w-full rounded-md border px-3 py-2 text-sm"
                        placeholder={"creatorone, creatortwo\ncreatorthree"}
                        value={searchUsernames}
                        onChange={(e) => setSearchUsernames(e.target.value)}
                      />
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
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Follower range
                        </label>
                        <div className="flex gap-2">
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

                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                          Popular keywords from your database
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {keywordSuggestions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                              onClick={() =>
                                setSearchKeywords((current) =>
                                  appendDelimitedValue(current, option.value)
                                )
                              }
                            >
                              {option.value} ({option.count})
                            </button>
                          ))}
                          {keywordSuggestions.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              No keyword guidance yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Categories</label>
                    {searchCategoriesLoading ? (
                      <p className="text-sm text-muted-foreground">
                        Loading category sources…
                      </p>
                    ) : (
                      <GroupedCategoryPicker
                        categories={searchCategoryGroups}
                        selected={searchCategories}
                        onChange={setSearchCategories}
                      />
                    )}
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
                    Running unified creator discovery…
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
                          <th className="p-2 font-medium">Sources</th>
                          <th className="p-2 font-medium">Followers</th>
                          <th className="p-2 font-medium">Avg Views</th>
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
                            <td className="p-2">
                              <div className="flex flex-wrap gap-1">
                                {(result.sources ?? [
                                  result.primarySource || result.source || "manual",
                                ]).map((source) => (
                                  <Badge
                                    key={`${result.id}-${source}`}
                                    variant="outline"
                                    className="text-[10px]"
                                  >
                                    {source}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="p-2 text-xs">
                              {result.followerCount?.toLocaleString() ?? "—"}
                            </td>
                            <td className="p-2 text-xs">
                              {result.avgViews?.toLocaleString() ?? "—"}
                            </td>
                            <td className="p-2 text-xs max-w-[200px] truncate">
                              {result.bio || result.bioCategory || "—"}
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
                      (
                        !searchKeywords.trim() &&
                        searchCategories.apify.length === 0 &&
                        searchCategories.collabstr.length === 0 &&
                        !searchUsernames.trim()
                      ) ||
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
