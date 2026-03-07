"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      const res = await fetch(
        `/api/campaigns/${params.campaignId}/creators?reviewStatus=pending`
      );
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
            {creators.length} creator{creators.length !== 1 ? "s" : ""} pending
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

      {creators.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>All caught up!</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No creators pending review. Check back later or add more
              creators to this campaign.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {creators.map((cc) => {
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
                          {profile.url ? (
                            <a
                              href={profile.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              @{profile.handle}
                            </a>
                          ) : (
                            <span>@{profile.handle}</span>
                          )}
                          {profile.followerCount != null && (
                            <span>
                              {profile.followerCount.toLocaleString()} followers
                            </span>
                          )}
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
