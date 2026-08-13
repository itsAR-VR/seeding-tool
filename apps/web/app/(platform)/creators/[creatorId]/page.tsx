"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

export default function CreatorProvenancePage() {
  const params = useParams<{ creatorId: string }>();
  const [payload, setPayload] = useState<ProvenancePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/creators/${params.creatorId}/provenance`);
        const data = await res.json();
        if (res.ok) {
          setPayload(data);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.creatorId]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading creator provenance…</div>;
  }

  if (!payload) {
    return <div className="p-6 text-sm text-muted-foreground">Creator provenance unavailable.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {payload.creator.name ?? payload.creator.instagramHandle ?? "Creator"}
        </h1>
        <p className="text-muted-foreground">
          Confidence: {payload.confidenceBand} · Validation: {payload.creator.validationStatus}
        </p>
      </div>

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
    </div>
  );
}
