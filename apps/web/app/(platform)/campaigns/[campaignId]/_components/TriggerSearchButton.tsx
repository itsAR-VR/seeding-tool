"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SearchResult = {
  status: string;
  jobId: string;
  added?: number;
  analyzed?: number;
  creditsConsumed?: number;
  icpKeywords?: string[];
  usedWorker?: boolean;
};

type Props = {
  campaignId: string;
};

export function TriggerSearchButton({ campaignId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // filter state
  const [category, setCategory] = useState("");
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [keywords, setKeywords] = useState("");

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setResult(null);
      setError(null);
      setLoading(false);
    }
  }

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setResult(null);

    const body: Record<string, unknown> = { platform: "instagram" };
    if (category.trim()) body.category = category.trim();
    if (minFollowers.trim()) body.minFollowers = Number(minFollowers);
    if (maxFollowers.trim()) body.maxFollowers = Number(maxFollowers);
    if (keywords.trim())
      body.keywords = keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Unknown error" }))) as {
          error?: string;
        };
        setError(err.error ?? `HTTP ${res.status}`);
        return;
      }

      const data = (await res.json()) as SearchResult;
      setResult(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="outline">🔍 Discover Creators</Button>
        }
      />

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Discover Creators</DialogTitle>
          <DialogDescription>
            Search the Collabstr dataset and score fit against your brand ICP.
            Matching creators are added to the campaign review queue.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-green-50 p-4 text-sm text-green-900">
              <p className="font-semibold">Search complete ✓</p>
              <p>
                Analyzed <strong>{result.analyzed ?? 0}</strong> creators —{" "}
                <strong>{result.added ?? 0}</strong> added to campaign.
              </p>
              {result.icpKeywords?.length ? (
                <p className="mt-1 text-xs text-green-700">
                  ICP keywords: {result.icpKeywords.join(", ")}
                </p>
              ) : null}
              {result.creditsConsumed ? (
                <p className="mt-1 text-xs text-green-700">
                  Credits consumed: {result.creditsConsumed}
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setOpen(false);
                  router.push(`/campaigns/${campaignId}/review`);
                }}
              >
                Go to Review Queue →
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="ss-category">Category / Niche</Label>
              <Input
                id="ss-category"
                placeholder="e.g. beauty, fitness, lifestyle"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="ss-min">Min Followers</Label>
                <Input
                  id="ss-min"
                  type="number"
                  placeholder="e.g. 5000"
                  value={minFollowers}
                  onChange={(e) => setMinFollowers(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ss-max">Max Followers</Label>
                <Input
                  id="ss-max"
                  type="number"
                  placeholder="e.g. 500000"
                  value={maxFollowers}
                  onChange={(e) => setMaxFollowers(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ss-keywords">
                Keywords{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (comma-separated, overrides ICP)
                </span>
              </Label>
              <Input
                id="ss-keywords"
                placeholder="e.g. skincare, vegan, sustainable"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? "Searching…" : "Run Search"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
