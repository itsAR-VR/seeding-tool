"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildOnboardingParams } from "./constants";

type Provider = { provider: string; connected: boolean; summary: string };

type Row = {
  key: string;
  title: string;
  what: string;
  connected: boolean;
  status: string;
  href: string;
  action: string;
};

/**
 * Step 3: connect the accounts the tool works through. Each one is optional
 * here; Home keeps reminding until they're done.
 */
export function ConnectStep({ brandName, brandId }: { brandName: string; brandId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const here = `/onboarding?${buildOnboardingParams("connect", { brandName, brandId })}`;
    const connectHref = `/settings/connections?returnTo=${encodeURIComponent(here)}`;
    void Promise.all([
      fetch("/api/connections/overview").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/settings/apify").then((r) => (r.ok ? r.json() : null)),
    ]).then(([overview, apify]: [{ providers?: Provider[] } | null, { hasOwnKey: boolean; usesShared: boolean } | null]) => {
      const find = (p: string) => overview?.providers?.find((x) => x.provider === p);
      const row = (key: string, title: string, what: string): Row => {
        const p = find(key);
        return {
          key,
          title,
          what,
          connected: Boolean(p?.connected),
          status: p?.connected ? p.summary : "Not connected",
          href: connectHref,
          action: "Connect",
        };
      };
      const searchReady = Boolean(apify?.hasOwnKey || apify?.usesShared);
      setRows([
        row("instagram", "Instagram and Meta ads", "Saves posts and stories that tag you, and turns approved ones into ads."),
        row("gmail", "Gmail", "Sends your outreach and brings creator replies into the Inbox."),
        row("shopify", "Shopify", "Creates the gift orders in your store."),
        {
          key: "apify",
          title: "Creator search",
          what: "Finds creators and their emails.",
          connected: searchReady,
          status: apify?.hasOwnKey ? "Using your Apify key" : apify?.usesShared ? "Included" : "Needs your Apify key",
          href: `/settings/creator-search?returnTo=${encodeURIComponent(here)}`,
          action: "Add key",
        },
      ]);
    });
  }, [brandName, brandId]);

  async function finish() {
    setFinishing(true);
    setError("");
    const res = await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandId: brandId || undefined }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Couldn't finish setup. Try again.");
      setFinishing(false);
      return;
    }
    router.push("/dashboard");
  }

  const remaining = rows?.filter((r) => !r.connected).length ?? 0;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-balance">Connect your accounts</h1>
        <p className="max-w-prose text-muted-foreground">
          Seed Scale works through your own accounts, so emails come from you and gifts ship from your store. Connect
          what you can now. Home will remind you about the rest.
        </p>
      </div>

      {rows === null ? (
        <div className="h-72 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-4 px-5 py-4">
              {r.connected ? (
                <CheckCircle2 className="size-5 shrink-0 text-green-700" aria-hidden />
              ) : (
                <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.what}</p>
              </div>
              {r.connected ? (
                <span className="text-sm text-green-800">{r.status}</span>
              ) : (
                <Link href={r.href} className={buttonVariants({ variant: "outline" })}>
                  {r.action}
                  <span className="sr-only"> {r.title}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          onClick={() => router.push(`/onboarding?${buildOnboardingParams("kit", { brandName, brandId })}`)}
          disabled={finishing}
        >
          Back
        </Button>
        <Button onClick={() => void finish()} disabled={finishing || rows === null}>
          {finishing ? "Finishing..." : remaining > 0 ? "Finish, I'll connect the rest later" : "Finish setup"}
        </Button>
      </div>
    </section>
  );
}
