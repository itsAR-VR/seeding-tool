"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  GroupedCategoryPicker,
  type CategoryGroups,
  type CategorySelection,
} from "@/components/grouped-category-picker";
import { FacetSelector } from "@/components/facet-selector";
import type { CreatorFacets } from "@/lib/creators/facets";

type SearchJob = {
  jobId: string;
  status: string;
  requestedCount?: number;
  validatedCount?: number;
  invalidCount?: number;
  cachedCount?: number;
  resultCount?: number;
  progressPercent?: number;
  etaSeconds?: number | null;
  error?: string | null;
};

type SearchFilters = {
  minFollowers: string;
  maxFollowers: string;
  limit: string;
};

type SearchSourceKey =
  | "collabstr"
  | "apify_search"
  | "approved_seed_following"
  | "apify_keyword_email";

const EMPTY_CATEGORIES: CategoryGroups = {
  apify: [],
  collabstr: [],
};

const EMPTY_SELECTION: CategorySelection = {
  apify: [],
  collabstr: [],
};

const EMPTY_FACETS: CreatorFacets = {
  categories: [],
  keywords: [],
  hashtags: [],
  usernames: [],
  locations: [],
};

const DEFAULT_SOURCES: Record<SearchSourceKey, boolean> = {
  collabstr: true,
  apify_search: true,
  approved_seed_following: false,
  apify_keyword_email: false,
};

function parsePositiveInteger(value: string) {
  if (!value.trim()) {
    return { value: null, error: "Creator limit is required." };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return {
      value: null,
      error: "Creator limit must be a positive integer.",
    };
  }

  return { value: parsed, error: null };
}

