"use client";

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
};

const typeLabels: Record<string, string> = {
  captcha: "🔒 Captcha",
  auth_failure: "🔑 Auth Failure",
  duplicate_order: "📦 Order Failed",
  unclear_reply: "❓ Reply Unclear",
  manual_review: "👀 Manual Review",
  other: "📋 Other",
};

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

  useEffect(() => {
    loadInterventions();
  }, [filter]);

  async function loadInterventions() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("status", filter);

      const res = await fetch(`/api/interventions?${params}`);
      if (res.ok) {
        setInterventions((await res.json()) as Intervention[]);
      }
    } catch (error) {
      console.error("Failed to load interventions:", error);
    } finally {
      setLoading(false);
    }
  }

  async function resolveIntervention(id: string) {
    if (!resolutionText.trim()) return;

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
      }
    } catch (error) {
      console.error("Failed to resolve:", error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Loading interventions…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Interventions</h1>
        <p className="text-muted-foreground">
          Review and resolve issues requiring attention
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
            {status || "All"}
          </Button>
        ))}
      </div>

      {/* Intervention list */}
      {interventions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {filter === "open"
                ? "No open interventions 🎉"
                : "No interventions found"}
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
                        {typeLabels[i.type] || `📋 ${i.type}`}
                      </span>
                      <Badge
                        className={
                          priorityColors[i.priority] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {i.priority}
                      </Badge>
                      <Badge
                        className={
                          statusColors[i.status] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {i.status}
                      </Badge>
                    </div>
                    <CardTitle className="text-base">{i.title}</CardTitle>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
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
                          placeholder="Enter resolution…"
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
