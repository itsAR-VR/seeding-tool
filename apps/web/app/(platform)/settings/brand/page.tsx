"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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

const MATCH_LEVELS: Array<{ value: number; label: string; help: string }> = [
  { value: 0.85, label: "Strict", help: "Only very close matches. Fewer creators." },
  { value: 0.75, label: "Balanced", help: "A good place to start." },
  { value: 0.6, label: "Broad", help: "More creators, more to sort through." },
];

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
  const [approvalMode, setApprovalMode] = useState<"auto" | "recommend">("recommend");
  const [approvalThreshold, setApprovalThreshold] = useState(0.75);
  const [approvalSaving, setApprovalSaving] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState("");
  const [approvalError, setApprovalError] = useState("");

  const fetchApprovalSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/approval");
      if (!res.ok) return;
      const data = (await res.json()) as ApprovalSettings;
      setApprovalMode(data.approvalMode);
      setApprovalThreshold(data.approvalThreshold);
    } catch {
      // Non-fatal: the section shows with defaults.
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
      setError("Couldn't load your brand details. Refresh the page to try again.");
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
        throw new Error(data.error ?? "Couldn't save. Check the details and try again.");
      }

      setMessage("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleApprovalSave(e: React.FormEvent) {
    e.preventDefault();
    setApprovalSaving(true);
    setApprovalMessage("");
    setApprovalError("");

    const t = Number(approvalThreshold);
    if (isNaN(t) || t <= 0 || t > 1) {
      setApprovalError("Pick how close a match should be, then save again.");
      setApprovalSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/approval", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalMode, approvalThreshold: t }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Couldn't save. Try again.");
      }

      const updated = (await res.json()) as ApprovalSettings;
      setApprovalMode(updated.approvalMode);
      setApprovalThreshold(updated.approvalThreshold);
      setApprovalMessage("Saved. This applies to your next creator search.");
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setApprovalSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Brand</h1>
        </header>
        <section className="rounded-xl border bg-card p-6 text-center">
          <p className="text-muted-foreground">
            {error || "You haven't set up your brand yet."}
          </p>
          {!error && (
            <Link
              href="/onboarding"
              className="mt-4 inline-block rounded-lg bg-foreground px-4 py-2 font-medium text-background"
            >
              Set up your brand
            </Link>
          )}
        </section>
      </div>
    );
  }

  const matchPercent = Math.round(approvalThreshold * 100);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Brand</h1>
        <p className="mt-1 text-muted-foreground">
          Your brand details and how new creators get approved.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Your brand</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="brandName">Brand name</Label>
            <Input
              id="brandName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Your logo lives in the{" "}
            <Link href="/settings/brand-kit" className="font-medium text-foreground underline">
              Brand kit
            </Link>
            , where you can upload it.
          </p>

          {message && <p className="text-sm text-green-700 dark:text-green-400">{message}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save brand details"}
          </Button>
        </form>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <div>
          <h2 className="font-semibold">New creators from search</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            When a creator search finds people, decide who approves them.
          </p>
        </div>
        <form onSubmit={handleApprovalSave} className="space-y-5">
          <fieldset className="space-y-3">
            <legend className="sr-only">Who approves new creators</legend>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                approvalMode === "recommend" ? "border-primary bg-primary/5" : "hover:bg-accent/30"
              }`}
            >
              <input
                type="radio"
                name="approvalMode"
                value="recommend"
                checked={approvalMode === "recommend"}
                onChange={() => setApprovalMode("recommend")}
                className="mt-1"
              />
              <div>
                <p className="font-medium">I review each one (recommended)</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  New creators wait for you to approve or skip them. Good matches are shown first.
                </p>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                approvalMode === "auto" ? "border-primary bg-primary/5" : "hover:bg-accent/30"
              }`}
            >
              <input
                type="radio"
                name="approvalMode"
                value="auto"
                checked={approvalMode === "auto"}
                onChange={() => setApprovalMode("auto")}
                className="mt-1"
              />
              <div>
                <p className="font-medium">Approve good matches for me</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Good matches are approved and ready to email right away. The rest are skipped. You
                  won&apos;t review them first.
                </p>
              </div>
            </label>
          </fieldset>

          <details className="rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">More options</summary>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                How close to your brand a creator needs to be to count as a good match.
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="How close a match">
                {MATCH_LEVELS.map((level) => {
                  const selected = Math.abs(approvalThreshold - level.value) < 0.001;
                  return (
                    <button
                      key={level.label}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setApprovalThreshold(level.value)}
                      className={`rounded-lg border px-4 py-2 text-left text-sm ${
                        selected ? "border-primary bg-primary/5" : "hover:bg-accent/30"
                      }`}
                    >
                      <span className="block font-medium">{level.label}</span>
                      <span className="block text-muted-foreground">{level.help}</span>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="approvalThreshold">Or set it yourself: {matchPercent}% match</Label>
                <input
                  id="approvalThreshold"
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.05"
                  value={approvalThreshold}
                  onChange={(e) => setApprovalThreshold(parseFloat(e.target.value))}
                  className="h-2 w-full cursor-pointer accent-primary"
                />
              </div>
            </div>
          </details>

          {approvalMessage && (
            <p className="text-sm text-green-700 dark:text-green-400">{approvalMessage}</p>
          )}
          {approvalError && <p className="text-sm text-destructive">{approvalError}</p>}

          <Button type="submit" disabled={approvalSaving}>
            {approvalSaving ? "Saving..." : "Save approval choice"}
          </Button>
        </form>
      </section>
    </div>
  );
}
