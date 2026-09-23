"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ONBOARDING_STEPS, getStepIndex } from "./components/constants";
import { Stepper } from "./components/stepper";
import { BrandStep } from "./components/brand-step";
import { DiscoveryStep } from "./components/discovery-step";
import { ConnectStep } from "./components/connect-step";
import { PresetStep } from "./components/preset-step";
import { DoneStep } from "./components/done-step";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = searchParams.get("step") ?? "brand";
  const brandName = searchParams.get("brandName") ?? "";
  const brandId = searchParams.get("brandId") ?? "";
  const stepIndex = getStepIndex(step);
  const isBrandStep = step === "brand";
  const [reentryChecked, setReentryChecked] = useState(false);
  const [noAccess, setNoAccess] = useState(false);

  // Re-entry guard: if onboarding is already complete, redirect to dashboard
  // Exception: allow re-entry to the "connect" step so users can add connections
  // after completing onboarding (avoids circular redirect with /settings/connections)
  useEffect(() => {
    let cancelled = false;

    async function checkOnboardingStatus() {
      try {
        const response = await fetch("/api/onboarding/status");
        if (response.ok) {
          const data = await response.json();
          if (!cancelled && data.isComplete && step !== "connect") {
            router.replace("/dashboard");
            return;
          }
          // Kalm's instance is invite-only: someone without a brand membership
          // is told to ask for access instead of being walked into creating a brand.
          if (!cancelled && data.hasBrand === false) {
            setNoAccess(true);
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
  }, [router, step]);

  if (!reentryChecked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (noAccess) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-xl font-semibold">You don&apos;t have access to Kalm yet</h1>
        <p className="text-muted-foreground">Ask Kam to add you to the creator seeding workspace.</p>
      </div>
    );
  }

  return (
    <div className={`mx-auto ${isBrandStep ? "max-w-6xl py-6 sm:py-8" : "max-w-2xl py-12"}`}>
      <Stepper stepIndex={stepIndex} isBrandStep={isBrandStep} />

      {step === "brand" && <BrandStep initialBrandName={brandName} />}
      {step === "discovery" && (
        <DiscoveryStep brandName={brandName} brandId={brandId} />
      )}
      {step === "connect" && (
        <ConnectStep brandName={brandName} brandId={brandId} />
      )}
      {step === "preset" && (
        <PresetStep brandName={brandName} brandId={brandId} />
      )}
      {step === "done" && <DoneStep />}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
