"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, FlaskConical, Link2, Sparkles, WandSparkles } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  GroupedCategoryPicker,
  type CategoryGroups,
  type CategorySelection,
} from "@/components/grouped-category-picker";
import type { BrandProfileSnapshot } from "@/lib/brands/profile";

const ONBOARDING_STEPS = ["brand", "discovery", "connect", "done"] as const;

const EMPTY_CATEGORIES: CategoryGroups = {
  apify: [],
  collabstr: [],
};

const EMPTY_SELECTION: CategorySelection = {
  apify: [],
  collabstr: [],
};

const BRAND_ENTRY_PILLARS = [
  {
    step: "1",
    title: "Ingest the site",
    description: "Scrape the homepage, capture metadata, and pull the strongest on-page signals.",
    icon: Link2,
  },
  {
    step: "2",
    title: "Shape the DNA",
    description: "Turn raw site evidence into a typed Business DNA with GPT-5-mini.",
    icon: FlaskConical,
  },
  {
    step: "3",
    title: "Guide discovery",
    description: "Hand step 2 a cleaner audience, tone, keywords, and visual direction.",
    icon: WandSparkles,
  },
] as const;

const BRAND_ANALYSIS_STEPS = [
  {
    label: "Opening the homepage",
    detail: "Reading the submitted URL and validating the page structure.",
  },
  {
    label: "Capturing metadata",
    detail: "Collecting titles, descriptions, open graph fields, and social previews.",
  },
  {
    label: "Pulling the hero story",
    detail: "Extracting the strongest headings and visible copy blocks.",
  },
  {
    label: "Curating image candidates",
    detail: "Keeping the most usable hero visuals and filtering junk assets.",
  },
  {
    label: "Tracing offer language",
    detail: "Finding the product, proof, and positioning signals worth keeping.",
  },
  {
    label: "Mapping the audience",
    detail: "Distilling who the brand is for and how it wants to be perceived.",
  },
  {
    label: "Resolving voice and tone",
    detail: "Turning copy patterns into a usable creator-facing voice reference.",
  },
  {
    label: "Generating discovery keywords",
    detail: "Creating supported keyword hints the next step can act on.",
  },
  {
    label: "Composing the Business DNA",
    detail: "Assembling the structured brief from the evidence instead of prose alone.",
  },
  {
    label: "Preparing your reveal",
    detail: "Packaging the strongest signals into a reviewable editorial summary.",
  },
] as const;

type OnboardingAnalysisStatus = "complete" | "partial" | "failed" | "skipped";

type BrandCreationResponse = {
  brandId: string;
  slug: string;
  brandProfile: BrandProfileSnapshot | null;
  analysisStatus: OnboardingAnalysisStatus;
  analysisNote: string | null;
};

function getStepIndex(step: string) {
  const index = ONBOARDING_STEPS.indexOf(
    step as (typeof ONBOARDING_STEPS)[number]
  );

  return index === -1 ? 0 : index;
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

function buildOnboardingParams(
  step: (typeof ONBOARDING_STEPS)[number],
  values: { brandName?: string; brandId?: string }
) {
  const params = new URLSearchParams({ step });

  if (values.brandName?.trim()) {
    params.set("brandName", values.brandName.trim());
  }

  if (values.brandId?.trim()) {
    params.set("brandId", values.brandId.trim());
  }

  return params.toString();
}

function formatKeywordsDraft(value: string[] | undefined) {
  return value?.join(", ") ?? "";
}

function parseKeywordsDraft(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    )
  );
}

function collectProfileImages(profile: BrandProfileSnapshot | null) {
  if (!profile) {
    return [];
  }

  return Array.from(
    new Set(
      [
        ...(profile.imageCandidates ?? []),
        ...(profile.heroImageCandidates ?? []),
        profile.ogImage,
        profile.twitterImage,
      ].filter((value): value is string => Boolean(value?.trim()))
    )
  );
}

function getRevealSummary(
  brandName: string,
  profile: BrandProfileSnapshot | null,
  analysisStatus: OnboardingAnalysisStatus
) {
  if (profile?.brandSummary?.trim()) {
    return profile.brandSummary;
  }

  if (profile?.description?.trim()) {
    return profile.description;
  }

  if (analysisStatus === "skipped") {
    return `${brandName} is ready for discovery setup. Add a site later to generate a richer Business DNA automatically.`;
  }

  if (analysisStatus === "failed") {
    return `${brandName} was created without a usable website analysis. Discovery can still continue with manual refinement in the next step.`;
  }

  return `${brandName} is ready for discovery. We captured the raw site signals and saved them as the foundation for later refinement.`;
}

