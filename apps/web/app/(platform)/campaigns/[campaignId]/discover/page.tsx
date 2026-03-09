"use client";

import { useState } from "react";
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

type SearchResult = {
  status: string;
  jobId: string;
  added: number;
  analyzed: number;
  creditsConsumed: number;
  icpKeywords: string[];
  usedWorker: boolean;
};

type SearchFilters = {
  platform: string;
  keywords: string;
  minFollowers: string;
  maxFollowers: string;
  category: string;
  location: string;
};

export default function DiscoverCreatorsPage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();

  const [filters, setFilters] = useState<SearchFilters>({
    platform: "instagram",
    keywords: "",
    minFollowers: "",
    maxFollowers: "",
    category: "",
    location: "",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleChange(key: keyof SearchFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body: Record<string, unknown> = {};
      if (filters.platform) body.platform = filters.platform;
      if (filters.keywords.trim()) {
        body.keywords = filters.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
      }
      if (filters.minFollowers) body.minFollowers = Number(filters.minFollowers);
      if (filters.maxFollowers) body.maxFollowers = Number(filters.maxFollowers);
      if (filters.category.trim()) body.category = filters.category.trim();
      if (filters.location.trim()) body.location = filters.location.trim();

      const res = await fetch(
        `/api/campaigns/${params.campaignId}/search`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      const data = (await res.json()) as SearchResult | { error: string };

      if (!res.ok) {
        setError((data as { error: string }).error ?? "Search failed");
        return;
      }

      setResult(data as SearchResult);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Discover Creators
          </h1>
          <p className="text-muted-foreground">
            Search the Collabstr dataset and score creators against your brand
            ICP. Matching creators land in your review queue.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/campaigns/${params.campaignId}`)}
        >
          ← Back to Campaign
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Search Filters</CardTitle>
          <CardDescription>
            Leave blank to use your brand&apos;s ICP automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Platform</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={filters.platform}
                onChange={(e) => handleChange("platform", e.target.value)}
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">
                Keywords{" "}
                <span className="text-muted-foreground font-normal">
                  (comma-separated)
                </span>
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                placeholder="e.g. wellness, beauty, fitness"
                value={filters.keywords}
                onChange={(e) => handleChange("keywords", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Category / Niche</label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                placeholder="e.g. lifestyle"
                value={filters.category}
                onChange={(e) => handleChange("category", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Min Followers</label>
              <input
                type="number"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                placeholder="e.g. 5000"
                value={filters.minFollowers}
                onChange={(e) => handleChange("minFollowers", e.target.value)}
                min={0}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Max Followers</label>
              <input
                type="number"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                placeholder="e.g. 500000"
                value={filters.maxFollowers}
                onChange={(e) => handleChange("maxFollowers", e.target.value)}
                min={0}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Location</label>
              <input
                type="text"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                placeholder="e.g. United States"
                value={filters.location}
                onChange={(e) => handleChange("location", e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSearch} disabled={loading} className="min-w-[140px]">
              {loading ? "Searching…" : "🔍 Search Creators"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-base text-green-800">
              ✅ Search Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-green-700">
                  {result.added}
                </p>
                <p className="text-xs text-muted-foreground">Added to Queue</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-bold">{result.analyzed}</p>
                <p className="text-xs text-muted-foreground">Analyzed</p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                <p className="text-2xl font-bold">{result.creditsConsumed}</p>
                <p className="text-xs text-muted-foreground">
                  Credits Used
                </p>
              </div>
              <div className="rounded-lg bg-white p-3 text-center shadow-sm">
                <Badge
                  className={
                    result.usedWorker
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }
                >
                  {result.usedWorker ? "Fly Worker" : "Local AI"}
                </Badge>
                <p className="mt-1 text-xs text-muted-foreground">
                  Scoring Engine
                </p>
              </div>
            </div>

            {result.icpKeywords.length > 0 && (
              <div>
                <p className="mb-1 text-sm font-medium text-green-800">
                  ICP Keywords Used
                </p>
                <div className="flex flex-wrap gap-1">
                  {result.icpKeywords.map((kw) => (
                    <Badge key={kw} variant="outline" className="text-xs">
                      {kw}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.added > 0 && (
              <div className="flex justify-end">
                <Button
                  onClick={() =>
                    router.push(`/campaigns/${params.campaignId}/review`)
                  }
                >
                  Review {result.added} Creator{result.added !== 1 ? "s" : ""}{" "}
                  →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
