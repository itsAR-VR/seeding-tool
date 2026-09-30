"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const DEFAULT_COPY = {
  message:
    "Kalm mouth tape helps you breathe through your nose while you sleep, so you wake up more rested.",
  headline: "Support better sleep, naturally",
  link: "https://sleepkalm.com/products/mouth-tape",
};

/** Makes a paused Meta ad from an approved post. */
export function AdAction({ postId }: { postId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState(DEFAULT_COPY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/${postId}/ad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Couldn't create the ad.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't create the ad.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" className="w-full" onClick={() => setOpen(true)}>
        Create ad
      </Button>
    );
  }

  const field = "mt-1 w-full rounded border bg-background px-2 py-1 text-xs text-foreground";
  return (
    <div className="space-y-2 rounded-md border p-2">
      <label className="block text-xs text-muted-foreground">
        Ad text
        <textarea
          value={copy.message}
          onChange={(e) => setCopy({ ...copy, message: e.target.value })}
          rows={3}
          className={field}
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Headline
        <input value={copy.headline} onChange={(e) => setCopy({ ...copy, headline: e.target.value })} className={field} />
      </label>
      <label className="block text-xs text-muted-foreground">
        Link
        <input value={copy.link} onChange={(e) => setCopy({ ...copy, link: e.target.value })} className={field} />
      </label>
      <Button size="sm" className="w-full" onClick={() => void create()} disabled={busy}>
        {busy ? "Creating (up to a minute)..." : "Create paused ad"}
      </Button>
      <p className="text-xs text-muted-foreground">It stays paused. Nothing spends until you turn it on in Ads Manager.</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
