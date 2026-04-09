"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CreatorFacets } from "@/lib/creators/facets";
import { isCanonicalDiscoveryCategory } from "@/lib/categories/catalog";

export type CreatorProfile = {
  platform: string;
  handle: string;
  url: string | null;
  followerCount: number | null;
};

export type CampaignCreatorLink = {
  id: string;
  campaignId: string;
  reviewStatus: string;
  campaign: { id: string; name: string };
};

export type Creator = {
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

export type CampaignOption = {
  id: string;
  name: string;
};

export type CategoryGroups = {
  apify: string[];
  collabstr: string[];
};

export type SearchResult = {
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

export type SearchJobSummary = {
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

export type SearchSourceKey =
  | "collabstr"
  | "apify_search"
  | "approved_seed_following"
  | "apify_keyword_email";

const EMPTY_FACETS: CreatorFacets = {
  categories: [],
  keywords: [],
  hashtags: [],
  usernames: [],
  locations: [],
};

const EMPTY_CATEGORY_GROUPS: CategoryGroups = {
  apify: [],
  collabstr: [],
};

const DEFAULT_SEARCH_SOURCES: Record<SearchSourceKey, boolean> = {
  collabstr: true,
  apify_search: true,
  approved_seed_following: false,
  apify_keyword_email: false,
};

export function parsePositiveInteger(value: string) {
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

export function useCreatorsState() {
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
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [searchUsernames, setSearchUsernames] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [searchMinFollowers, setSearchMinFollowers] = useState("");
  const [searchMaxFollowers, setSearchMaxFollowers] = useState("");
  const [searchLimit, setSearchLimit] = useState("50");
  const [searchSources, setSearchSources] =
    useState<Record<SearchSourceKey, boolean>>(DEFAULT_SEARCH_SOURCES);
  const [brandKeywords, setBrandKeywords] = useState<string[]>([]);
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

  // Approval settings
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

        const data = (await response.json()) as CategoryGroups & { brandKeywords?: string[] };
        if (!ignore) {
          setSearchCategoryGroups({ apify: data.apify, collabstr: data.collabstr });
          setBrandKeywords(data.brandKeywords ?? []);
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
      .map(([src]) => src);

    if (selectedSources.length === 0) {
      alert("Select at least one discovery source.");
      return;
    }

    const canonicalCategories = selectedKeywords.filter(isCanonicalDiscoveryCategory);
    const keywordList = selectedKeywords.filter((k) => !isCanonicalDiscoveryCategory(k));
    const usernames = searchUsernames
      .split(/[\n,]+/)
      .map((u) => u.trim().replace(/^@/, ""))
      .filter(Boolean);

    if (
      selectedKeywords.length === 0 &&
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
        canonicalCategories,
        platform: "instagram",
        limit: limitState.value,
        filters: {
          ...(searchMinFollowers.trim()
            ? { minFollowers: Number(searchMinFollowers) }
            : {}),
          ...(searchMaxFollowers.trim()
            ? { maxFollowers: Number(searchMaxFollowers) }
            : {}),
          requireCategory: canonicalCategories.length > 0,
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

  function clearSearchResults() {
    setSearchResults([]);
    setSelectedResults(new Set());
    setSearchStatus(null);
  }

  function resetSearchState() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
    setSearchStatus(null);
    setActiveSearchJob(null);
    setSearchResults([]);
    setSelectedResults(new Set());
    setSearching(false);
    setSelectedKeywords([]);
    setSearchUsernames("");
    setSearchLocation("");
    setSearchMinFollowers("");
    setSearchMaxFollowers("");
    setSearchLimit("50");
    setSearchSources(DEFAULT_SEARCH_SOURCES);
  }

  const keywordGroups = useMemo(() => {
    const groups: { label: string; keywords: string[] }[] = [];
    if (brandKeywords.length > 0) {
      groups.push({ label: "Brand Keywords", keywords: brandKeywords });
    }
    if (facets.keywords.length > 0) {
      groups.push({
        label: "From Creators",
        keywords: facets.keywords.map((f) => f.value),
      });
    }
    const catalog = Array.from(
      new Set([...searchCategoryGroups.apify, ...searchCategoryGroups.collabstr])
    ).sort();
    if (catalog.length > 0) {
      groups.push({ label: "Categories", keywords: catalog });
    }
    return groups;
  }, [brandKeywords, facets.keywords, searchCategoryGroups]);

  const locationSuggestions = useMemo(
    () => facets.locations,
    [facets.locations]
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

  return {
    // List state
    creators,
    loading,
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
    page,
    setPage,
    totalPages,
    total,
    facets,
    fetchCreators,

    // Campaign modal
    showCampaignModal,
    setShowCampaignModal,
    selectedCreatorId,
    campaigns,
    selectedCampaignId,
    setSelectedCampaignId,
    addingToCampaign,
    handleAddToCampaign,
    confirmAddToCampaign,

    // Search modal
    showSearchModal,
    setShowSearchModal,
    selectedKeywords,
    setSelectedKeywords,
    searchUsernames,
    setSearchUsernames,
    searchLocation,
    setSearchLocation,
    searchMinFollowers,
    setSearchMinFollowers,
    searchMaxFollowers,
    setSearchMaxFollowers,
    searchLimit,
    setSearchLimit,
    searchSources,
    setSearchSources,
    searchCategoriesLoading,
    searching,
    searchStatus,
    activeSearchJob,
    searchResults,
    selectedResults,
    importing,
    enriching,
    setEnriching,
    discoveryApprovalMode,
    discoveryApprovalThreshold,

    // Search actions
    startSearch,
    toggleResultSelection,
    toggleAllResults,
    importSelected,
    resetSearchState,
    clearSearchResults,

    // Derived
    keywordGroups,
    locationSuggestions,
    usernameSuggestions,
    searchLimitValidation,
    searchLimitWarning,
  };
}
