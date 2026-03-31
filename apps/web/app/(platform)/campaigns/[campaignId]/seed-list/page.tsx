"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RankedCandidate = {
  id: string;
  handle: string;
  name: string | null;
  fitScore: number;
  fitReasoning: string;
  triage: string;
  followerCount: number | null;
  canonicalCategory: string | null;
  validationStatus: string;
};

type SeedListPayload = {
  config: {
    targetSize: number;
    qualityWeight: number;
    diversityWeight: number;
  };
  ranked: RankedCandidate[];
  portfolio: {
    selected: RankedCandidate[];
    explanation: string;
    diversityMetrics: { overallDiversity: number };
    qualityMetrics: { meanScore: number };
  } | null;
};

export default function SeedListPreviewPage() {
  const params = useParams<{ campaignId: string }>();
  const [payload, setPayload] = useState<SeedListPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/campaigns/${params.campaignId}/seed-list`);
        const data = await res.json();
        if (res.ok) {
          setPayload(data);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.campaignId]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading seed list preview…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Seed List Preview</h1>
        <p className="text-muted-foreground">
          Compare the current ranked candidates with the diversity-aware portfolio preview.
        </p>
      </div>

      {!payload?.portfolio ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No completed search results are available for this campaign yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Ranked List</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {payload.ranked.slice(0, payload.config.targetSize).map((candidate) => (
                <div key={candidate.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    @{candidate.handle}
                    {candidate.name ? ` · ${candidate.name}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Score {(candidate.fitScore * 100).toFixed(0)}% · {candidate.triage}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portfolio Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {payload.portfolio.explanation}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium">Overall diversity</p>
                  <p>{payload.portfolio.diversityMetrics.overallDiversity.toFixed(2)}</p>
                </div>
                <div className="rounded-md border p-3 text-sm">
                  <p className="font-medium">Mean score</p>
                  <p>{(payload.portfolio.qualityMetrics.meanScore * 100).toFixed(0)}%</p>
                </div>
              </div>
              {payload.portfolio.selected.map((candidate) => (
                <div key={candidate.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">
                    @{candidate.handle}
                    {candidate.name ? ` · ${candidate.name}` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    Score {(candidate.fitScore * 100).toFixed(0)}% · {candidate.triage}
                  </p>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={async () => {
                  await fetch(`/api/campaigns/${params.campaignId}/seed-list`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload.config),
                  });
                }}
              >
                Save preview config
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
