"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    return { value: null, error: "Enter how many creators to look for." };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return {
      value: null,
      error: "Enter a whole number, like 20.",
    };
  }

  return { value: parsed, error: null };
}

const JOB_STATUS_LABELS: Record<string, string> = {
  pending: "Starting",
  queued: "Starting",
  running: "Searching",
  completed: "Done",
  completed_with_shortfall: "Done, fewer than asked",
  failed: "Didn't finish",
};

function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABELS[status] ?? "Working";
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
      ? "More than 100 works, but the search takes longer and uses more credits."
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
    const stop = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      setLoading(false);
    };
    const response = await fetch(
      `/api/campaigns/${params.campaignId}/search/${jobId}`
    );
    if (!response.ok) {
      if (response.status === 404) {
        stop();
        setError("We lost track of this search. Start it again.");
      }
      return;
    }

    const payload = (await response.json()) as SearchJob;
    setJob(payload);

    if (
      payload.status === "completed" ||
      payload.status === "completed_with_shortfall" ||
      payload.status === "failed"
    ) {
      stop();
    }
  }

  async function handleSearch() {
    if (parsedLimit.error) {
      setError(parsedLimit.error);
      return;
    }

    if (selectedSourceList.length === 0) {
      setError("Pick at least one place to search.");
      return;
    }

    const keywordList = [...selectedKeywordOptions, ...selectedCategories.collabstr];

    if (
      keywordList.length === 0 &&
      selectedCategories.apify.length === 0
    ) {
      setError("Add a keyword or pick at least one topic.");
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
        setError((data as { error: string }).error ?? "The search didn't start. Try again.");
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
      setError("The search didn't start. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Find creators</h1>
        <p className="mt-1 text-muted-foreground">
          Search for creators who fit this campaign. The search runs in the background, and
          matches wait for your review when it finishes.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What to look for</CardTitle>
          <CardDescription>
            Collabstr and Instagram search are usually enough. Turn on the other two only when
            you need more creators.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Where to search</p>
            <div className="flex flex-wrap gap-2">
              {([
                ["collabstr", "Collabstr"],
                ["apify_search", "Instagram search"],
                ["approved_seed_following", "Who your approved creators follow"],
                ["apify_keyword_email", "Keyword search with emails"],
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
              <label className="text-sm font-medium">Fewest followers</label>
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
              <label className="text-sm font-medium">Most followers</label>
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
              <label className="text-sm font-medium">How many creators</label>
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
            <p className="text-sm font-medium">Topics</p>
            {categoriesLoading ? (
              <p className="text-sm text-muted-foreground">
                Loading topics…
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
              {loading ? "Searching…" : "Start search"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p role="alert" className="text-sm text-red-700">{error}</p>
            {/apify/i.test(error) ? (
              <Link
                href="/settings/creator-search"
                className="mt-2 inline-block text-sm font-medium text-red-900 underline underline-offset-2"
              >
                Open Settings &gt; Creator search
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {job ? (
        <section aria-labelledby="search-heading" className="space-y-3 rounded-xl border bg-card p-5">
          <h2 id="search-heading" className="text-lg font-semibold">
            Search: {jobStatusLabel(job.status)}
          </h2>

          <div
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={job.progressPercent ?? 0}
            aria-label="Search progress"
          >
            <div
              className="h-full bg-foreground/70 transition-all"
              style={{ width: `${job.progressPercent ?? 0}%` }}
            />
          </div>

          <p>
            {typeof job.progressPercent === "number" ? `${job.progressPercent}% done. ` : ""}
            {job.requestedCount != null ? `Looking for ${job.requestedCount}. ` : ""}
            Checked {job.validatedCount ?? 0}, skipped {job.invalidCount ?? 0},{" "}
            {job.resultCount ?? 0} ready to review.
            {typeof job.etaSeconds === "number" && job.etaSeconds > 0
              ? ` About ${job.etaSeconds < 60 ? "a minute" : `${Math.ceil(job.etaSeconds / 60)} minutes`} left.`
              : ""}
          </p>

          {job.error ? (
            <p role="alert" className="text-sm text-red-700">{job.error}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => router.push(`/campaigns/${params.campaignId}/review`)}>
              Review creators
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/campaigns/${params.campaignId}/seed-list`)}
            >
              See suggested mix
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
