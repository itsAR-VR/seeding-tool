"use client";

import { useEffect, useRef, useState } from "react";
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
  // Some account checks failed to load; rows show as not connected.
  const [checkFailed, setCheckFailed] = useState(false);
  const finishBusy = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const here = `/onboarding?${buildOnboardingParams("connect", { brandName })}`;
    const connectHref = `/settings/connections?returnTo=${encodeURIComponent(here)}`;
    // Each check can fail on its own (an account's API is down, or we're
    // offline). That must never block finishing setup.
    const load = <T,>(url: string): Promise<T | null> =>
      fetch(url)
        .then((r) => (r.ok ? (r.json() as Promise<T>) : null))
        .catch(() => null);
    void Promise.all([
      load<{ providers?: Provider[] }>("/api/connections/overview"),
      load<{ hasOwnKey: boolean; usesShared: boolean }>("/api/settings/apify"),
    ]).then(([overview, apify]) => {
      if (cancelled) return;
      setCheckFailed(!overview || !apify);
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
    return () => {
      cancelled = true;
    };
  }, [brandName]);

  async function finish() {
    if (finishBusy.current) return;
    finishBusy.current = true;
    setFinishing(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brandId || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Couldn't finish setup. Try again.");
      }
      // replace, so the browser Back button doesn't land on a finished wizard.
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Couldn't reach Seed Scale. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Couldn't finish setup. Try again.",
      );
      finishBusy.current = false;
      setFinishing(false);
    }
  }

  const remaining = rows?.filter((r) => !r.connected).length ?? 0;

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-balance break-words sm:text-3xl">Connect your accounts</h1>
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
            <li key={r.key} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
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
                <span className="min-w-0 break-words text-sm text-green-800">{r.status}</span>
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

      {checkFailed && rows && (
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t check every account just now. You can still finish, and Home will show what&apos;s left.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          onClick={() => router.push(`/onboarding?${buildOnboardingParams("kit", { brandName })}`)}
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
