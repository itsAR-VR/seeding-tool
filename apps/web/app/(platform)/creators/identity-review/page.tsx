"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EdgeRecord = {
  id: string;
  matchScore: number;
  matchBand: string;
  fromProfile: {
    platform: string;
    handle: string;
    profileUrl: string | null;
    creators: Array<{ id: string; name: string | null; instagramHandle: string | null }>;
  };
  toProfile: {
    platform: string;
    handle: string;
    profileUrl: string | null;
    creators: Array<{ id: string; name: string | null; instagramHandle: string | null }>;
  };
};

export default function IdentityReviewPage() {
  const [edges, setEdges] = useState<EdgeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  async function fetchEdges() {
    try {
      const res = await fetch("/api/identity/review");
      const data = await res.json();
      if (res.ok) {
        setEdges(data.edges ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchEdges();
  }, []);

  async function resolve(edgeId: string, action: "confirm" | "reject" | "defer") {
    setUpdating(edgeId);
    try {
      const res = await fetch(`/api/identity/review/${edgeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setEdges((current) => current.filter((edge) => edge.id !== edgeId));
      }
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Identity Review</h1>
        <p className="text-muted-foreground">
          Review possible creator identity matches before any merge is trusted.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {loading ? "Loading…" : `${edges.length} possible match${edges.length === 1 ? "" : "es"}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {edges.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">
              No identity matches are waiting for review.
            </p>
          ) : null}

          {edges.map((edge) => (
            <div key={edge.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Match score {(edge.matchScore * 100).toFixed(0)}% · {edge.matchBand}
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-md bg-muted/40 p-3 text-sm">
                      <p className="font-medium">From</p>
                      <p>@{edge.fromProfile.handle}</p>
                      <p className="text-xs text-muted-foreground">
                        {edge.fromProfile.platform}
                      </p>
                    </div>
                    <div className="rounded-md bg-muted/40 p-3 text-sm">
                      <p className="font-medium">To</p>
                      <p>@{edge.toProfile.handle}</p>
                      <p className="text-xs text-muted-foreground">
                        {edge.toProfile.platform}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={updating === edge.id}
                    onClick={() => resolve(edge.id, "confirm")}
                  >
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updating === edge.id}
                    onClick={() => resolve(edge.id, "defer")}
                  >
                    Defer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={updating === edge.id}
                    onClick={() => resolve(edge.id, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
