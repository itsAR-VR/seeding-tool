"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusPill, type StatusTone } from "@/components/status-pill";
import { formatDate } from "@/lib/format/date";

type Intervention = {
  id: string;
  type: string;
  status: string;
  priority: string;
  title: string;
  description: string | null;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  campaignCreatorId: string | null;
  link: { label: string; href: string } | null;
};

const typeLabels: Record<string, string> = {
  captcha: "Blocked by a security check",
  auth_failure: "Account needs reconnecting",
  duplicate_order: "Order didn't go through",
  unclear_reply: "Reply is unclear",
  manual_review: "Needs a look",
  other: "Other",
};

/** Only the priorities worth calling out get a pill; normal and low stay quiet. */
const priorityPills: Record<string, { label: string; tone: StatusTone }> = {
  high: { label: "High priority", tone: "waiting" },
  critical: { label: "Urgent", tone: "problem" },
};

const statusPills: Record<string, { label: string; tone: StatusTone }> = {
  open: { label: "Open", tone: "waiting" },
  in_progress: { label: "In progress", tone: "waiting" },
  resolved: { label: "Resolved", tone: "good" },
  reopened: { label: "Reopened", tone: "problem" },
};

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "resolved", label: "Resolved" },
  { value: "", label: "All" },
];

function plain(value: string): string {
  return value.replace(/_/g, " ");
}

/** The problems list with its filter and "Resolve" flow. Loads from /api/interventions. */
export function ProblemsList() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("open");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadInterventions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);

      const res = await fetch(`/api/interventions?${params}`);
      if (res.ok) {
        const data = (await res.json()) as unknown;
        setInterventions(Array.isArray(data) ? (data as Intervention[]) : []);
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't load this list. Refresh the page to try again.");
      }
    } catch (err) {
      console.error("Failed to load interventions:", err);
      setError("Couldn't load this list. Check your connection and refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadInterventions();
  }, [loadInterventions]);

  async function resolveIntervention(id: string) {
    if (!resolutionText.trim()) return;

    setError(null);
    try {
      const res = await fetch(`/api/interventions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution: resolutionText }),
      });

      if (res.ok) {
        setResolvingId(null);
        setResolutionText("");
        await loadInterventions();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Couldn't mark it resolved. Try again.");
      }
    } catch (err) {
      console.error("Failed to resolve:", err);
      setError("Couldn't mark it resolved. Check your connection and try again.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Show problems">
        {FILTERS.map((f) => (
          <Button
            key={f.value || "all"}
            variant={filter === f.value ? "default" : "outline"}
            size="sm"
            aria-pressed={filter === f.value}
            className="min-h-11"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading ? (
        <p className="rounded-xl border bg-card p-5 text-muted-foreground">Loading…</p>
      ) : interventions.length === 0 ? (
        <p className="rounded-xl border bg-card p-5">
          {filter === "open"
            ? "No open problems. If an email, order, or connection goes wrong, it shows up here and on Home."
            : "Nothing here."}
        </p>
      ) : (
        <ul className="space-y-3">
          {interventions.map((i) => {
            const status = statusPills[i.status] ?? { label: plain(i.status), tone: "neutral" as const };
            const priority = priorityPills[i.priority];
            return (
              <li key={i.id} className="space-y-3 rounded-xl border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">{typeLabels[i.type] ?? plain(i.type)}</span>
                      <StatusPill tone={status.tone}>{status.label}</StatusPill>
                      {priority && <StatusPill tone={priority.tone}>{priority.label}</StatusPill>}
                    </div>
                    <h3 className="font-semibold">{i.title}</h3>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">{formatDate(i.createdAt)}</span>
                </div>

                {i.description && (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{i.description}</p>
                )}

                {i.link && (
                  <Link href={i.link.href} className="inline-block text-sm font-medium underline">
                    Open {i.link.label}
                  </Link>
                )}

                {i.resolution && (
                  <div className="rounded-md border border-green-200 bg-green-50 p-3">
                    <p className="text-sm font-medium text-green-800">How it was fixed</p>
                    <p className="text-sm text-green-800">{i.resolution}</p>
                  </div>
                )}

                {i.status !== "resolved" &&
                  (resolvingId === i.id ? (
                    <div className="space-y-2">
                      <label htmlFor={`resolution-${i.id}`} className="text-sm font-medium">
                        What did you do to fix it?
                      </label>
                      <textarea
                        id={`resolution-${i.id}`}
                        className="w-full rounded-md border p-2 text-sm"
                        rows={2}
                        value={resolutionText}
                        onChange={(e) => setResolutionText(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => resolveIntervention(i.id)} disabled={!resolutionText.trim()}>
                          Mark resolved
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setResolvingId(null);
                            setResolutionText("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setResolvingId(i.id)}>
                      Resolve
                    </Button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
