"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  UnifiedKeywordSelector,
  type KeywordGroup,
} from "@/components/unified-keyword-selector";
import { LocationInput } from "@/components/location-input";
import type { CategoryGroups } from "@/components/grouped-category-picker";
import type { CreatorFacets } from "@/lib/creators/facets";
import { isCanonicalDiscoveryCategory } from "@/lib/categories/catalog";

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

const SOURCE_OPTIONS: Array<[SearchSourceKey, string, string]> = [
  ["apify_search", "Instagram", "Search Instagram profiles for your words."],
  ["collabstr", "Collabstr marketplace", "Creators listed on the Collabstr marketplace."],
  ["approved_seed_following", "Who your approved creators follow", "Finds similar creators. Slower."],
  ["apify_keyword_email", "Instagram, emails first", "Only creators with a public email. Slower."],
];

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
  const [categories, setCategories] = useState<CategoryGroups>(EMPTY_CATEGORIES);
  const [brandKeywords, setBrandKeywords] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [pendingWords, setPendingWords] = useState("");
  const [location, setLocation] = useState("");
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
      ? "More than 100 works, but the search takes longer and uses more creator search credit."
      : null;

  const keywordGroups = useMemo<KeywordGroup[]>(() => {
    const groups: KeywordGroup[] = [];
    if (brandKeywords.length > 0) {
      groups.push({ label: "Brand keywords", keywords: brandKeywords });
    }
    if (facets.keywords.length > 0) {
      groups.push({
        label: "From creators",
        keywords: facets.keywords.map((f) => f.value),
      });
    }
    const topics = Array.from(
      new Set([...categories.apify, ...categories.collabstr])
    ).sort();
    if (topics.length > 0) {
      groups.push({ label: "Topics", keywords: topics });
    }
    return groups;
  }, [brandKeywords, facets.keywords, categories]);

  const locationSuggestions = useMemo(
    () => facets.locations.map((l) => ({ value: l.value, count: l.count })),
    [facets.locations]
  );

  useEffect(() => {
    let ignore = false;

    async function fetchSuggestions() {
      setSuggestionsLoading(true);
      try {
        const [categoryResponse, facetResponse] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/creators/facets"),
        ]);
        if (ignore) return;

        if (categoryResponse.ok) {
          const data = (await categoryResponse.json()) as CategoryGroups & {
            brandKeywords?: string[];
          };
          setCategories({ apify: data.apify ?? [], collabstr: data.collabstr ?? [] });
          setBrandKeywords(data.brandKeywords ?? []);
        }

        if (facetResponse.ok) {
          const facetData = (await facetResponse.json()) as CreatorFacets;
          setFacets(facetData);
        }
      } catch {
        // Suggestions are optional; typing still works.
      } finally {
        if (!ignore) setSuggestionsLoading(false);
      }
    }

    fetchSuggestions();

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

    // One list on screen; the API still wants known topics separate from
    // free-text keywords.
    const words = [...selectedWords];
    const pending = pendingWords.trim();
    if (pending && !words.some((w) => w.toLowerCase() === pending.toLowerCase())) {
      words.push(pending);
    }
    const canonicalCategories = words.filter(isCanonicalDiscoveryCategory);
    const keywordList = words.filter((w) => !isCanonicalDiscoveryCategory(w));

    if (words.length === 0) {
      setError("Add something to search for first.");
      return;
    }

    setLoading(true);
    setError(null);
    setJob(null);

    try {
      const body = {
        sources: selectedSourceList,
        keywords: keywordList,
        canonicalCategories,
        platform: "instagram",
        limit: parsedLimit.value,
        ...(location.trim() ? { location: location.trim() } : {}),
        filters: {
          ...(filters.minFollowers.trim()
            ? { minFollowers: Number(filters.minFollowers) }
            : {}),
          ...(filters.maxFollowers.trim()
            ? { maxFollowers: Number(filters.maxFollowers) }
            : {}),
          requireCategory: canonicalCategories.length > 0,
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
        <CardContent className="space-y-6 p-5">
          {suggestionsLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
          ) : (
            <UnifiedKeywordSelector
              groups={keywordGroups}
              selected={selectedWords}
              onChange={setSelectedWords}
              onPendingChange={setPendingWords}
            />
          )}

          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-6">
              <div className="space-y-1.5">
                <label htmlFor="discover-limit" className="block text-sm font-medium">
                  How many creators
                </label>
                <Input
                  id="discover-limit"
                  type="number"
                  min={1}
                  step={1}
                  value={filters.limit}
                  onChange={(event) => handleFilterChange("limit", event.target.value)}
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
                    value={filters.minFollowers}
                    onChange={(event) => handleFilterChange("minFollowers", event.target.value)}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Any"
                    aria-label="Most followers"
                    value={filters.maxFollowers}
                    onChange={(event) => handleFilterChange("maxFollowers", event.target.value)}
                    className="w-32"
                  />
                </div>
              </fieldset>
            </div>
            {parsedLimit.error ? (
              <p className="text-sm text-destructive">{parsedLimit.error}</p>
            ) : limitWarning ? (
              <p className="text-sm text-amber-700">{limitWarning}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Start with 10 to 25. Bigger searches take longer and use more creator search credit.
              </p>
            )}
          </div>

          <details className="group rounded-lg border">
            <summary className="cursor-pointer list-none px-4 py-3 font-medium marker:hidden">
              More options
              <span className="ml-2 font-normal text-muted-foreground">
                {selectedSourceList.length}{" "}
                {selectedSourceList.length === 1 ? "place" : "places"} to look
                {location.trim() ? `, near ${location.trim()}` : ""}
              </span>
            </summary>
            <div className="space-y-5 border-t px-4 py-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Where to look</legend>
                {SOURCE_OPTIONS.map(([source, label, hint]) => (
                  <label key={source} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      checked={sources[source]}
                      onChange={() => toggleSource(source)}
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
                <LocationInput
                  value={location}
                  onChange={setLocation}
                  suggestions={locationSuggestions}
                />
              </div>
            </div>
          </details>

          <div className="flex justify-end">
            <Button
              onClick={handleSearch}
              disabled={
                loading ||
                suggestionsLoading ||
                (selectedWords.length === 0 && !pendingWords)
              }
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
            {/apify|creator search/i.test(error) ? (
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
