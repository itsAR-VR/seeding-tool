"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InstagramHandleLink } from "@/components/instagram-handle-link";
import { sourceLabel } from "../../../creators/components/creator-filters";

type Creator = {
  id: string;
  name: string | null;
  instagramHandle: string | null;
  email: string | null;
  followerCount: number | null;
  avgViews: number | null;
  bioCategory: string | null;
  discoverySource: string;
  profiles: Array<{
    platform: string;
    handle: string;
    url: string | null;
  }>;
  campaignCreators: Array<{
    campaignId: string;
    campaign: { name: string };
  }>;
};

export default function CampaignImportPage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    added: number;
    skipped: number;
    invalid: number;
  } | null>(null);
  const [campaignName, setCampaignName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch all brand creators
      const creatorsRes = await fetch("/api/creators?limit=100");
      if (!creatorsRes.ok) {
        setError("Couldn't load your creators. Refresh the page to try again.");
      } else {
        const data = (await creatorsRes.json()) as { creators?: Creator[] };
        // Filter out creators already in this campaign
        const available = (data.creators ?? []).filter(
          (c) =>
            !c.campaignCreators.some(
              (cc) => cc.campaignId === params.campaignId
            )
        );
        setCreators(available);
      }

      // Fetch campaign name
      const campaignRes = await fetch(`/api/campaigns/${params.campaignId}`);
      if (campaignRes.ok) {
        const campaign = (await campaignRes.json()) as { name?: string };
        setCampaignName(campaign.name ?? "");
      }
    } catch {
      setError("Couldn't load your creators. Check your connection and refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [params.campaignId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === creators.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(creators.map((c) => c.id)));
    }
  }

  async function handleImport() {
    if (selected.size === 0) return;

    setImporting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/campaigns/${params.campaignId}/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ creatorIds: Array.from(selected) }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        setSelected(new Set());
        // Refresh list to remove imported creators
        fetchData();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't add those creators. Try again.");
      }
    } catch {
      setError("Couldn't add those creators. Check your connection and try again.");
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Add creators from your list</h2>
        <p className="mt-1 text-muted-foreground">
          Pick creators you already saved to add them to{" "}
          {campaignName ? campaignName : "this campaign"}.
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </p>
      )}

      {result && (
        <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 text-sm text-green-800">
          {result.added} added. {result.skipped} were already in this campaign
          {result.invalid > 0 ? `, ${result.invalid} couldn't be added` : ""}.
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">
              Saved creators not in this campaign ({creators.length})
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={toggleAll}>
                {selected.size === creators.length && creators.length > 0
                  ? "Unselect all"
                  : "Select all"}
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={selected.size === 0 || importing}
              >
                {importing
                  ? "Adding…"
                  : `Add ${selected.size} to campaign`}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Average views is from their latest 12 videos, when we have it.
          </p>
        </CardHeader>
        <CardContent>
          {creators.length === 0 ? (
            <div className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                No saved creators to add. Everyone you saved is already in this campaign, or you
                haven&apos;t saved any yet.
              </p>
              <div className="flex justify-center gap-2">
                <Button size="sm" onClick={() => router.push(`/campaigns/${params.campaignId}/discover`)}>
                  Find creators
                </Button>
                <Button size="sm" variant="outline" onClick={() => router.push("/creators/import")}>
                  Upload a list
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 w-8">
                      <input
                        type="checkbox"
                        aria-label="Select all creators"
                        checked={
                          selected.size === creators.length &&
                          creators.length > 0
                        }
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="pb-2 pr-4 font-medium">Handle</th>
                    <th className="pb-2 pr-4 font-medium">Followers</th>
                    <th className="pb-2 pr-4 font-medium">Average views</th>
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((creator) => {
                    const instagramProfile = creator.profiles.find(
                      (profile) => profile.platform === "instagram"
                    );

                    return (
                      <tr
                        key={creator.id}
                        className={`border-b cursor-pointer ${
                          selected.has(creator.id) ? "bg-muted" : ""
                        }`}
                        onClick={() => toggleSelect(creator.id)}
                      >
                      <td className="py-2 pr-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${creator.instagramHandle ?? creator.name ?? "creator"}`}
                          onClick={(e) => e.stopPropagation()}
                          checked={selected.has(creator.id)}
                          onChange={() => toggleSelect(creator.id)}
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <InstagramHandleLink
                          handle={creator.instagramHandle}
                          url={instagramProfile?.url}
                          className="font-medium hover:underline"
                        >
                          {creator.instagramHandle
                            ? `@${creator.instagramHandle.replace(/^@/, "")}`
                            : creator.name || "Unnamed creator"}
                        </InstagramHandleLink>
                      </td>
                      <td className="py-2 pr-4">
                        {creator.followerCount?.toLocaleString() ?? <span className="text-muted-foreground">Not known</span>}
                      </td>
                      <td className="py-2 pr-4">
                        {creator.avgViews?.toLocaleString() ?? <span className="text-muted-foreground">Not known</span>}
                      </td>
                      <td className="py-2 pr-4">
                        {creator.bioCategory || <span className="text-muted-foreground">Not set</span>}
                      </td>
                      <td className="py-2">
                        <Badge variant="outline">
                          {sourceLabel(creator.discoverySource)}
                        </Badge>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
