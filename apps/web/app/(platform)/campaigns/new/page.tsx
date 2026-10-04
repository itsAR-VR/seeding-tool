"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null while checking; true/false once we know if Shopify is connected.
  const [shopifyConnected, setShopifyConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/connections/shopify/status")
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { connected?: boolean } | null;
        if (!cancelled) setShopifyConnected(res.ok ? Boolean(data?.connected) : null);
      })
      .catch(() => {
        // Unknown is fine: the form still works, we just skip the hint.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't create the campaign. Try again.");
      }

      const campaign = (await res.json()) as { id: string };
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the campaign. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <span aria-hidden>←</span>
          Campaigns
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">New campaign</h1>
        <p className="mt-1 text-muted-foreground">
          Name it now. Next you&apos;ll pick the product you&apos;re gifting and find creators.
        </p>
      </header>

      {shopifyConnected === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <p className="font-medium">Shopify isn&apos;t connected yet</p>
          <p className="mt-1">
            You can create the campaign now. To pick a product and make gift orders, connect
            Shopify first.{" "}
            <Link href="/settings/connections" className="font-medium underline underline-offset-2">
              Connect Shopify in Settings &gt; Connections
            </Link>
          </p>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="For example: Fall gift box"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <textarea
                id="description"
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="What you're gifting and the kind of creators you want"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-700">{error}</p>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={loading || !name.trim()}>
                {loading ? "Creating…" : "Create campaign"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/campaigns")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
