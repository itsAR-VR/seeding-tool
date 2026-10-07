"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MAX_BRAND_NAME_LENGTH,
  READING_MESSAGES,
  buildOnboardingParams,
  formatKeywordsDraft,
  parseKeywordsDraft,
  starterProductFacts,
  type BrandCreationResponse,
} from "./constants";

type Draft = { summary: string; audience: string; voice: string; keywords: string };

const EMPTY_DRAFT: Draft = { summary: "", audience: "", voice: "", keywords: "" };

/**
 * Step 1: name the brand and (optionally) give its website. The site is read
 * to pre-fill who the brand is for, how it sounds, and the words used to find
 * creators. Everything stays editable.
 */
export function BrandStep({
  initialBrandName,
  initialWebsiteUrl = "",
}: {
  initialBrandName: string;
  initialWebsiteUrl?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialBrandName);
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl);
  // Blocks a second request while one is running (double click, Enter twice).
  const busy = useRef(false);
  const [mode, setMode] = useState<"entry" | "reading" | "review">("entry");
  const [messageIndex, setMessageIndex] = useState(0);
  const [result, setResult] = useState<BrandCreationResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialBrandName) setName((current) => current || initialBrandName);
  }, [initialBrandName]);

  useEffect(() => {
    if (mode !== "reading") return;
    const timer = setInterval(
      () => setMessageIndex((i) => Math.min(i + 1, READING_MESSAGES.length - 1)),
      9000,
    );
    return () => clearInterval(timer);
  }, [mode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (!name.trim()) {
      setError("Enter your brand name.");
      return;
    }
    if (name.trim().length > MAX_BRAND_NAME_LENGTH) {
      setError(`Keep the brand name under ${MAX_BRAND_NAME_LENGTH} characters.`);
      return;
    }
    busy.current = true;
    setError("");
    setMessageIndex(0);
    setMode(websiteUrl.trim() ? "reading" : "entry");
    setSaving(true);
    try {
      const response = await fetch("/api/onboarding/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), websiteUrl: websiteUrl.trim() || undefined }),
      });
      const data = (await response.json().catch(() => null)) as (BrandCreationResponse & { error?: string }) | null;
      if (!response.ok || !data?.brandId) throw new Error(data?.error ?? "Couldn't save your brand. Try again.");
      const profile = data.brandProfile;
      setResult(data);
      setDraft({
        summary: profile?.brandSummary ?? profile?.description ?? "",
        audience: profile?.targetAudience ?? profile?.audience ?? "",
        voice: profile?.brandVoice ?? profile?.tone ?? "",
        keywords: formatKeywordsDraft(profile?.keywords),
      });
      setMode("review");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Couldn't reach Seed Scale. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Couldn't save your brand. Try again.",
      );
      setMode("entry");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  async function continueToKit() {
    if (!result || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const profileRes = await fetch(`/api/brands/${result.brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandSummary: draft.summary.trim() || null,
          targetAudience: draft.audience.trim() || null,
          brandVoice: draft.voice.trim() || null,
          tone: draft.voice.trim() || null,
          keywords: parseKeywordsDraft(draft.keywords),
        }),
      });
      if (!profileRes.ok) {
        const data = (await profileRes.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't save these details. Try again.");
      }

      // Give the next step a head start, without overwriting anything already written.
      const kit = (await fetch("/api/brand-kit")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)) as {
        brandDescription?: string | null;
        productFacts?: string | null;
      } | null;
      const prefill: Record<string, string> = {};
      if (!kit?.brandDescription && draft.summary.trim()) prefill.brandDescription = draft.summary.trim();
      if (!kit?.productFacts) prefill.productFacts = starterProductFacts(result.brandProfile, websiteUrl);
      if (Object.keys(prefill).length > 0) {
        // A head start only: if it fails, the next step is simply empty.
        await fetch("/api/brand-kit", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prefill),
        }).catch(() => undefined);
      }

      router.push(`/onboarding?${buildOnboardingParams("kit", { brandName: name.trim() })}`);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Couldn't reach Seed Scale. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Couldn't save these details. Try again.",
      );
      busy.current = false;
      setSaving(false);
    }
  }

  if (mode === "reading") {
    return (
      <section className="space-y-6" aria-live="polite">
        <h1 className="text-2xl font-bold tracking-tight text-balance break-words sm:text-3xl">Reading your website</h1>
        <div className="space-y-3 rounded-xl border bg-card p-4 sm:p-6">
          <p className="font-medium">{READING_MESSAGES[messageIndex]}...</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="onboarding-progress h-full w-1/3 rounded-full bg-foreground/70" />
          </div>
          <p className="text-sm text-muted-foreground">This usually takes under a minute. Keep this page open.</p>
        </div>
      </section>
    );
  }

  if (mode === "review" && result) {
    const fromSite = result.analysisStatus === "complete" || result.analysisStatus === "partial";
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-balance break-words sm:text-3xl">
            {fromSite ? "Here's what we learned" : `Tell us about ${name}`}
          </h1>
          <p className="max-w-prose text-muted-foreground">
            {fromSite
              ? "We filled this in from your website. Fix anything that's off. It shapes which creators we find and how replies sound."
              : result.analysisStatus === "failed"
                ? "We couldn't read your website, so fill these in yourself. A sentence each is plenty."
                : "A sentence each is plenty. It shapes which creators we find and how replies sound."}
          </p>
        </div>

        <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
          <Field id="summary" label="What you sell" hint="One or two sentences, like you'd tell a creator.">
            <Textarea
              id="summary"
              rows={3}
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
            />
          </Field>
          <Field id="audience" label="Who it's for" hint="The people whose feeds you want to be in.">
            <Textarea
              id="audience"
              rows={2}
              value={draft.audience}
              onChange={(e) => setDraft({ ...draft, audience: e.target.value })}
            />
          </Field>
          <Field id="voice" label="How you sound" hint="For example: warm, plain, a little playful.">
            <Input id="voice" value={draft.voice} onChange={(e) => setDraft({ ...draft, voice: e.target.value })} />
          </Field>
          <Field id="keywords" label="Words to find creators with" hint="Separate with commas, like: sleep, wellness, night routine.">
            <Textarea
              id="keywords"
              rows={2}
              value={draft.keywords}
              onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
            />
          </Field>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => setMode("entry")} disabled={saving}>
            Back
          </Button>
          <Button className="flex-1 sm:flex-none" onClick={() => void continueToKit()} disabled={saving}>
            {saving ? "Saving..." : "Continue"}
          </Button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-balance break-words sm:text-3xl">Set up your brand</h1>
        <p className="max-w-prose text-muted-foreground">
          Three short steps, about 10 minutes. You can change everything later in Settings.
        </p>
      </div>

      <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-6">
        <Field id="brandName" label="Brand name">
          <Input
            id="brandName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="organization"
            maxLength={MAX_BRAND_NAME_LENGTH}
            required
          />
        </Field>
        <Field id="websiteUrl" label="Website (optional)" hint="We'll read it and fill in the next part for you.">
          <Input
            id="websiteUrl"
            inputMode="url"
            autoComplete="url"
            placeholder="yourbrand.com"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
        </Field>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
