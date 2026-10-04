"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SearchJobSummary = {
  jobId: string;
  campaignId: string | null;
  status: string;
  requestedCount: number;
  candidateCount: number;
  validatedCount: number;
  invalidCount: number;
  cachedCount: number;
  progressPercent: number;
  etaSeconds: number | null;
  resultCount: number;
  error: string | null;
};

function jobTarget(job: SearchJobSummary) {
  return job.campaignId ? `/campaigns/${job.campaignId}/review` : "/creators";
}

function statusTone(status: string) {
  if (status === "failed") return "destructive" as const;
  if (status === "completed" || status === "completed_with_shortfall") {
    return "secondary" as const;
  }
  return "outline" as const;
}

export function CreatorSearchJobsTray() {
  const [open, setOpen] = useState(false);
  const [activeJobs, setActiveJobs] = useState<SearchJobSummary[]>([]);
  const [recentJobs, setRecentJobs] = useState<SearchJobSummary[]>([]);

  useEffect(() => {
    let cancelled = false;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;

    // Check often only while a search is running; otherwise once a minute,
    // and never while the tab is hidden.
    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void tick(), running ? 4000 : 60000);
    }
    async function tick() {
      if (!document.hidden) await loadJobs();
      if (!cancelled) schedule();
    }

    async function loadJobs() {
      try {
        const [activeResponse, recentResponse] = await Promise.all([
          fetch("/api/creators/search/jobs?scope=active"),
          fetch("/api/creators/search/jobs?scope=recent"),
        ]);
        if (!activeResponse.ok || !recentResponse.ok) return;

        const activePayload = (await activeResponse.json()) as {
          jobs: SearchJobSummary[];
        };
        const recentPayload = (await recentResponse.json()) as {
          jobs: SearchJobSummary[];
        };
        running = activePayload.jobs.length > 0;
        if (!cancelled) {
          setActiveJobs(activePayload.jobs);
          setRecentJobs(recentPayload.jobs);
        }
      } catch {
        // ignore
      }
    }

    // A search started on this page should show up right away.
    const onStarted = () => {
      running = true;
      void tick();
    };
    window.addEventListener("creator-search-started", onStarted);
    void tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("creator-search-started", onStarted);
    };
  }, []);

  const visibleRecentJobs = useMemo(() => {
    const merged = new Map<string, SearchJobSummary>();

    for (const job of [...activeJobs, ...recentJobs]) {
      if (!merged.has(job.jobId)) {
        merged.set(job.jobId, job);
      }
    }

    return Array.from(merged.values()).slice(0, 8);
  }, [activeJobs, recentJobs]);

  if (visibleRecentJobs.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col items-end gap-3">
      {open ? (
        <div className="pointer-events-auto w-full rounded-2xl border bg-background/95 p-4 shadow-xl backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Discovery Jobs</p>
              <p className="text-sm text-muted-foreground">
                Active and recent creator searches
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>

          <div className="space-y-3">
            {visibleRecentJobs.map((job) => (
              <div key={job.jobId} className="rounded-xl border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge variant={statusTone(job.status)}>{job.status}</Badge>
                  <Link
                    href={jobTarget(job)}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    Open
                  </Link>
                </div>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-foreground/80 transition-all"
                    style={{ width: `${job.progressPercent}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <span>Requested: {job.requestedCount}</span>
                  <span>Ready: {job.resultCount}</span>
                  <span>Validated: {job.validatedCount}</span>
                  <span>Cached: {job.cachedCount}</span>
                  <span>Invalid: {job.invalidCount}</span>
                  <span>
                    ETA: {typeof job.etaSeconds === "number" ? `${job.etaSeconds}s` : "—"}
                  </span>
                </div>
                {job.error ? (
                  <p className="mt-2 text-sm text-red-700">{job.error}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        className="pointer-events-auto rounded-full px-4 shadow-lg"
        onClick={() => setOpen((current) => !current)}
      >
        Discovery Jobs
        <span className="ml-2 rounded-full bg-background px-2 py-0.5 text-sm text-foreground">
          {activeJobs.length}
        </span>
      </Button>
    </div>
  );
}
