"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export default function ReviewQueuePage() {
  const params = useParams<{ campaignId: string }>();
  const router = useRouter();
  const [creators, setCreators] = useState<CampaignCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function fetchCreators() {
    try {
      const res = await fetch(`/api/campaigns/${params.campaignId}/creators`);
      if (res.ok) {
        const data = (await res.json()) as CampaignCreator[];
        setCreators(Array.isArray(data) ? data : []);
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't load creators. Refresh the page to try again.");
      }
    } catch {
      setError("Couldn't load creators. Check your connection and refresh the page.");
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
    setError(null);
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
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't save that. Try again.");
      }
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
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
        <p className="text-muted-foreground">Loading creators…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Review creators</h2>
        <p className="mt-1 text-muted-foreground">
          {pendingCreators.length === 0
            ? "Nobody is waiting for you."
            : `${pendingCreators.length} ${pendingCreators.length === 1 ? "creator needs" : "creators need"} a yes or no.`}
        </p>
      </header>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {pendingCreators.length === 0 ? (
        <div className="space-y-3 rounded-xl border bg-card p-5">
          <p>
            Everyone in this campaign has been reviewed, or no creators were added yet.
            {approvedCount + declinedCount + deferredCount > 0 &&
              ` So far: ${approvedCount} approved, ${declinedCount} not a fit, ${deferredCount} maybe later.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/campaigns/${params.campaignId}/discover`)}
            >
              Find more creators
            </Button>
            {approvedCount > 0 ? (
              <Button onClick={() => router.push(`/campaigns/${params.campaignId}/outreach`)}>
                Email approved creators
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {pendingCreators.map((cc) => {
            const profile = cc.creator.profiles[0];
            const isLoading = actionLoading === cc.creatorId;

            return (
              <li
                key={cc.id}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
              >
                <div className="space-y-1">
                  <p className="font-medium">{cc.creator.name ?? "Unnamed creator"}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {profile && (
                      <>
                        <span>
                          <InstagramHandleLink
                            handle={profile.handle}
                            url={profile.url}
                            className="text-foreground hover:underline"
                          />
                          {" "}on {PLATFORM_LABELS[profile.platform] ?? "social media"}
                        </span>
                        <span>
                          {profile.followerCount != null
                            ? `${profile.followerCount.toLocaleString()} followers`
                            : "Followers unknown"}
                        </span>
                      </>
                    )}
                    {cc.creator.email && <span>{cc.creator.email}</span>}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleReview(cc.creatorId, "approve")} disabled={isLoading}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReview(cc.creatorId, "defer")}
                    disabled={isLoading}
                  >
                    Maybe later
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReview(cc.creatorId, "decline")}
                    disabled={isLoading}
                  >
                    Not a fit
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
