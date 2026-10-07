"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Allow emails again" with an inline confirm. */
export function AllowAgain({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function allow() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/settings/do-not-send/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? "Couldn't change that. Try again.");
      return;
    }
    router.refresh();
  }

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="min-h-11 text-sm font-medium underline md:min-h-9">
        Allow emails again
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      Email {name} again?
      <button type="button" disabled={busy} onClick={() => void allow()} className="min-h-11 font-medium underline md:min-h-9">
        {busy ? "Saving..." : "Yes, allow"}
      </button>
      <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="min-h-11 underline md:min-h-9">
        Keep blocked
      </button>
      {error && <span role="alert" className="text-destructive">{error}</span>}
    </span>
  );
}
