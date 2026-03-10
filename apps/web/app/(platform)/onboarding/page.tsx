"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
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
import { ConnectionsContent } from "../settings/connections/page";
import {
  GroupedCategoryPicker,
  type CategoryGroups,
  type CategorySelection,
} from "@/components/grouped-category-picker";

const ONBOARDING_STEPS = ["brand", "discovery", "connect", "done"] as const;

const EMPTY_CATEGORIES: CategoryGroups = {
  apify: [],
  collabstr: [],
};

const EMPTY_SELECTION: CategorySelection = {
  apify: [],
  collabstr: [],
};

const BRAND_ANALYSIS_STEPS = [
  "Reading your website",
  "Pulling brand signals",
  "Matching supported creator keywords",
] as const;

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

function OnboardingContent() {
  const searchParams = useSearchParams();
  const step = searchParams.get("step") ?? "brand";
  const brandName = searchParams.get("brandName") ?? "";
  const brandId = searchParams.get("brandId") ?? "";
  const stepIndex = getStepIndex(step);

  return (
    <div className="mx-auto max-w-2xl py-12">
      <div className="mb-8 flex items-center justify-center gap-2">
        {ONBOARDING_STEPS.map((entry, index) => (
          <div key={entry} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                index === stepIndex
                  ? "bg-primary text-primary-foreground"
                  : index < stepIndex
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}
            </div>
            {index < ONBOARDING_STEPS.length - 1 && (
              <div className="h-px w-12 bg-border" />
            )}
          </div>
        ))}
      </div>

      {step === "brand" && <BrandStep />}
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

function BrandStep() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    if (!loading || !websiteUrl.trim()) {
      setAnalysisStep(0);
      return;
    }

    const interval = setInterval(() => {
      setAnalysisStep((current) => (current + 1) % BRAND_ANALYSIS_STEPS.length);
    }, 1300);

    return () => clearInterval(interval);
  }, [loading, websiteUrl]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Brand name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/onboarding/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          websiteUrl: websiteUrl.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to create brand");
      }

      const data = (await response.json()) as { brandId?: string };
      const params = new URLSearchParams({
        step: "discovery",
        brandName: name.trim(),
        ...(data.brandId ? { brandId: data.brandId } : {}),
      });
      router.push(`/onboarding?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your brand</CardTitle>
        <CardDescription>
          Tell us about your brand so discovery can start from the right niche.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Brand name</Label>
            <Input
              id="name"
              placeholder="My Awesome Brand"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="websiteUrl">Website URL (optional)</Label>
            <Input
              id="websiteUrl"
              placeholder="https://example.com"
              type="url"
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {loading && websiteUrl.trim() ? (
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    {BRAND_ANALYSIS_STEPS[analysisStep]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We&apos;re scraping your site and preparing supported discovery
                    keywords for onboarding.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {BRAND_ANALYSIS_STEPS.map((_, index) => (
                    <span
                      key={index}
                      className={`h-2.5 w-2.5 rounded-full transition-all ${
                        index === analysisStep
                          ? "scale-110 bg-foreground"
                          : "bg-foreground/25"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                {BRAND_ANALYSIS_STEPS.map((step, index) => (
                  <div
                    key={step}
                    className={`rounded-lg border px-3 py-2 ${
                      index === analysisStep ? "bg-background text-foreground" : ""
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <Button type="submit" disabled={loading} className="w-full">
            {loading
              ? websiteUrl.trim()
                ? "Analyzing website…"
                : "Creating…"
              : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
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
        const response = await fetch("/api/onboarding/discovery-defaults");
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
  }, []);

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

      const params = new URLSearchParams({
        step: "connect",
        ...(brandName ? { brandName } : {}),
        ...(brandId ? { brandId } : {}),
      });
      router.push(`/onboarding?${params.toString()}`);
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
            onClick={() => router.push("/onboarding?step=brand")}
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
  const doneParams = new URLSearchParams({
    step: "done",
    ...(brandName ? { brandName } : {}),
    ...(brandId ? { brandId } : {}),
  });
  const discoveryParams = new URLSearchParams({
    step: "discovery",
    ...(brandName ? { brandName } : {}),
    ...(brandId ? { brandId } : {}),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connect your channels</CardTitle>
          <CardDescription>
            Connect Gmail, Shopify, Instagram, and Unipile here. Manual setup is
            available where we support it today, and every provider includes a
            guided help panel for the credentials or steps you will need.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            Your discovery automation is ready. Connections are optional for this
            step, but adding them now will make outreach, DMs, and product sync
            usable immediately.
          </div>
          <ConnectionsContent
            embedded
            brandIdOverride={brandId || undefined}
            initialReturnTo={`/onboarding?${doneParams.toString()}`}
            showSupportCta
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() =>
                router.push(
                  `/settings/connections?${new URLSearchParams({
                    returnTo: `/onboarding?${doneParams.toString()}`,
                    ...(brandId ? { brandId } : {}),
                  }).toString()}`
                )
              }
            >
              Open full connections page
            </Button>
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => {
                router.push(`/onboarding?${discoveryParams.toString()}`);
              }}
            >
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={() => router.push(`/onboarding?${doneParams.toString()}`)}
            >
              Continue
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DoneStep() {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;re all set! 🎉</CardTitle>
        <CardDescription>
          Your brand and discovery automation are ready. Head to the dashboard
          to start using the platform.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button className="w-full" onClick={() => router.push("/dashboard")}>
          Go to Dashboard
        </Button>
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
