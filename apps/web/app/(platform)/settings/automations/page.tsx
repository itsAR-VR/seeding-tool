"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  GroupedCategoryPicker,
  type CategoryGroups,
  type CategorySelection,
} from "@/components/grouped-category-picker";

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
    categories?: CategorySelection;
  };
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
};

const EMPTY_CATEGORIES: CategoryGroups = {
  apify: [],
  collabstr: [],
};

const EMPTY_SELECTION: CategorySelection = {
  apify: [],
  collabstr: [],
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

function parsePositiveInteger(value: string) {
  if (!value.trim()) {
    return { value: null, error: "Daily creator target is required." };
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return {
      value: null,
      error: "Daily creator target must be a positive integer.",
    };
  }

  return { value: parsed, error: null };
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [categories, setCategories] = useState<CategoryGroups>(EMPTY_CATEGORIES);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const [formName, setFormName] = useState("");
  const [formSchedule, setFormSchedule] = useState("daily");
  const [formSearchMode, setFormSearchMode] = useState<"hashtag" | "profile">(
    "hashtag"
  );
  const [formHashtag, setFormHashtag] = useState("");
  const [formUsernames, setFormUsernames] = useState("");
  const [formLimit, setFormLimit] = useState("50");
  const [formAutoImport, setFormAutoImport] = useState(true);
  const [formCategories, setFormCategories] =
    useState<CategorySelection>(EMPTY_SELECTION);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const parsedLimit = useMemo(
    () => parsePositiveInteger(formLimit),
    [formLimit]
  );
  const limitWarning =
    parsedLimit.value && parsedLimit.value > 100
      ? "Values above 100 are allowed, but expect heavier daily discovery volume."
      : null;
  const totalSelectedCategories =
    formCategories.apify.length + formCategories.collabstr.length;

  const fetchAutomations = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/automations");
      if (response.ok) {
        const data = await response.json();
        setAutomations(data.automations);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setCategoriesLoading(true);
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = (await response.json()) as CategoryGroups;
        setCategories(data);
      }
    } catch {
      // ignore
    } finally {
      setCategoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAutomations();
    fetchCategories();
  }, [fetchAutomations, fetchCategories]);

  async function createAutomation() {
    if (parsedLimit.error) {
      setFormError(parsedLimit.error);
      return;
    }

    if (
      formSearchMode === "hashtag" &&
      !formHashtag.trim() &&
      totalSelectedCategories === 0
    ) {
      setFormError(
        "Pick at least one category or provide a hashtag override."
      );
      return;
    }

    if (formSearchMode === "profile" && !formUsernames.trim()) {
      setFormError("Provide at least one username.");
      return;
    }

    setCreating(true);
    setFormError("");

    try {
      const config: Record<string, unknown> = {
        searchMode: formSearchMode,
        platform: "instagram",
        limit: parsedLimit.value,
        autoImport: formAutoImport,
        categories: formCategories,
      };

      if (formSearchMode === "hashtag" && formHashtag.trim()) {
        config.hashtag = formHashtag.replace(/^#/, "").trim();
      }

      if (formSearchMode === "profile") {
        config.usernames = formUsernames
          .split(",")
          .map((username) => username.trim().replace(/^@/, ""))
          .filter(Boolean);
      }

      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          type: "creator_discovery",
          schedule: formSchedule,
          config,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create automation");
      }

      setShowCreateModal(false);
      resetForm();
      fetchAutomations();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to create automation"
      );
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(automation: Automation) {
    try {
      const response = await fetch(`/api/automations/${automation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !automation.enabled }),
      });

      if (response.ok) {
        fetchAutomations();
      }
    } catch {
      // ignore
    }
  }

  async function deleteAutomation(id: string) {
    if (!confirm("Are you sure you want to delete this automation?")) return;

    try {
      const response = await fetch(`/api/automations/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
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
    setFormLimit("50");
    setFormAutoImport(true);
    setFormCategories(EMPTY_SELECTION);
    setFormError("");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Automations</h1>
          <p className="text-muted-foreground">
            Schedule recurring creator discovery with grouped category inputs
            and a free-form daily target.
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

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : automations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">
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
          {automations.map((automation) => {
            const categories = automation.config.categories;
            const categoryCount =
              (categories?.apify.length ?? 0) +
              (categories?.collabstr.length ?? 0);

            return (
              <Card key={automation.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{automation.name}</h3>
                        <Badge
                          variant={automation.enabled ? "default" : "secondary"}
                        >
                          {automation.enabled ? "Active" : "Paused"}
                        </Badge>
                        <Badge variant="outline">{automation.type}</Badge>
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
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
                            <strong>Creators per day:</strong>{" "}
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

                      {categoryCount > 0 && (
                        <div className="space-y-2 pt-2">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Categories
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {categories?.apify.map((value) => (
                              <Badge key={`apify-${value}`} variant="default">
                                Apify: {value}
                              </Badge>
                            ))}
                            {categories?.collabstr.map((value) => (
                              <Badge
                                key={`collabstr-${value}`}
                                variant="secondary"
                              >
                                Collabstr: {value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="ml-4 flex gap-2">
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
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 py-8">
          <Card className="mx-4 w-full max-w-2xl">
            <CardHeader>
              <CardTitle>New Automation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="e.g. Daily Skincare Creator Search"
                  value={formName}
                  onChange={(event) => setFormName(event.target.value)}
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
                  onChange={(event) => setFormSchedule(event.target.value)}
                >
                  {scheduleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Search mode</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={
                      formSearchMode === "hashtag" ? "default" : "outline"
                    }
                    onClick={() => setFormSearchMode("hashtag")}
                  >
                    By Hashtag
                  </Button>
                  <Button
                    type="button"
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Creators per day</label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={formLimit}
                  onChange={(event) => setFormLimit(event.target.value)}
                />
                {parsedLimit.error ? (
                  <p className="text-sm text-destructive">
                    {parsedLimit.error}
                  </p>
                ) : limitWarning ? (
                  <p className="text-sm text-amber-700">{limitWarning}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Use any positive integer. Values above 100 will still save.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Categories</label>
                {categoriesLoading ? (
                  <p className="text-sm text-muted-foreground">
                    Loading category sources…
                  </p>
                ) : (
                  <GroupedCategoryPicker
                    categories={categories}
                    selected={formCategories}
                    onChange={setFormCategories}
                  />
                )}
              </div>

              {formSearchMode === "hashtag" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Hashtag override (optional)
                  </label>
                  <Input
                    placeholder="e.g. skincare"
                    value={formHashtag}
                    onChange={(event) => setFormHashtag(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave this blank to derive the search term from the selected
                    categories and brand context.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Usernames (comma-separated)
                  </label>
                  <textarea
                    className="min-h-[60px] w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="user1, user2, user3"
                    value={formUsernames}
                    onChange={(event) => setFormUsernames(event.target.value)}
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoImport"
                  checked={formAutoImport}
                  onChange={(event) => setFormAutoImport(event.target.checked)}
                />
                <label htmlFor="autoImport" className="text-sm">
                  Auto-import discovered creators
                </label>
              </div>

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}

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
                    Boolean(parsedLimit.error) ||
                    categoriesLoading ||
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
