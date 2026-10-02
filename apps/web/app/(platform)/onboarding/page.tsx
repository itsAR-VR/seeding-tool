"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { normalizeStep } from "./components/constants";
import { Stepper } from "./components/stepper";
import { BrandStep } from "./components/brand-step";
import { KitStep } from "./components/kit-step";
import { ConnectStep } from "./components/connect-step";

type Status = { isComplete: boolean; hasBrand: boolean; canCreateBrand?: boolean; companyName?: string | null };

function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12" aria-busy="true">
      <div className="h-8 w-72 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
      <div className="h-64 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
    </div>
  );
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = normalizeStep(searchParams.get("step"));
  const brandName = searchParams.get("brandName") ?? "";
  const brandId = searchParams.get("brandId") ?? "";
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/onboarding/status")
      .then((r) =>
        r.ok
          ? (r.json() as Promise<Status>)
          : // No account here and no invite to accept.
            r.status === 404
            ? ({ isComplete: false, hasBrand: false, canCreateBrand: false } as Status)
            : null,
      )
      .then((data) => {
        if (cancelled) return;
        // Finished companies go Home; the Accounts step stays reachable for adding connections.
        if (data?.isComplete && step !== "connect") {
          router.replace("/dashboard");
          return;
        }
        setStatus(data ?? { isComplete: false, hasBrand: true });
      })
      .catch(() => !cancelled && setStatus({ isComplete: false, hasBrand: true }));
    return () => {
      cancelled = true;
    };
  }, [router, step]);

  if (!status) return <Loading />;

  if (status.hasBrand === false && !status.canCreateBrand) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center gap-2 py-12">
        <h1 className="text-2xl font-semibold">You don&apos;t have a workspace yet</h1>
        <p className="text-muted-foreground">
          Seed Scale is invite-only. Open the invite link you were emailed, or ask your team to invite you.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-10 sm:py-14">
      <Stepper current={step} />
      {step === "brand" && <BrandStep initialBrandName={brandName || status.companyName || ""} />}
      {step === "kit" && <KitStep brandName={brandName} brandId={brandId} />}
      {step === "connect" && <ConnectStep brandName={brandName} brandId={brandId} />}
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OnboardingContent />
    </Suspense>
  );
}
