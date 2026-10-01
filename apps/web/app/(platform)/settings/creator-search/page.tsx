"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type Status = { hasOwnKey: boolean; usesShared: boolean };

function CreatorSearchSettings() {
  const searchParams = useSearchParams();
  const rawReturn = searchParams.get("returnTo");
  // Only same-site paths, so this can't send people elsewhere.
  const returnTo = rawReturn?.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : null;
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    const res = await fetch("/api/settings/apify");
    if (res.ok) setStatus((await res.json()) as Status);
  }
  useEffect(() => {
    void fetch("/api/settings/apify")
      .then((res) => (res.ok ? (res.json() as Promise<Status>) : null))
      .then((data) => data && setStatus(data));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/settings/apify", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setNotice({ ok: false, text: data?.error ?? "Couldn't save the key." });
      return;
    }
    setToken("");
    setNotice({ ok: true, text: "Saved. Creator searches now use your Apify account." });
    await load();
  }

  async function remove() {
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/settings/apify", { method: "DELETE" });
    setBusy(false);
    setNotice(res.ok ? { ok: true, text: "Key removed." } : { ok: false, text: "Couldn't remove the key." });
    await load();
  }

  const current = !status
    ? "Loading..."
    : status.hasOwnKey
      ? "Searches use your own Apify account."
      : status.usesShared
        ? "Searches use Seed Scale's shared Apify account. Add your own key any time."
        : "Not set up yet. Add your Apify key to find creators.";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Creator search</h1>
        <p className="mt-1 text-muted-foreground">
          Finding creators and their emails runs on Apify. Searches are billed to your Apify account.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <p className="font-medium">{current}</p>
        <form onSubmit={(e) => void save(e)} className="space-y-3">
          <label className="block text-sm font-medium">
            {status?.hasOwnKey ? "Replace your Apify API key" : "Your Apify API key"}
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="apify_api_..."
              autoComplete="off"
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
            <span className="mt-1 block text-sm text-muted-foreground">
              In Apify, go to Settings, then API &amp; Integrations, and copy your personal API token.
            </span>
          </label>
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={busy || !token.trim()}
              className="rounded-lg bg-foreground px-5 py-2 font-medium text-background disabled:opacity-50"
            >
              {busy ? "Checking..." : "Save key"}
            </button>
            {status?.hasOwnKey && (
              <button type="button" disabled={busy} onClick={() => void remove()} className="text-sm font-medium underline">
                Remove key
              </button>
            )}
          </div>
        </form>
        {notice && <p className={`text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>}
      </section>

      {returnTo && (
        <Link href={returnTo} className="inline-block font-medium underline">
          Back to setup
        </Link>
      )}
    </div>
  );
}

export default function CreatorSearchSettingsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <CreatorSearchSettings />
    </Suspense>
  );
}
