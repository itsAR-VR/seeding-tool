"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HandMetal, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildOnboardingParams } from "./constants";

const PRESET_OPTIONS = [
  {
    key: "manual" as const,
    title: "Manual",
    description:
      "You control everything. AI suggests, you decide.",
    icon: HandMetal,
  },
  {
    key: "assisted" as const,
    title: "Assisted",
    description:
      "AI scores creators, drafts replies, and creates orders. You review before sending.",
    recommended: true,
    icon: Shield,
  },
  {
    key: "autonomous" as const,
    title: "Autonomous",
    description:
      "Full automation. AI handles scoring, replies, orders, and follow-ups with minimal oversight.",
    icon: Zap,
  },
] as const;

export function PresetStep({
  brandName,
  brandId,
}: {
  brandName: string;
  brandId: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<"manual" | "assisted" | "autonomous">("assisted");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleApply() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/settings/feature-flags/preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: selected }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed to apply preset");
      }

      router.push(
        `/onboarding?${buildOnboardingParams("done", {
          brandName,
          brandId,
        })}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply preset");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choose your automation level</CardTitle>
        <CardDescription>
          Set how much the platform automates for you. You can change this
          anytime in Settings &rarr; Feature Flags.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {PRESET_OPTIONS.map((option) => {
            const isSelected = selected === option.key;
            const Icon = option.icon;

            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelected(option.key)}
                className={`relative rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/40"
                }`}
              >
                {"recommended" in option && option.recommended ? (
                  <span className="absolute -top-2.5 left-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
                    Recommended
                  </span>
                ) : null}
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-foreground/70" />
                </div>
                <h3 className="font-medium">{option.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex gap-2 pt-2">
          <Button
            variant="ghost"
            onClick={() =>
              router.push(
                `/onboarding?${buildOnboardingParams("connect", {
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
            onClick={handleApply}
            disabled={saving}
          >
            {saving ? "Applying..." : "Apply and finish"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
