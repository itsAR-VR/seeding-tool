"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InstagramHandleLink } from "@/components/instagram-handle-link";

type CreatorProfile = {
  platform: string;
  handle: string;
  url: string | null;
  followerCount: number | null;
};

type CampaignCreator = {
  id: string;
  reviewStatus: string;
  lifecycleStatus: string;
  creatorId: string;
  creator: {
    id: string;
    name: string | null;
    email: string | null;
    profiles: CreatorProfile[];
  };
};

export default function ReviewQueuePage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();
  const [creators, setCreators] = useState<CampaignCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchCreators() {
    try {
      const res = await fetch(`/api/campaigns/${params.campaignId}/creators`);
      if (res.ok) {
        const data = (await res.json()) as CampaignCreator[];
        setCreators(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCreators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.campaignId]);

  async function handleReview(
    creatorId: string,
    action: "approve" | "decline" | "defer"
  ) {
    setActionLoading(creatorId);
    try {
      const res = await fetch(
        `/api/campaigns/${params.campaignId}/creators/${creatorId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      if (res.ok) {
        // Remove from list
        setCreators((prev) =>
          prev.filter((c) => c.creatorId !== creatorId)
        );
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }

  const pendingCreators = creators.filter((creator) => creator.reviewStatus === "pending");
  const approvedCount = creators.filter((creator) => creator.reviewStatus === "approved").length;
  const declinedCount = creators.filter((creator) => creator.reviewStatus === "declined").length;
  const deferredCount = creators.filter((creator) => creator.reviewStatus === "deferred").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading review queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Review Queue</h1>
          <p className="text-muted-foreground">
            {pendingCreators.length} creator{pendingCreators.length !== 1 ? "s" : ""} pending
            review
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/campaigns/${params.campaignId}`)}
        >
          ← Back to Campaign
        </Button>
      </div>

      {pendingCreators.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nothing is waiting for manual review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pending is empty right now. That usually means this campaign has already been triaged or nothing has been added yet.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Approved", value: approvedCount },
                { label: "Declined", value: declinedCount },
                { label: "Deferred", value: deferredCount },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/campaigns/${params.campaignId}/discover`)}
              >
                Discover more creators
              </Button>
              {approvedCount > 0 ? (
                <Button
                  variant="outline"
                  onClick={() => router.push(`/campaigns/${params.campaignId}/outreach`)}
                >
                  Open draft outreach
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {pendingCreators.map((cc) => {
            const profile = cc.creator.profiles[0];
            const isLoading = actionLoading === cc.creatorId;

            return (
              <Card key={cc.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {cc.creator.name ?? "Unknown Creator"}
                      </p>
                      {profile && (
                        <Badge variant="outline">
                          {profile.platform}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      {profile && (
                        <>
                          <InstagramHandleLink
                            handle={profile.handle}
                            url={profile.url}
                            className="text-blue-600 hover:underline"
                          />
                          <span>
                            {profile.followerCount != null
                              ? `${profile.followerCount.toLocaleString()} followers`
                              : "—"}
                          </span>
                        </>
                      )}
                      {cc.creator.email && (
                        <span>{cc.creator.email}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        handleReview(cc.creatorId, "approve")
                      }
                      disabled={isLoading}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        handleReview(cc.creatorId, "defer")
                      }
                      disabled={isLoading}
                    >
                      Defer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:text-red-700"
                      onClick={() =>
                        handleReview(cc.creatorId, "decline")
                      }
                      disabled={isLoading}
                    >
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
