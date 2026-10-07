"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { buildOnboardingParams, normalizeStep } from "./components/constants";
import { Stepper } from "./components/stepper";
import { BrandStep } from "./components/brand-step";
import { KitStep } from "./components/kit-step";
import { ConnectStep } from "./components/connect-step";
import { Button } from "@/components/ui/button";

type Status = {
  isComplete: boolean;
  hasBrand: boolean;
  canCreateBrand?: boolean;
  companyName?: string | null;
  /** The company being set up. Always from the server, never the URL. */
  brandId?: string;
  brandName?: string;
  websiteUrl?: string | null;
};

type LoadState = { kind: "loading" } | { kind: "error" } | { kind: "ready"; status: Status };

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
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/onboarding/status")
      .then(async (r) => {
        if (r.status === 401) {
          router.replace("/login");
          return null;
        }
        // No account here and no invite to accept.
        if (r.status === 404) return { isComplete: false, hasBrand: false, canCreateBrand: false } as Status;
        if (!r.ok) throw new Error("status failed");
        return (await r.json()) as Status;
      })
      .then((data) => {
        if (cancelled || !data) return;
        // Finished companies go Home; the Accounts step stays reachable for adding connections.
        if (data.isComplete && step !== "connect") {
          router.replace("/dashboard");
          return;
        }
        // Steps 2 and 3 need a saved brand. Without one (a typed or old link),
        // start at step 1 instead of showing a step that can't load.
        if (!data.isComplete && !data.brandId && step !== "brand") {
          router.replace(`/onboarding?${buildOnboardingParams("brand", {})}`);
          return;
        }
        setState({ kind: "ready", status: data });
      })
      .catch(() => !cancelled && setState({ kind: "error" }));
    return () => {
      cancelled = true;
    };
  }, [router, step, attempt]);

  if (state.kind === "loading") return <Loading />;

  if (state.kind === "error") {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center gap-3 py-12">
        <h1 className="text-2xl font-semibold">We couldn&apos;t load your setup</h1>
        <p className="text-muted-foreground">Check your connection, then try again. Nothing you saved is lost.</p>
        <div>
          <Button
            onClick={() => {
              setState({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  const { status } = state;

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

  // The brand comes from the server. A brandId typed into the URL is ignored.
  const brandId = status.brandId ?? "";
  const brandName = status.brandName ?? searchParams.get("brandName") ?? "";

  return (
    <div className="mx-auto max-w-2xl min-w-0 py-6 sm:py-14">
      <Stepper current={step} />
      {step === "brand" && (
        <BrandStep
          key={brandId || "new"}
          initialBrandName={brandName || status.companyName || ""}
          initialWebsiteUrl={status.websiteUrl ?? ""}
        />
      )}
      {step === "kit" && <KitStep brandName={brandName} />}
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
