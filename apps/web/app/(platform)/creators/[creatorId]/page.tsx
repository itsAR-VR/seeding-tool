"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProvenancePayload = {
  creator: {
    id: string;
    name: string | null;
    instagramHandle: string | null;
    email: string | null;
    validationStatus: string;
  };
  discoveryTouches: Array<{ source: string; createdAt: string }>;
  confidenceBand: string;
  riskFlags: string[];
  scoreDecomposition: Record<string, unknown> | null;
  outcomeHistory: Array<{ id: string; reviewDecision: string | null; updatedAt: string }>;
  identity: {
    id: string;
    displayName: string | null;
    profiles: Array<{
      id: string;
      platform: string;
      handle: string;
      profileUrl: string | null;
      contactPoints: Array<{ contactType: string; contactValue: string; confidence: number }>;
    }>;
  } | null;
};

type CreatorSummary = {
  id: string;
  name: string | null;
  email: string | null;
  instagramHandle: string | null;
  followerCount: number | null;
  bio: string | null;
  optedOut: boolean;
  campaignCreators: Array<{
    id: string;
    reviewStatus: string;
    lifecycleStatus: string;
    replyDecision: string | null;
    campaign: { id: string; name: string };
    conversationThread: { id: string } | null;
  }>;
};

export default function CreatorProvenancePage() {
  const params = useParams<{ creatorId: string }>();
  const [payload, setPayload] = useState<ProvenancePayload | null>(null);
  const [summary, setSummary] = useState<CreatorSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [summaryRes, res] = await Promise.all([
          fetch(`/api/creators/${params.creatorId}/summary`),
          fetch(`/api/creators/${params.creatorId}/provenance`),
        ]);
        if (summaryRes.ok) setSummary((await summaryRes.json()) as CreatorSummary);
        if (res.ok) setPayload((await res.json()) as ProvenancePayload);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.creatorId]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading creator…</div>;
  }

  if (!summary) {
    return <div className="p-6 text-sm text-muted-foreground">Creator not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {summary.name ?? summary.instagramHandle ?? "Creator"}
        </h1>
        <p className="text-muted-foreground">
          {[
            summary.instagramHandle ? `@${summary.instagramHandle}` : null,
            summary.email,
            summary.followerCount ? `${summary.followerCount.toLocaleString()} followers` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {summary.optedOut && (
          <Badge className="mt-2 bg-red-100 text-red-800">On the do-not-send list</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.campaignCreators.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not in any campaign yet.</p>
          ) : (
            <div className="divide-y">
              {summary.campaignCreators.map((cc) => (
                <div key={cc.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Link href={`/campaigns/${cc.campaign.id}`} className="font-medium hover:underline">
                      {cc.campaign.name}
                    </Link>
                    <Badge variant="outline">{cc.reviewStatus}</Badge>
                    <Badge variant="outline">{cc.lifecycleStatus.replace(/_/g, " ")}</Badge>
                    {cc.replyDecision && (
                      <Badge variant="outline">Said {cc.replyDecision}</Badge>
                    )}
                  </div>
                  {cc.conversationThread ? (
                    <Link href={`/inbox/${cc.conversationThread.id}`} className="text-blue-600 hover:underline">
                      Open conversation →
                    </Link>
                  ) : cc.reviewStatus === "approved" && cc.lifecycleStatus === "ready" ? (
                    <Link
                      href={`/campaigns/${cc.campaign.id}/outreach?select=${cc.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Email →
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {summary.bio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bio</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{summary.bio}</CardContent>
        </Card>
      )}

      {payload && (
      <>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decision stack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Risk flags</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {payload.riskFlags.length > 0 ? (
                  payload.riskFlags.map((flag) => <li key={flag}>{flag}</li>)
                ) : (
                  <li>No active risk flags.</li>
                )}
              </ul>
            </div>
            <div>
              <p className="font-medium">Score decomposition</p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(payload.scoreDecomposition, null, 2)}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity & provenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium">Discovery touches</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {payload.discoveryTouches.map((touch, index) => (
                  <li key={`${touch.source}-${index}`}>
                    {touch.source} · {new Date(touch.createdAt).toLocaleString()}
                  </li>
                ))}
              </ul>
            </div>
            {payload.identity ? (
              <div>
                <p className="font-medium">Linked profiles</p>
                <ul className="list-disc pl-5 text-muted-foreground">
                  {payload.identity.profiles.map((profile) => (
                    <li key={profile.id}>
                      {profile.platform} · @{profile.handle}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      </>
      )}
    </div>
  );
}
