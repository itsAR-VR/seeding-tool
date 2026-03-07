"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type CreatorProfile = {
  platform: string;
  handle: string;
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

  // Add-to-campaign modal state
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string | null>(
    null
  );
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [addingToCampaign, setAddingToCampaign] = useState(false);

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

    try {
      const res = await fetch(`/api/creators?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCreators(data.creators);
        setTotalPages(data.pagination.totalPages);
        setTotal(data.pagination.total);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, minFollowers, maxFollowers, minViews, maxViews, category, source, page]);

  useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  async function fetchCampaigns() {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        // API returns array of campaigns
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
        fetchCreators(); // refresh to show updated campaign links
      } else if (res.status === 409) {
        alert("Creator is already in this campaign");
      }
    } catch {
      alert("Failed to add creator to campaign");
    } finally {
      setAddingToCampaign(false);
    }
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
        <Button onClick={() => router.push("/creators/import")}>
          Import CSV
        </Button>
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
              <Input
                placeholder="Category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setPage(1);
                }}
              />
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
                    <th className="pb-2 pr-4 font-medium">Followers</th>
                    <th className="pb-2 pr-4 font-medium">Avg Views</th>
                    <th className="pb-2 pr-4 font-medium">Category</th>
                    <th className="pb-2 pr-4 font-medium">Source</th>
                    <th className="pb-2 pr-4 font-medium">Campaigns</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.map((creator) => (
                    <tr key={creator.id} className="border-b">
                      <td className="py-2 pr-4">
                        <div>
                          <span className="font-mono text-xs">
                            @{creator.instagramHandle || "—"}
                          </span>
                          {creator.name &&
                            creator.name !== creator.instagramHandle && (
                              <p className="text-xs text-muted-foreground">
                                {creator.name}
                              </p>
                            )}
                        </div>
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
                  ))}
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
    </div>
  );
}
