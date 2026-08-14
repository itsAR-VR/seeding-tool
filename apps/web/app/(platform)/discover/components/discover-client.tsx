"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type {
  DiscoveryRun,
  DiscoveryRunStatus,
} from "@/lib/suggested-discovery/types";
import { RunForm } from "./run-form";
import { CandidateCard } from "./candidate-card";

const ACTIVE_STATUSES: readonly DiscoveryRunStatus[] = [
  "queued",
  "running",
  "classifying",
];

function statusVariant(status: DiscoveryRunStatus) {
  if (status === "failed" || status === "needs_login") return "destructive" as const;
  if (status === "completed") return "secondary" as const;
  return "outline" as const;
}

export function DiscoverClient() {
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DiscoveryRun | null>(null);
  const [copied, setCopied] = useState(false);
  // Tracks the live selection so an in-flight fetch for a previously
  // selected run cannot overwrite the panel after the user switches.
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedId;

  const refreshRuns = useCallback(async () => {
    try {
      const response = await fetch("/api/discover/suggested");
      if (!response.ok) return;
      const payload = (await response.json()) as { runs: DiscoveryRun[] };
      setRuns(payload.runs);
    } catch {
      // list stays stale; next poll retries
    }
  }, []);

  const refreshDetail = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`/api/discover/suggested/${runId}`);
      if (!response.ok) return;
      const payload = (await response.json()) as { run: DiscoveryRun };
      if (selectedIdRef.current === runId) {
        setDetail(payload.run);
      }
      return payload.run;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      try {
        const response = await fetch("/api/discover/suggested");
        if (!response.ok) return;
        const payload = (await response.json()) as { runs: DiscoveryRun[] };
        if (!cancelled) setRuns(payload.runs);
      } catch {
        // list stays stale; next refresh retries
      }
    }

    loadRuns();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll the selected run while it is active.
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      const run = await refreshDetail(selectedId as string);
      if (cancelled) return;
      if (!run || ACTIVE_STATUSES.includes(run.status)) {
        // Active run OR a transient fetch failure — keep polling either
        // way; only a fetched terminal status stops the loop.
        timer = setTimeout(poll, 2_500);
      } else {
        refreshRuns();
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [selectedId, refreshDetail, refreshRuns]);

  function handleStarted(runId: string) {
    setSelectedId(runId);
    refreshRuns();
  }

  async function copyMatchedHandles() {
    if (!detail) return;
    const handles = detail.candidates
      .filter((candidate) => candidate.status === "match")
      .map((candidate) => `@${candidate.profile.handle}`)
      .join("\n");
    await navigator.clipboard.writeText(handles);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-4">
        <RunForm onStarted={handleStarted} />

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Recent runs
          </h2>
          {runs.length === 0 && (
            <p className="text-xs text-muted-foreground">No runs yet.</p>
          )}
          {runs.map((run) => (
            <button
              key={run.id}
              type="button"
              onClick={() => setSelectedId(run.id)}
              className={`w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent ${
                selectedId === run.id ? "border-foreground/40 bg-accent" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">@{run.seedHandle}</span>
                <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {run.niche}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {run.counts.matched} matched · {run.counts.discovered} found ·{" "}
                {run.mode}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div>
        {!detail && (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Start a run or select one from the list.
            </CardContent>
          </Card>
        )}

        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">
                  @{detail.seedHandle} → {detail.counts.matched} matches
                </h2>
                <p className="text-sm text-muted-foreground">{detail.niche}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={statusVariant(detail.status)}>
                  {detail.status}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyMatchedHandles}
                  disabled={detail.counts.matched === 0}
                >
                  {copied ? "Copied" : "Copy matched handles"}
                </Button>
              </div>
            </div>

            {detail.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {detail.error}
              </p>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {detail.candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.profile.handle}
                  runId={detail.id}
                  candidate={candidate}
                />
              ))}
            </div>

            {detail.status === "completed" && (
              <p className="text-xs text-muted-foreground">
                Next step: run matched handles through the enrichment pipeline
                for emails and phone numbers.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
