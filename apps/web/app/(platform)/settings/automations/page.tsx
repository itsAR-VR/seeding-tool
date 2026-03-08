"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Automation = {
  id: string;
  name: string;
  type: string;
  schedule: string;
  config: {
    searchMode?: "hashtag" | "profile";
    hashtag?: string;
    usernames?: string[];
    limit?: number;
    platform?: string;
    autoImport?: boolean;
  };
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
};

const scheduleLabels: Record<string, string> = {
  every_6h: "Every 6 hours",
  every_12h: "Every 12 hours",
  daily: "Daily",
  weekly: "Weekly",
};

const scheduleOptions = [
  { value: "every_6h", label: "Every 6 hours" },
  { value: "every_12h", label: "Every 12 hours" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

function formatDateTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [formName, setFormName] = useState("");
  const [formSchedule, setFormSchedule] = useState("daily");
  const [formSearchMode, setFormSearchMode] = useState<"hashtag" | "profile">(
    "hashtag"
  );
  const [formHashtag, setFormHashtag] = useState("");
  const [formUsernames, setFormUsernames] = useState("");
  const [formLimit, setFormLimit] = useState(50);
  const [formAutoImport, setFormAutoImport] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/automations");
      if (res.ok) {
        const data = await res.json();
        setAutomations(data.automations);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
  }, [fetchAutomations]);

  async function createAutomation() {
    setCreating(true);
    try {
      const config: Record<string, unknown> = {
        searchMode: formSearchMode,
        platform: "instagram",
        limit: formLimit,
        autoImport: formAutoImport,
      };

      if (formSearchMode === "hashtag") {
        config.hashtag = formHashtag.replace(/^#/, "").trim();
      } else {
        config.usernames = formUsernames
          .split(",")
          .map((u) => u.trim().replace(/^@/, ""))
          .filter(Boolean);
      }

      const res = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          type: "creator_discovery",
          schedule: formSchedule,
          config,
        }),
      });

      if (res.ok) {
        setShowCreateModal(false);
        resetForm();
        fetchAutomations();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create automation");
      }
    } catch {
      alert("Failed to create automation");
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(automation: Automation) {
    try {
      const res = await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !automation.enabled }),
      });

      if (res.ok) {
        fetchAutomations();
      }
    } catch {
      // ignore
    }
  }

  async function deleteAutomation(id: string) {
    if (!confirm("Are you sure you want to delete this automation?")) return;

    try {
      const res = await fetch(`/api/automations/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        fetchAutomations();
      }
    } catch {
      // ignore
    }
  }

  function resetForm() {
    setFormName("");
    setFormSchedule("daily");
    setFormSearchMode("hashtag");
    setFormHashtag("");
    setFormUsernames("");
    setFormLimit(50);
    setFormAutoImport(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
          <p className="text-muted-foreground">
            Schedule recurring tasks like creator discovery.
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
        >
          + New Automation
        </Button>
      </div>

      {/* Automations List */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No automations yet. Create one to start scheduling recurring
              creator searches.
            </p>
            <Button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
            >
              Create Your First Automation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {automations.map((automation) => (
            <Card key={automation.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{automation.name}</h3>
                      <Badge
                        variant={
                          automation.enabled ? "default" : "secondary"
                        }
                      >
                        {automation.enabled ? "Active" : "Paused"}
                      </Badge>
                      <Badge variant="outline">{automation.type}</Badge>
                    </div>

                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        <strong>Schedule:</strong>{" "}
                        {scheduleLabels[automation.schedule] ||
                          automation.schedule}
                      </p>

                      {automation.config.searchMode === "hashtag" &&
                        automation.config.hashtag && (
                          <p>
                            <strong>Hashtag:</strong> #
                            {automation.config.hashtag}
                          </p>
                        )}

                      {automation.config.searchMode === "profile" &&
                        automation.config.usernames && (
                          <p>
                            <strong>Usernames:</strong>{" "}
                            {automation.config.usernames.join(", ")}
                          </p>
                        )}

                      {automation.config.limit && (
                        <p>
                          <strong>Max results:</strong>{" "}
                          {automation.config.limit}
                        </p>
                      )}

                      <p>
                        <strong>Last run:</strong>{" "}
                        {formatDateTime(automation.lastRunAt)}
                      </p>
                      <p>
                        <strong>Next run:</strong>{" "}
                        {automation.enabled
                          ? formatDateTime(automation.nextRunAt)
                          : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleEnabled(automation)}
                    >
                      {automation.enabled ? "Pause" : "Resume"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() => deleteAutomation(automation.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Automation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto py-8">
          <Card className="w-full max-w-lg mx-4">
            <CardHeader>
              <CardTitle>New Automation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="e.g. Daily Skincare Creator Search"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <div>
                  <Badge variant="default">Creator Discovery</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  More automation types coming soon.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Frequency</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={formSchedule}
                  onChange={(e) => setFormSchedule(e.target.value)}
                >
                  {scheduleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Search Mode</label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={
                      formSearchMode === "hashtag" ? "default" : "outline"
                    }
                    onClick={() => setFormSearchMode("hashtag")}
                  >
                    By Hashtag
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      formSearchMode === "profile" ? "default" : "outline"
                    }
                    onClick={() => setFormSearchMode("profile")}
                  >
                    By Usernames
                  </Button>
                </div>
              </div>

              {formSearchMode === "hashtag" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hashtag</label>
                  <Input
                    placeholder="e.g. skincare"
                    value={formHashtag}
                    onChange={(e) => setFormHashtag(e.target.value)}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Usernames (comma-separated)
                  </label>
                  <textarea
                    className="w-full rounded-md border px-3 py-2 text-sm min-h-[60px]"
                    placeholder="user1, user2, user3"
                    value={formUsernames}
                    onChange={(e) => setFormUsernames(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Max Results: {formLimit}
                </label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={10}
                  value={formLimit}
                  onChange={(e) => setFormLimit(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoImport"
                  checked={formAutoImport}
                  onChange={(e) => setFormAutoImport(e.target.checked)}
                />
                <label htmlFor="autoImport" className="text-sm">
                  Auto-import discovered creators
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createAutomation}
                  disabled={
                    !formName.trim() ||
                    (formSearchMode === "hashtag" && !formHashtag.trim()) ||
                    (formSearchMode === "profile" &&
                      !formUsernames.trim()) ||
                    creating
                  }
                >
                  {creating ? "Creating…" : "Create Automation"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
