"use client";

import Link from "next/link";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

const priorityLabels: Record<string, string> = {
  low: "Low priority",
  normal: "Normal",
  high: "High priority",
  critical: "Urgent",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  reopened: "Reopened",
};

function plain(map: Record<string, string>, value: string): string {
  return map[value] ?? value.replace(/_/g, " ");
}

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  reopened: "bg-red-100 text-red-800",
};

export default function InterventionsPage() {
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("open");
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInterventions();
  }, [filter]);

  async function loadInterventions() {
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
  }

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Needs attention</h1>
        <p className="text-muted-foreground">
          Things the tool couldn&apos;t handle on its own. Open each one, sort it out, then mark it resolved.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {["open", "in_progress", "resolved", ""].map((status) => (
          <Button
            key={status || "all"}
            variant={filter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {({ open: "Open", in_progress: "In progress", resolved: "Resolved" } as Record<string, string>)[status] ?? "All"}
          </Button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Intervention list */}
      {interventions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {filter === "open"
                ? "Nothing needs your attention right now. Problems with emails, orders, or connections show up here."
                : "Nothing here."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {interventions.map((i) => (
            <Card key={i.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {plain(typeLabels, i.type)}
                      </span>
                      <Badge
                        className={
                          priorityColors[i.priority] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {plain(priorityLabels, i.priority)}
                      </Badge>
                      <Badge
                        className={
                          statusColors[i.status] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {plain(statusLabels, i.status)}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{i.title}</CardTitle>
                    {i.link && (
                      <Link href={i.link.href} className="text-sm text-blue-600 hover:underline">
                        Open {i.link.label} →
                      </Link>
                    )}
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {new Date(i.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {i.description && (
                  <p className="mb-3 whitespace-pre-wrap text-sm text-muted-foreground">
                    {i.description}
                  </p>
                )}

                {i.resolution && (
                  <div className="mb-3 rounded-md bg-green-50 p-3">
                    <p className="text-sm font-medium text-green-800">
                      Resolution:
                    </p>
                    <p className="text-sm text-green-700">{i.resolution}</p>
                  </div>
                )}

                {i.status !== "resolved" && (
                  <div>
                    {resolvingId === i.id ? (
                      <div className="space-y-2">
                        <textarea
                          className="w-full rounded-md border p-2 text-sm"
                          placeholder="What did you do to fix it?"
                          rows={2}
                          value={resolutionText}
                          onChange={(e) =>
                            setResolutionText(e.target.value)
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              resolveIntervention(i.id)
                            }
                            disabled={!resolutionText.trim()}
                          >
                            Resolve
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
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setResolvingId(i.id)}
                      >
                        Resolve
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
