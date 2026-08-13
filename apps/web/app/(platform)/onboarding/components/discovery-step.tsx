"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  GroupedCategoryPicker,
  type CategoryGroups,
  type CategorySelection,
} from "@/components/grouped-category-picker";
import { buildOnboardingParams, parsePositiveInteger } from "./constants";

const EMPTY_CATEGORIES: CategoryGroups = {
  apify: [],
  collabstr: [],
};

const EMPTY_SELECTION: CategorySelection = {
  apify: [],
  collabstr: [],
};

export function DiscoveryStep({
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
              Loading supported keywords...
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
            {saving ? "Creating automation..." : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
