"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
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

const TRIAGE_LABELS: Record<string, string> = {
  auto_shortlist: "Strong match",
  review: "Worth a look",
  suppress: "Weak match",
};

function triageLabel(triage: string): string {
  return TRIAGE_LABELS[triage] ?? triage.replace(/_/g, " ");
}

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
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/campaigns/${params.campaignId}/seed-list`);
        const data = (await res.json().catch(() => null)) as (SeedListPayload & { error?: string }) | null;
        if (res.ok && data) {
          setPayload(data);
        } else {
          setError(data?.error ?? "Couldn't load the suggested list. Refresh the page to try again.");
        }
      } catch {
        setError("Couldn't load the suggested list. Check your connection and refresh the page.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.campaignId]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading the suggested list…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Suggested creator mix</h1>
        <p className="text-muted-foreground">
          Your best matches next to a more varied mix of creators, from this campaign&apos;s latest
          search.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent role="alert" className="pt-6 text-sm text-red-800">
            {error}
          </CardContent>
        </Card>
      ) : !payload?.portfolio ? (
        <Card>
          <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
            <p>No search results for this campaign yet. Run a creator search first.</p>
            <Link
              href={`/campaigns/${params.campaignId}/discover`}
              className={buttonVariants({ size: "sm" })}
            >
              Find creators
            </Link>
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
                    Score {(candidate.fitScore * 100).toFixed(0)}% · {triageLabel(candidate.triage)}
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
                    Score {(candidate.fitScore * 100).toFixed(0)}% · {triageLabel(candidate.triage)}
                  </p>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={async () => {
                  setSaveMessage(null);
                  try {
                    const res = await fetch(`/api/campaigns/${params.campaignId}/seed-list`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload.config),
                    });
                    const data = (await res.json().catch(() => null)) as { error?: string } | null;
                    setSaveMessage(res.ok ? "Saved." : data?.error ?? "Couldn't save. Try again.");
                  } catch {
                    setSaveMessage("Couldn't save. Check your connection and try again.");
                  }
                }}
              >
                Save these settings
              </Button>
              {saveMessage && <p role="status" className="text-sm">{saveMessage}</p>}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