function getAnalysisBadge(status: OnboardingAnalysisStatus) {
  if (status === "complete") {
    return "Business DNA ready";
  }

  if (status === "partial") {
    return "Raw signals saved";
  }

  if (status === "failed") {
    return "Brand created without website analysis";
  }

  return "Brand shell created";
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = searchParams.get("step") ?? "brand";
  const brandName = searchParams.get("brandName") ?? "";
  const brandId = searchParams.get("brandId") ?? "";
  const stepIndex = getStepIndex(step);
  const isBrandStep = step === "brand";
  const [reentryChecked, setReentryChecked] = useState(false);

  // Re-entry guard: if onboarding is already complete, redirect to dashboard
  useEffect(() => {
    let cancelled = false;

    async function checkOnboardingStatus() {
      try {
        const response = await fetch("/api/onboarding/status");
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && data.isComplete) {
            router.replace("/dashboard");
            return;
          }
        }
      } catch {
        // If check fails, let them continue with onboarding
      }
      if (!cancelled) {
        setReentryChecked(true);
      }
    }

    checkOnboardingStatus();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!reentryChecked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className={`mx-auto ${isBrandStep ? "max-w-6xl py-6 sm:py-8" : "max-w-2xl py-12"}`}>
      <div className={`mb-8 flex items-center justify-center gap-2 ${isBrandStep ? "text-stone-200" : ""}`}>
        {ONBOARDING_STEPS.map((entry, index) => {
          const isCurrent = index === stepIndex;
          const isComplete = index < stepIndex;

          return (
            <div key={entry} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  isBrandStep
                    ? isCurrent
                      ? "border border-[#d6df9f]/60 bg-[#d6df9f] text-[#161813]"
                      : isComplete
                        ? "border border-[#d6df9f]/40 bg-[#d6df9f]/20 text-[#d6df9f]"
                        : "border border-white/12 bg-white/5 text-stone-400"
                    : isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isComplete
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </div>
              {index < ONBOARDING_STEPS.length - 1 && (
                <div
                  className={`h-px w-12 ${
                    isBrandStep ? "bg-white/12" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      {step === "brand" && <BrandStep initialBrandName={brandName} />}
      {step === "discovery" && (
        <DiscoveryStep brandName={brandName} brandId={brandId} />
      )}
      {step === "connect" && (
        <ConnectStep brandName={brandName} brandId={brandId} />
      )}
      {step === "done" && <DoneStep />}
    </div>
  );
}

function BrandStep({ initialBrandName }: { initialBrandName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialBrandName);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [mode, setMode] = useState<"entry" | "analysis" | "reveal">("entry");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysisStep, setAnalysisStep] = useState(0);
  const [result, setResult] = useState<BrandCreationResponse | null>(null);
  const [savingEdits, setSavingEdits] = useState(false);
  const [draftBrandSummary, setDraftBrandSummary] = useState("");
  const [draftTargetAudience, setDraftTargetAudience] = useState("");
  const [draftBrandVoice, setDraftBrandVoice] = useState("");
  const [draftKeywords, setDraftKeywords] = useState("");

  const hasWebsite = Boolean(websiteUrl.trim());
  const currentAnalysisStep = BRAND_ANALYSIS_STEPS[analysisStep];
  const progressPercent = hasWebsite
    ? Math.min(14 + analysisStep * 9, 95)
    : 64;
  const revealProfile = result?.brandProfile ?? null;
  const revealImages = collectProfileImages(revealProfile);
  const revealKeywords =
    revealProfile?.keywords?.length
      ? revealProfile.keywords
      : revealProfile?.textSignals?.slice(0, 6) ?? [];
  const revealProducts = revealProfile?.keyProducts ?? [];
  const revealProofSignals = revealProfile?.proofSignals ?? [];
  const revealVisualDirection = revealProfile?.visualDirection ?? [];

  useEffect(() => {
    setDraftBrandSummary(revealProfile?.brandSummary ?? revealProfile?.description ?? "");
    setDraftTargetAudience(
      revealProfile?.targetAudience ?? revealProfile?.audience ?? ""
    );
    setDraftBrandVoice(
      revealProfile?.brandVoice ?? revealProfile?.tone ?? ""
    );
    setDraftKeywords(formatKeywordsDraft(revealProfile?.keywords));
  }, [revealProfile]);

  useEffect(() => {
    if (mode !== "analysis" || !hasWebsite) {
      setAnalysisStep(0);
      return;
    }

    const interval = setInterval(() => {
      setAnalysisStep((current) =>
        current >= BRAND_ANALYSIS_STEPS.length - 1 ? current : current + 1
      );
    }, 2800);

    return () => clearInterval(interval);
  }, [hasWebsite, mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Brand name is required");
      return;
    }

    setLoading(true);
    setMode("analysis");
    setError("");
    setResult(null);
    setAnalysisStep(0);

    try {
      const response = await fetch("/api/onboarding/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          websiteUrl: websiteUrl.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const failure = data as { error?: string };
        throw new Error(failure.error ?? "Failed to create brand");
      }

      setResult(data as BrandCreationResponse);
      setMode("reveal");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMode("entry");
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue() {
    if (!result) {
      return;
    }

    setSavingEdits(true);
    setError("");

    try {
      const response = await fetch(`/api/brands/${result.brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandSummary: draftBrandSummary.trim() || null,
          targetAudience: draftTargetAudience.trim() || null,
          brandVoice: draftBrandVoice.trim() || null,
          tone: draftBrandVoice.trim() || null,
          keywords: parseKeywordsDraft(draftKeywords),
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Failed to save Business DNA edits");
      }

      router.push(
        `/onboarding?${buildOnboardingParams("discovery", {
          brandName: name.trim(),
          brandId: result.brandId,
        })}`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save Business DNA edits"
      );
    } finally {
      setSavingEdits(false);
    }
  }

  function handleEdit() {
    setMode("entry");
    setError("");
    setResult(null);
  }

  return (
    <section className="relative overflow-hidden rounded-[36px] border border-white/8 bg-[#0b0d0b] px-5 py-6 text-stone-100 shadow-[0_48px_120px_rgba(0,0,0,0.45)] sm:px-8 sm:py-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,221,154,0.26),rgba(212,221,154,0.08)_38%,transparent_70%)] blur-2xl" />
        <div className="absolute bottom-[-8rem] right-[-5rem] h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(183,210,199,0.24),transparent_68%)] blur-2xl" />
        <div className="absolute left-[-4rem] top-1/3 h-[18rem] w-[18rem] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.06),transparent_72%)] blur-3xl" />
      </div>

      {mode === "entry" ? (
        <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-stone-300/80">
                <Sparkles className="h-3.5 w-3.5 text-[#d6df9f]" />
                Step 1 • Business DNA
              </div>
              <div className="space-y-3">
                <h1 className="max-w-[11ch] text-4xl leading-[0.95] text-stone-50 sm:text-5xl lg:text-6xl [font-family:var(--font-display)]">
                  Turn a homepage into creator-ready direction.
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-stone-300/78 sm:text-base">
                  Submit the brand website and we&apos;ll ingest the raw site signals,
                  synthesize a structured Business DNA with GPT-5-mini, and hand
                  discovery a tighter starting point.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {BRAND_ENTRY_PILLARS.map((pillar) => {
                const Icon = pillar.icon;

                return (
                  <article
                    key={pillar.title}
                    className="rounded-[28px] border border-white/8 bg-white/[0.06] p-5 backdrop-blur-sm"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#d6df9f]/35 text-xs text-[#d6df9f]">
                        {pillar.step}
                      </span>
                      <span className="rounded-2xl bg-[#d6df9f]/18 p-3 text-[#d6df9f]">
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                    <h2 className="text-xl text-stone-50 [font-family:var(--font-display)]">
                      {pillar.title}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-stone-300/74">
                      {pillar.description}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="rounded-[28px] border border-white/8 bg-black/20 p-5 text-sm leading-6 text-stone-300/78">
              <p className="font-medium text-stone-100">
                URL is optional.
              </p>
              <p className="mt-2">
                If you skip it, we&apos;ll still create the brand shell so you can
                move forward manually. Add the site later to regenerate the
                Business DNA.
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[#121612]/85 p-6 backdrop-blur-md sm:p-7"
          >
            <div className="mb-6 space-y-2">
              <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                Brand intake
              </p>
              <h2 className="text-3xl text-stone-50 [font-family:var(--font-display)]">
                Start with the source.
              </h2>
              <p className="text-sm leading-6 text-stone-300/78">
                We&apos;ll scrape the homepage, infer the niche and audience, and
                preserve the strongest images and proof points for the next step.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-stone-200">
                  Brand name
                </Label>
                <Input
                  id="name"
                  placeholder="Purdy & Figg"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  className="h-12 border-white/10 bg-black/30 text-base text-stone-50 placeholder:text-stone-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="websiteUrl" className="text-stone-200">
                  Website URL
                </Label>
                <Input
                  id="websiteUrl"
                  placeholder="https://example.com"
                  type="url"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  className="h-12 border-white/10 bg-black/30 text-base text-stone-50 placeholder:text-stone-500"
                />
              </div>
            </div>

            {error ? (
              <p className="mt-4 text-sm text-rose-300">{error}</p>
            ) : null}

            <div className="mt-7 flex flex-col gap-3">
              <Button
                type="submit"
                disabled={loading}
                className="h-12 rounded-full bg-[#d6df9f] text-[#13160f] hover:bg-[#e0e8ad]"
              >
                {loading ? "Starting analysis…" : "Generate Business DNA"}
              </Button>
              <p className="text-xs leading-5 text-stone-400">
                Typical wait: 10-28 seconds when a website is provided.
              </p>
            </div>
          </form>
        </div>
      ) : null}

      {mode === "analysis" ? (
        <div className="relative mx-auto max-w-5xl space-y-6 px-1 py-6 sm:py-10">
          <div className="mx-auto max-w-2xl rounded-[32px] border border-white/10 bg-[#121612]/90 px-6 py-8 text-center backdrop-blur-md sm:px-8">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#d6df9f]/25 bg-[#d6df9f]/12 px-4 py-2 text-sm text-[#d6df9f]">
              <Sparkles className="h-4 w-4 motion-safe:animate-pulse" />
              {hasWebsite ? currentAnalysisStep.label : "Creating your brand shell"}
            </div>
            <h2 className="mt-5 text-4xl leading-tight text-stone-50 sm:text-5xl [font-family:var(--font-display)]">
              {hasWebsite ? "Composing your Business DNA" : "Creating your brand"}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-stone-300/78 sm:text-base">
              {hasWebsite
                ? "We’re reading the site, extracting the strongest signals, and packaging them into a typed brief discovery can use immediately."
                : "We’re creating the brand shell now. You can add a website later to generate the richer DNA automatically."}
            </p>

            <div className="mx-auto mt-6 max-w-xl rounded-[24px] border border-white/8 bg-black/20 p-4 text-left">
              <div className="flex items-center justify-between gap-4 text-sm text-stone-300/78">
                <span>{hasWebsite ? websiteUrl.trim() : name.trim()}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[#d6df9f] transition-[width] duration-700"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-stone-400" aria-live="polite">
                {hasWebsite
                  ? currentAnalysisStep.detail
                  : "No site supplied, so we’ll skip the scrape and move you into discovery with a clean brand shell."}
              </p>
            </div>
          </div>

          {hasWebsite ? (
            <div className="grid gap-3 md:grid-cols-2">
              {BRAND_ANALYSIS_STEPS.map((step, index) => {
                const isActive = index === analysisStep;
                const isComplete = index < analysisStep;

                return (
                  <div
                    key={step.label}
                    className={`rounded-[24px] border px-4 py-4 transition-colors ${
                      isActive
                        ? "border-[#d6df9f]/40 bg-[#d6df9f]/10"
                        : isComplete
                          ? "border-white/10 bg-white/[0.05]"
                          : "border-white/6 bg-black/10"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                          isActive || isComplete
                            ? "bg-[#d6df9f] text-[#161813]"
                            : "bg-white/8 text-stone-400"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-stone-100">
                          {step.label}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-stone-400">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "reveal" && result ? (
        <div className="relative space-y-6">
          <div className="space-y-4 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d6df9f]/25 bg-[#d6df9f]/12 px-4 py-2 text-sm text-[#d6df9f]">
              <Sparkles className="h-4 w-4" />
              {getAnalysisBadge(result.analysisStatus)}
            </div>
            <h2 className="text-4xl leading-tight text-stone-50 sm:text-5xl [font-family:var(--font-display)]">
              Your Business DNA
            </h2>
            <p className="mx-auto max-w-3xl text-sm leading-6 text-stone-300/78 sm:text-base">
              {getRevealSummary(name.trim(), revealProfile, result.analysisStatus)}
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.96fr_1.04fr]">
            <div className="space-y-5">
              <section className="rounded-[32px] border border-white/10 bg-[#121612]/88 p-6 backdrop-blur-sm">
                <div className="flex flex-wrap items-center gap-3 text-sm text-stone-300/78">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-stone-100">
                    {name.trim()}
                  </span>
                  {revealProfile?.domain ? (
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">
                      {revealProfile.domain}
                    </span>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <RevealMetric
                    label="Niche"
                    value={revealProfile?.niche ?? revealProfile?.category}
                  />
                  <RevealMetric
                    label="Audience"
                    value={revealProfile?.targetAudience}
                  />
                  <RevealMetric
                    label="Voice"
                    value={revealProfile?.brandVoice ?? revealProfile?.tone}
                  />
                  <RevealMetric
                    label="Status"
                    value={getAnalysisBadge(result.analysisStatus)}
                  />
                </div>

                {result.analysisNote ? (
                  <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-stone-300/80">
                    {result.analysisNote}
                  </div>
                ) : null}
              </section>

              <section className="rounded-[32px] border border-white/10 bg-[#121612]/88 p-6 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl text-stone-50 [font-family:var(--font-display)]">
                      Refine the brief
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-stone-300/78">
                      Tighten the summary, audience, voice, and keywords before
                      discovery uses them.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-400">
                    Core 4 only
                  </span>
                </div>

                <div className="mt-6 grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="brandSummary" className="text-stone-200">
                      Brand summary
                    </Label>
                    <Textarea
                      id="brandSummary"
                      value={draftBrandSummary}
                      onChange={(event) => setDraftBrandSummary(event.target.value)}
                      className="min-h-28 border-white/10 bg-black/20 text-stone-50 placeholder:text-stone-500"
                      placeholder="Concise editorial summary of what the brand is and how it should feel."
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="targetAudience" className="text-stone-200">
                        Target audience
                      </Label>
                      <Input
                        id="targetAudience"
                        value={draftTargetAudience}
                        onChange={(event) =>
                          setDraftTargetAudience(event.target.value)
                        }
                        className="h-12 border-white/10 bg-black/20 text-stone-50 placeholder:text-stone-500"
                        placeholder="Who this brand is for"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="brandVoice" className="text-stone-200">
                        Brand voice / tone
                      </Label>
                      <Textarea
                        id="brandVoice"
                        value={draftBrandVoice}
                        onChange={(event) => setDraftBrandVoice(event.target.value)}
                        className="min-h-28 border-white/10 bg-black/20 text-stone-50 placeholder:text-stone-500"
                        placeholder="Quiet luxury, modern wellness, warm and assured…"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="keywords" className="text-stone-200">
                      Keywords
                    </Label>
                    <Textarea
                      id="keywords"
                      value={draftKeywords}
                      onChange={(event) => setDraftKeywords(event.target.value)}
                      className="min-h-24 border-white/10 bg-black/20 text-stone-50 placeholder:text-stone-500"
                      placeholder="Sleep wellness, mouth tape, recovery routine"
                    />
                    <p className="text-xs leading-5 text-stone-400">
                      Separate keywords with commas or line breaks.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[32px] border border-white/10 bg-[#121612]/88 p-6 backdrop-blur-sm">
                <h3 className="text-2xl text-stone-50 [font-family:var(--font-display)]">
                  Signals we kept
                </h3>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <RevealList
                    title="Key products"
                    items={revealProducts}
                    empty="No primary products were resolved from the site."
                  />
                  <RevealList
                    title="Proof signals"
                    items={revealProofSignals}
                    empty="No explicit proof points were captured from the site copy."
                  />
                  <RevealList
                    title="Keywords"
                    items={revealKeywords}
                    empty="No keyword hints were available yet."
                  />
                  <RevealList
                    title="Visual direction"
                    items={revealVisualDirection}
                    empty="Visual direction will sharpen as more brand assets land."
                  />
                </div>
              </section>
            </div>

            <section className="rounded-[32px] border border-white/10 bg-[#121612]/88 p-6 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl text-stone-50 [font-family:var(--font-display)]">
                    Image review
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-stone-300/78">
                    These are the strongest visual candidates we found for the
                    brand snapshot that discovery will build on.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-400">
                  {revealImages.length} assets
                </span>
              </div>

              {revealImages.length > 0 ? (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {revealImages.map((image, index) => (
                    <article
                      key={image}
                      className="group overflow-hidden rounded-[24px] border border-white/8 bg-black/20"
                    >
                      <div className="aspect-[4/4.4] overflow-hidden bg-[#0f120f]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={image}
                          alt={`${name.trim()} reference ${index + 1}`}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="px-3 py-3 text-xs text-stone-400">
                        {revealProfile?.ogImage && image === revealProfile.ogImage
                          ? "Open Graph image"
                          : revealProfile?.twitterImage &&
                              image === revealProfile.twitterImage
                            ? "Twitter image"
                            : "Hero candidate"}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-[24px] border border-dashed border-white/10 bg-black/15 px-5 py-8 text-sm leading-6 text-stone-300/75">
                  We didn&apos;t get a usable gallery from the submitted page, but the
                  written signals are saved and discovery can still continue.
                </div>
              )}
            </section>
          </div>

          {error ? (
            <div className="rounded-[24px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              onClick={handleEdit}
              className="border border-white/10 bg-white/5 text-stone-200 hover:bg-white/10 hover:text-white"
            >
              Edit brand inputs
            </Button>
            <Button
              onClick={handleContinue}
              disabled={savingEdits}
              className="h-12 rounded-full bg-[#d6df9f] px-6 text-[#13160f] hover:bg-[#e0e8ad]"
            >
              {savingEdits ? "Saving and continuing…" : "Continue to discovery"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function RevealMetric({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/18 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
        {label}
      </p>
      <p className="mt-3 text-sm leading-6 text-stone-100">
        {value?.trim() || "Not resolved from the submitted inputs."}
      </p>
    </div>
  );
}

function RevealList({
  title,
  items,
  empty,
}: {
  title: string;
  items: string[];
  empty: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/18 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.22em] text-stone-400">
        {title}
      </p>
      {items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-100">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-[0.55rem] h-1.5 w-1.5 rounded-full bg-[#d6df9f]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm leading-6 text-stone-300/75">{empty}</p>
      )}
    </div>
  );
}

function DiscoveryStep({
  brandName,
  brandId,
}: {
  brandName: string;
  brandId: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryGroups>(EMPTY_CATEGORIES);
  const [selectedCategories, setSelectedCategories] =
    useState<CategorySelection>(EMPTY_SELECTION);
  const [suggestedLabels, setSuggestedLabels] = useState<string[]>([]);
  const [profileDomain, setProfileDomain] = useState<string | null>(null);
  const [dailyTarget, setDailyTarget] = useState("50");
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setLoadingCategories(true);
      try {
        const url = brandId
          ? `/api/onboarding/discovery-defaults?brandId=${encodeURIComponent(brandId)}`
          : "/api/onboarding/discovery-defaults";
        const response = await fetch(url);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Failed to load categories");
        }

        const data = (await response.json()) as {
          categories: CategoryGroups;
          suggestedCategories: CategorySelection;
          suggestedLabels: string[];
          profileSummary: {
            domain: string | null;
            title: string | null;
          };
        };
        if (!cancelled) {
          setCategories(data.categories);
          setSuggestedLabels(data.suggestedLabels);
          setProfileDomain(data.profileSummary.domain);
          setSelectedCategories((current) => {
            if (current.apify.length > 0 || current.collabstr.length > 0) {
              return current;
            }
            return data.suggestedCategories;
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load categories"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCategories(false);
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [brandId]);

  const totalSelected =
    selectedCategories.apify.length + selectedCategories.collabstr.length;
  const parsedTarget = useMemo(
    () => parsePositiveInteger(dailyTarget),
    [dailyTarget]
  );
  const warning =
    parsedTarget.value && parsedTarget.value > 100
      ? "Values above 100 are allowed, but expect heavier daily discovery volume."
      : null;

  async function handleContinue() {
    if (parsedTarget.error) {
      setError(parsedTarget.error);
      return;
    }

    if (totalSelected === 0) {
      setError("Select at least one category before continuing.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandId: brandId || undefined,
          name: `Discovery – ${brandName || "Brand"}`,
          type: "creator_discovery",
          schedule: "daily",
          config: {
            platform: "instagram",
            searchMode: "hashtag",
            limit: parsedTarget.value,
            autoImport: true,
            categories: selectedCategories,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to create automation");
      }

      router.push(
        `/onboarding?${buildOnboardingParams("connect", {
          brandName,
          brandId,
        })}`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create automation"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up discovery</CardTitle>
        <CardDescription>
          We matched supported discovery keywords from your site. Refine them if
          needed, then set the daily volume for your first creator automation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {suggestedLabels.length > 0 ? (
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">
              Suggested from {profileDomain ?? "your website"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              These keywords were auto-selected from your website copy and brand
              signals. You can remove anything that doesn&apos;t fit.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestedLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-full border bg-background px-3 py-1 text-xs text-foreground/80"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="dailyTarget">Creators per day</Label>
          <Input
            id="dailyTarget"
            type="number"
            min={1}
            step={1}
            value={dailyTarget}
            onChange={(event) => setDailyTarget(event.target.value)}
          />
          {parsedTarget.error ? (
            <p className="text-sm text-destructive">{parsedTarget.error}</p>
          ) : warning ? (
            <p className="text-sm text-amber-700">{warning}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Use any positive integer. We will keep the automation live even
              above 100.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Discovery keywords</Label>
          {loadingCategories ? (
            <p className="text-sm text-muted-foreground">
              Loading supported keywords…
            </p>
          ) : (
            <GroupedCategoryPicker
              categories={categories}
              selected={selectedCategories}
              onChange={setSelectedCategories}
            />
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() =>
              router.push(
                `/onboarding?${buildOnboardingParams("brand", {
                  brandName,
                  brandId,
                })}`
              )
            }
          >
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={handleContinue}
            disabled={loadingCategories || saving || Boolean(parsedTarget.error)}
          >
            {saving ? "Creating automation…" : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectStep({
  brandName,
  brandId,
}: {
  brandName: string;
  brandId: string;
}) {
  const router = useRouter();
  const returnTo = buildOnboardingParams("done", { brandName, brandId });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your channels</CardTitle>
        <CardDescription>
          Connect Gmail and Shopify now, or finish onboarding and do it later in
          Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          Your discovery automation is ready. Connections are optional for this
          step, but adding them next will make outreach and product sync usable
          immediately.
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() =>
            router.push(
              `/settings/connections?returnTo=${encodeURIComponent(`/onboarding?${returnTo}`)}`
            )
          }
        >
          Open Connections
        </Button>
        <div className="flex gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() =>
              router.push(
                `/onboarding?${buildOnboardingParams("discovery", {
                  brandName,
                  brandId,
                })}`
              )
            }
          >
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={() =>
              router.push(
                `/onboarding?${buildOnboardingParams("done", {
                  brandName,
                  brandId,
                })}`
              )
            }
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DoneStep() {
  const router = useRouter();
  const calledRef = useRef(false);
  const [completing, setCompleting] = useState(true);
  const [error, setError] = useState("");

  // Mark onboarding complete on mount (idempotent)
  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    async function markComplete() {
      try {
        const response = await fetch("/api/onboarding/complete", {
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Failed to complete onboarding");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to complete onboarding"
        );
      } finally {
        setCompleting(false);
      }
    }

    markComplete();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;re all set! 🎉</CardTitle>
        <CardDescription>
          Your brand and discovery automation are ready. Head to the dashboard
          to start using the platform.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}
        <Button
          className="w-full"
          disabled={completing}
          onClick={() => router.push("/dashboard")}
        >
          {completing ? "Finishing setup…" : "Go to Dashboard"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          You can manage connections anytime from Settings → Connections.
        </p>
      </CardContent>
    </Card>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
