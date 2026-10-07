"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { safeReturnPath } from "@/lib/safe-return-path";

type Status = { hasOwnKey: boolean; usesShared: boolean };

function CreatorSearchSettings() {
  const searchParams = useSearchParams();
  const rawReturn = searchParams.get("returnTo");
  // Only same-site paths, so this can't send people elsewhere.
  const returnTo = safeReturnPath(rawReturn);
  const [status, setStatus] = useState<Status | null>(null);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const [loadFailed, setLoadFailed] = useState(false);

  async function load() {
    const data = await fetch("/api/settings/apify")
      .then((res) => (res.ok ? (res.json() as Promise<Status>) : null))
      .catch(() => null);
    if (data) setStatus(data);
    setLoadFailed(!data);
  }
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/apify")
      .then((res) => (res.ok ? (res.json() as Promise<Status>) : null))
      .catch(() => null)
      .then((data) => {
        if (cancelled) return;
        if (data) setStatus(data);
        setLoadFailed(!data);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/settings/apify", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res) {
      setNotice({ ok: false, text: "Couldn't reach Seed Scale. Check your connection and try again." });
      return;
    }
    if (!res.ok) {
      setNotice({ ok: false, text: data?.error ?? "Couldn't save the key." });
      return;
    }
    setToken("");
    setNotice({ ok: true, text: "Saved. Creator searches now use your own key." });
    await load();
  }

  async function remove() {
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/settings/apify", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setNotice(res?.ok ? { ok: true, text: "Key removed." } : { ok: false, text: "Couldn't remove the key." });
    await load();
  }

  const current = !status
    ? loadFailed
      ? "Couldn't load this. Refresh the page to try again."
      : "Loading..."
    : status.hasOwnKey
      ? "Searches use your own key, so they come out of your Apify account."
      : status.usesShared
        ? "Creator search is included. Seed Scale covers your searches."
        : "Not set up yet. Add a key below to find creators.";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Creator search</h1>
        <p className="mt-1 text-muted-foreground">
          Finding creators and their emails uses your search allowance. Each search uses a little of it.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border bg-card p-5">
        <p className="font-medium">{current}</p>
        {status?.usesShared && !status.hasOwnKey && (
          <p className="text-sm text-muted-foreground">You don&apos;t need to do anything. A key is only for running searches on your own account.</p>
        )}
        <details open={!status || status.hasOwnKey || !status.usesShared} className="group">
          {status?.usesShared && !status.hasOwnKey && (
            <summary className="cursor-pointer text-sm font-medium underline">Use your own search key instead</summary>
          )}
        <form onSubmit={(e) => void save(e)} className="mt-3 space-y-3">
          <label className="block text-sm font-medium">
            {status?.hasOwnKey ? "Replace your search account key (from Apify)" : "Your search account key (from Apify)"}
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="apify_api_..."
              autoComplete="off"
              className="mt-1 w-full min-w-0 rounded-lg border px-3 py-2"
            />
            <span className="mt-1 block text-sm text-muted-foreground">
              This key lets creator search run on your own account, so searches come out of your Apify account. To find it, open Apify, go to Settings, then API &amp; Integrations, and copy your personal token.
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={busy || !token.trim()}
              aria-describedby={!busy && !token.trim() ? "save-key-hint" : undefined}
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
          {!busy && !token.trim() && (
            <p id="save-key-hint" className="text-sm text-muted-foreground">
              Paste your key above to save it
            </p>
          )}
        </form>
        </details>
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
