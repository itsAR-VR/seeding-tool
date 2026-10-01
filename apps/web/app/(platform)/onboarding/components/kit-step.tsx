"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SHIP_COUNTRIES } from "@/lib/brand/countries";
import { buildOnboardingParams } from "./constants";

type Kit = {
  name: string;
  logoUrl: string | null;
  senderFirstName: string | null;
  productFacts: string | null;
  shipCountries: string[];
};

/**
 * Step 2: what creators get and who's writing to them. These power the gift
 * page and the suggested replies, so they're asked up front.
 */
export function KitStep({ brandName, brandId }: { brandName: string; brandId: string }) {
  const router = useRouter();
  const [kit, setKit] = useState<Kit | null>(null);
  const [sender, setSender] = useState("");
  const [facts, setFacts] = useState("");
  const [countries, setCountries] = useState<string[]>(["US"]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/brand-kit")
      .then((r) => (r.ok ? (r.json() as Promise<Kit>) : null))
      .then((data) => {
        if (!data) {
          setError("Couldn't load your brand. Refresh the page.");
          return;
        }
        setKit(data);
        setSender(data.senderFirstName ?? "");
        setFacts(data.productFacts ?? "");
        setCountries(data.shipCountries?.length ? data.shipCountries : ["US"]);
      });
  }, []);

  async function uploadLogo(file: File) {
    setUploading(true);
    setError("");
    const form = new FormData();
    form.append("logo", file);
    const res = await fetch("/api/brand-kit/logo", { method: "POST", body: form });
    const data = (await res.json().catch(() => null)) as { logoUrl?: string; error?: string } | null;
    if (res.ok && data?.logoUrl && kit) setKit({ ...kit, logoUrl: data.logoUrl });
    else setError(data?.error ?? "Couldn't upload the logo.");
    setUploading(false);
  }

  async function save() {
    if (!sender.trim()) return setError("Add the first name your emails are signed with.");
    if (!facts.trim()) return setError("Add at least one line about the gift.");
    if (countries.length === 0) return setError("Pick at least one country you ship to.");
    setSaving(true);
    setError("");
    const res = await fetch("/api/brand-kit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderFirstName: sender, productFacts: facts, shipCountries: countries }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Couldn't save. Try again.");
      setSaving(false);
      return;
    }
    router.push(`/onboarding?${buildOnboardingParams("connect", { brandName, brandId })}`);
  }

  if (!kit) {
    return (
      <section className="space-y-6">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
        <div className="h-80 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-balance">The gift and who it&apos;s from</h1>
        <p className="max-w-prose text-muted-foreground">
          Creators see this on their gift page, and suggested replies only use what you write here.
        </p>
      </div>

      <div className="space-y-6 rounded-xl border bg-card p-6">
        <div className="space-y-1.5">
          <Label htmlFor="sender">Your first name</Label>
          <Input
            id="sender"
            value={sender}
            onChange={(e) => setSender(e.target.value)}
            autoComplete="given-name"
            className="max-w-xs"
          />
          <p className="text-sm text-muted-foreground">Outreach and replies are written as you.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="facts">About the gift</Label>
          <Textarea id="facts" rows={7} value={facts} onChange={(e) => setFacts(e.target.value)} />
          <p className="text-sm text-muted-foreground">
            One fact per line: what it is, how to use it, anything creators often ask. If a creator asks something
            that isn&apos;t here, the reply leaves it for you to answer.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Where you ship gifts</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {SHIP_COUNTRIES.map(([code, label]) => (
              <label key={code} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={countries.includes(code)}
                  onChange={(e) =>
                    setCountries(e.target.checked ? [...countries, code] : countries.filter((c) => c !== code))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <p className="text-sm font-medium">Logo (optional)</p>
          <div className="flex items-center gap-4">
            {kit.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={kit.logoUrl} alt={`${kit.name} logo`} className="h-10 w-auto rounded border bg-white p-1" />
            )}
            <label className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
              {uploading ? "Uploading..." : kit.logoUrl ? "Replace logo" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadLogo(file);
                }}
              />
            </label>
          </div>
          <p className="text-sm text-muted-foreground">Shown on the pages creators open.</p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          onClick={() => router.push(`/onboarding?${buildOnboardingParams("brand", { brandName, brandId })}`)}
          disabled={saving}
        >
          Back
        </Button>
        <Button className="flex-1 sm:flex-none" onClick={() => void save()} disabled={saving || uploading}>
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </section>
  );
}