export default function DiscoverCreatorsPage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const [filters, setFilters] = useState<SearchFilters>({
    minFollowers: "",
    maxFollowers: "",
    limit: "20",
  });
  const [facets, setFacets] = useState<CreatorFacets>(EMPTY_FACETS);
  const [facetLoading, setFacetLoading] = useState(true);
  const [selectedKeywordOptions, setSelectedKeywordOptions] = useState<string[]>(
    []
  );
  const [selectedLocationOptions, setSelectedLocationOptions] = useState<
    string[]
  >([]);
  const [categories, setCategories] = useState<CategoryGroups>(EMPTY_CATEGORIES);
  const [selectedCategories, setSelectedCategories] =
    useState<CategorySelection>(EMPTY_SELECTION);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [sources, setSources] =
    useState<Record<SearchSourceKey, boolean>>(DEFAULT_SOURCES);
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<SearchJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSourceList = useMemo(
    () =>
      (Object.entries(sources) as Array<[SearchSourceKey, boolean]>)
        .filter(([, enabled]) => enabled)
        .map(([source]) => source),
    [sources]
  );

  const parsedLimit = useMemo(
    () => parsePositiveInteger(filters.limit),
    [filters.limit]
  );

  const limitWarning =
    parsedLimit.value && parsedLimit.value > 100
      ? "Values above 100 are allowed, but they increase search volume."
      : null;

  useEffect(() => {
    let ignore = false;

    async function fetchCategories() {
      setCategoriesLoading(true);
      setFacetLoading(true);
      try {
        const [categoryResponse, facetResponse] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/creators/facets"),
        ]);
        if (ignore) return;

        if (categoryResponse.ok) {
          const data = (await categoryResponse.json()) as CategoryGroups;
          setCategories(data);
        }

        if (facetResponse.ok) {
          const facetData = (await facetResponse.json()) as CreatorFacets;
          setFacets(facetData);
        }
      } catch {
        // ignore
      } finally {
        if (!ignore) {
          setCategoriesLoading(false);
          setFacetLoading(false);
        }
      }
    }

    fetchCategories();

    return () => {
      ignore = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function handleFilterChange(key: keyof SearchFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSource(source: SearchSourceKey) {
    setSources((current) => ({
      ...current,
      [source]: !current[source],
    }));
  }

  async function pollJob(jobId: string) {
    const response = await fetch(
      `/api/campaigns/${params.campaignId}/search/${jobId}`
    );
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as SearchJob;
    setJob(payload);

    if (
      payload.status === "completed" ||
      payload.status === "completed_with_shortfall" ||
      payload.status === "failed"
    ) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (parsedLimit.error) {
      setError(parsedLimit.error);
      return;
    }

    if (selectedSourceList.length === 0) {
      setError("Select at least one discovery source.");
      return;
    }

    const keywordList = [...selectedKeywordOptions, ...selectedCategories.collabstr];

    if (
      keywordList.length === 0 &&
      selectedCategories.apify.length === 0
    ) {
      setError("Add keywords or choose at least one category.");
      return;
    }

    setLoading(true);
    setError(null);
    setJob(null);

    try {
      const body = {
        sources: selectedSourceList,
        keywords: keywordList,
        canonicalCategories: selectedCategories.apify,
        platform: "instagram",
        limit: parsedLimit.value,
        ...(selectedLocationOptions[0]
          ? { location: selectedLocationOptions[0] }
          : {}),
        filters: {
          ...(filters.minFollowers.trim()
            ? { minFollowers: Number(filters.minFollowers) }
            : {}),
          ...(filters.maxFollowers.trim()
            ? { maxFollowers: Number(filters.maxFollowers) }
            : {}),
          requireCategory: selectedCategories.apify.length > 0,
          excludeExistingCreators: true,
        },
        emailPrefetch: sources.apify_keyword_email,
        seedExpansion: {
          enabled: sources.approved_seed_following,
          maxSeedsPerRun: 5,
          maxFollowingPerSeed: 100,
        },
      };

      const response = await fetch(
        `/api/campaigns/${params.campaignId}/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const data = (await response.json()) as SearchJob | { error: string };
      if (!response.ok) {
        setError((data as { error: string }).error ?? "Search failed");
        setLoading(false);
        return;
      }

      const queuedJob = data as SearchJob;
      setJob(queuedJob);

      pollRef.current = setInterval(() => {
        void pollJob(queuedJob.jobId);
      }, 3000);

      void pollJob(queuedJob.jobId);
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Discover Creators
          </h1>
          <p className="text-muted-foreground">
            Run one background discovery job across Collabstr, Apify search,
            and optional graph expansion. Matching creators land in your review
            queue when the job finishes.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/campaigns/${params.campaignId}`)}
        >
          ← Back to Campaign
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Discovery Query</CardTitle>
          <CardDescription>
            Default sources are Collabstr + Apify search. Add approved-seed
            following or keyword-email enrichment only when you need broader
            recall.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Sources</p>
            <div className="flex flex-wrap gap-2">
              {([
                ["collabstr", "Collabstr"],
                ["apify_search", "Apify Search"],
                ["approved_seed_following", "Approved Seed Following"],
                ["apify_keyword_email", "Keyword Email"],
              ] as Array<[SearchSourceKey, string]>).map(([source, label]) => (
                <Button
                  key={source}
                  type="button"
                  size="sm"
                  variant={sources[source] ? "default" : "outline"}
                  onClick={() => toggleSource(source)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FacetSelector
              label="Keywords"
              options={facets.keywords}
              selected={selectedKeywordOptions}
              onChange={setSelectedKeywordOptions}
              placeholder="Choose keywords"
              searchPlaceholder="Filter keywords"
              emptyText="No saved keywords yet."
            />
            <FacetSelector
              label="Location"
              options={facets.locations}
              selected={selectedLocationOptions}
              onChange={setSelectedLocationOptions}
              placeholder="Choose location"
              searchPlaceholder="Filter locations"
              emptyText="No saved locations yet."
              multiple={false}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Min followers</label>
              <Input
                type="number"
                min={0}
                value={filters.minFollowers}
                onChange={(event) =>
                  handleFilterChange("minFollowers", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Max followers</label>
              <Input
                type="number"
                min={0}
                value={filters.maxFollowers}
                onChange={(event) =>
                  handleFilterChange("maxFollowers", event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Creator limit</label>
              <Input
                type="number"
                min={1}
                step={1}
                value={filters.limit}
                onChange={(event) =>
                  handleFilterChange("limit", event.target.value)
                }
              />
              {parsedLimit.error ? (
                <p className="text-sm text-destructive">
                  {parsedLimit.error}
                </p>
              ) : limitWarning ? (
                <p className="text-sm text-amber-700">{limitWarning}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Discovery keywords</label>
            {categoriesLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading category sources…
              </p>
            ) : (
              <GroupedCategoryPicker
                categories={categories}
                selected={selectedCategories}
                onChange={setSelectedCategories}
              />
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSearch}
              disabled={loading || categoriesLoading || facetLoading}
              className="min-w-[160px]"
            >
              {loading ? "Running…" : "Run Discovery"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {job ? (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-base text-green-900">
              Discovery Job
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                <p className="text-xs text-muted-foreground">Job</p>
                <p className="truncate text-xs font-mono">{job.jobId}</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-semibold">{job.status}</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                <p className="text-xs text-muted-foreground">Requested</p>
                <p className="text-sm font-semibold">
                  {job.requestedCount ?? "—"}
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                <p className="text-xs text-muted-foreground">Ready</p>
                <p className="text-sm font-semibold">
                  {job.resultCount ?? 0}
                </p>
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full bg-blue-700 transition-all"
                style={{ width: `${job.progressPercent ?? 0}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800">
                Background search
              </Badge>
              {typeof job.progressPercent === "number" ? (
                <Badge variant="outline">{job.progressPercent}%</Badge>
              ) : null}
              {typeof job.etaSeconds === "number" ? (
                <Badge variant="outline">ETA {job.etaSeconds}s</Badge>
              ) : null}
            </div>

            <div className="grid gap-2 text-xs text-green-900 sm:grid-cols-3 lg:grid-cols-6">
              <span>Validated: {job.validatedCount ?? 0}</span>
              <span>Invalid: {job.invalidCount ?? 0}</span>
              <span>Cached: {job.cachedCount ?? 0}</span>
              <span>Requested: {job.requestedCount ?? "—"}</span>
              <span>Ready: {job.resultCount ?? 0}</span>
              <span>Status: {job.status}</span>
            </div>

            {job.error ? (
              <p className="text-xs text-red-700">{job.error}</p>
            ) : null}

            <div className="flex justify-end">
              <Button
                onClick={() =>
                  router.push(`/campaigns/${params.campaignId}/review`)
                }
              >
                Open Review Queue →
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
