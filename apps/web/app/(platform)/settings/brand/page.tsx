"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BrandData {
  id: string;
  name: string;
  slug: string;
  websiteUrl?: string | null;
  settings?: {
    brandVoice?: string | null;
    timezone?: string | null;
    brandProfile?: {
      title?: string | null;
      description?: string | null;
      heroHeadings?: string[];
    } | null;
  } | null;
}

interface ApprovalSettings {
  approvalMode: "auto" | "recommend";
  approvalThreshold: number;
}

export default function BrandSettingsPage() {
  const [brand, setBrand] = useState<BrandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Approval settings state
  const [approvalSettings, setApprovalSettings] =
    useState<ApprovalSettings | null>(null);
  const [approvalMode, setApprovalMode] = useState<"auto" | "recommend">(
    "recommend"
  );
  const [approvalThreshold, setApprovalThreshold] = useState(0.75);
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvalError, setApprovalError] = useState("");

  const fetchApprovalSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/approval");
      if (!res.ok) return;
      const data = (await res.json()) as ApprovalSettings;
      setApprovalSettings(data);
      setApprovalMode(data.approvalMode);
      setApprovalThreshold(data.approvalThreshold);
    } catch {
      // non-fatal — approval section shows with defaults
    }
  }, []);

  useEffect(() => {
    fetchBrand();
    fetchApprovalSettings();
  }, [fetchApprovalSettings]);

  async function fetchBrand() {
    try {
      const res = await fetch("/api/brands/current");
      if (!res.ok) {
        if (res.status === 404) {
          setLoading(false);
          return;
        }
        throw new Error("Failed to load brand");
      }
      const data = (await res.json()) as BrandData;
      setBrand(data);
      setName(data.name);
      setWebsiteUrl(data.websiteUrl ?? "");

      const voice = data.settings?.brandVoice ?? "";
      const logoMatch = voice.match(/Logo URL: (.+)/);
      if (logoMatch) setLogoUrl(logoMatch[1]);
    } catch {
      setError("Failed to load brand settings");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!brand) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch(`/api/brands/${brand.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          websiteUrl: websiteUrl.trim() || undefined,
          logoUrl: logoUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }

      setMessage("Settings saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprovalSave(e: React.FormEvent) {
    e.preventDefault();
    setApprovalSaving(true);
    setApprovalMessage("");
    setApprovalError("");

    // Validate threshold
    const t = Number(approvalThreshold);
    if (isNaN(t) || t <= 0 || t > 1) {
      setApprovalError("Threshold must be between 0.01 and 1.00");
      setApprovalSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/approval", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approvalMode,
          approvalThreshold: t,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save approval settings");
      }

      const updated = (await res.json()) as ApprovalSettings;
      setApprovalSettings(updated);
      setApprovalMode(updated.approvalMode);
      setApprovalThreshold(updated.approvalThreshold);
      setApprovalMessage("Approval settings saved");
    } catch (err) {
      setApprovalError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setApprovalSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Brand Settings</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No brand found. Complete onboarding first.
            </p>
            <Button
              className="mt-4"
              onClick={() => (window.location.href = "/onboarding")}
            >
              Start Onboarding
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brand Settings</h1>
        <p className="text-muted-foreground">
          Update your brand information and preferences.
        </p>
      </div>

      {/* ── Brand Information ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Brand Information</CardTitle>
          <CardDescription>Basic details about your brand.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brandName">Brand Name</Label>
              <Input
                id="brandName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website URL</Label>
              <Input
                id="website"
                type="url"
                placeholder="https://example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                type="url"
                placeholder="https://example.com/logo.png"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </div>

            {message && <p className="text-sm text-green-600">{message}</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ── Creator Discovery — Approval Controls ────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Creator Discovery — Approval Controls</CardTitle>
          <CardDescription>
            Control how the AI-driven creator discovery pipeline handles
            approval decisions. Changes take effect on the next search run.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleApprovalSave} className="space-y-6">
            {/* Approval Mode */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Approval Mode</Label>
              <div className="space-y-3">
                {/* Recommend (default/safe) */}
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                    approvalMode === "recommend"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="approvalMode"
                    value="recommend"
                    checked={approvalMode === "recommend"}
                    onChange={() => setApprovalMode("recommend")}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium">
                      Recommend{" "}
                      <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-normal text-green-700">
                        Safer · Default
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The AI scores and ranks creators but the final
                      approve/decline is yours. All discovered creators land in
                      a pending review queue with AI reasoning attached. An
                      operator works through the queue before any creator is
                      added to a campaign.
                    </p>
                  </div>
                </label>

                {/* Auto */}
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                    approvalMode === "auto"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="approvalMode"
                    value="auto"
                    checked={approvalMode === "auto"}
                    onChange={() => setApprovalMode("auto")}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium">
                      Auto{" "}
                      <span className="ml-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-normal text-yellow-700">
                        Faster · Less oversight
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      The AI decision is final. Creators at or above the
                      threshold are immediately marked approved and become ready
                      for outreach. Creators below are declined automatically.
                      No human review step.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Approval Threshold */}
            <div className="space-y-2">
              <Label htmlFor="approvalThreshold" className="text-sm font-medium">
                Approval Threshold
              </Label>
              <div className="flex items-center gap-3">
                <input
                  id="approvalThreshold"
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.05"
                  value={approvalThreshold}
                  onChange={(e) =>
                    setApprovalThreshold(parseFloat(e.target.value))
                  }
                  className="h-2 w-full cursor-pointer accent-primary"
                />
                <span className="w-12 text-right font-mono text-sm font-semibold tabular-nums">
                  {(approvalThreshold * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Creators scoring at or above{" "}
                <strong>{(approvalThreshold * 100).toFixed(0)}%</strong> are
                considered a good fit by the AI.{" "}
                {approvalMode === "auto"
                  ? "In Auto mode, they are approved immediately."
                  : "In Recommend mode, they are flagged as higher-priority in your review queue."}
                {" "}Raise the threshold to reduce false-positives; lower it for
                broader coverage.
              </p>

              {/* Visual guide */}
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                <span>
                  🔒 <strong>Conservative (80–95%)</strong> — very tight fit
                  required, fewer creators pass
                </span>
                <span className="mx-1 text-muted-foreground/40">·</span>
                <span>
                  ⚖️ <strong>Balanced (70–80%)</strong> — recommended starting
                  point
                </span>
                <span className="mx-1 text-muted-foreground/40">·</span>
                <span>
                  📣 <strong>Broad (50–70%)</strong> — more coverage, more
                  manual filtering
                </span>
              </div>
            </div>

            {/* Current saved state */}
            {approvalSettings && (
              <div className="rounded-lg border border-muted bg-muted/20 p-3 text-xs text-muted-foreground">
                Current saved settings:{" "}
                <strong>
                  {approvalSettings.approvalMode === "recommend"
                    ? "Recommend"
                    : "Auto"}
                </strong>{" "}
                mode ·{" "}
                <strong>
                  {(approvalSettings.approvalThreshold * 100).toFixed(0)}%
                </strong>{" "}
                threshold
              </div>
            )}

            {approvalMessage && (
              <p className="text-sm text-green-600">{approvalMessage}</p>
            )}
            {approvalError && (
              <p className="text-sm text-destructive">{approvalError}</p>
            )}

            <Button type="submit" disabled={approvalSaving}>
              {approvalSaving ? "Saving…" : "Save Approval Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
