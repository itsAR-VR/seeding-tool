"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = searchParams.get("step") ?? "brand";

  return (
    <div className="mx-auto max-w-2xl py-12">
      {/* Progress indicator */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {["brand", "connect", "done"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s === step
                  ? "bg-primary text-primary-foreground"
                  : i < ["brand", "connect", "done"].indexOf(step)
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && (
              <div className="h-px w-12 bg-border" />
            )}
          </div>
        ))}
      </div>

      {step === "brand" && <BrandStep />}
      {step === "connect" && <ConnectStep />}
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Brand name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), websiteUrl: websiteUrl.trim() || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create brand");
      }

      router.push("/onboarding?step=connect");
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
          Tell us about your brand to get started with Seed Scale.
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
              onChange={(e) => setName(e.target.value)}
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
              onChange={(e) => setWebsiteUrl(e.target.value)}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Creating…" : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ConnectStep() {
  const router = useRouter();
  const [shopifyToast, setShopifyToast] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your store</CardTitle>
        <CardDescription>
          Connect Shopify to automate product seeding and order fulfillment.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => {
            setShopifyToast(true);
            setTimeout(() => setShopifyToast(false), 3000);
          }}
        >
          🛍️ Connect Shopify
        </Button>
        {shopifyToast && (
          <p className="text-sm text-muted-foreground">
            Shopify integration coming soon! You can skip this step for now.
          </p>
        )}
        <div className="flex gap-2 pt-4">
          <Button
            variant="ghost"
            onClick={() => router.push("/onboarding?step=brand")}
          >
            Back
          </Button>
          <Button
            className="flex-1"
            onClick={() => router.push("/onboarding?step=done")}
          >
            {shopifyToast ? "Skip for now" : "Continue"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DoneStep() {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;re all set! 🎉</CardTitle>
        <CardDescription>
          Your brand is ready. Head to the dashboard to start your first
          campaign.
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
