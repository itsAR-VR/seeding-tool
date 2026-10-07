"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TAP_TARGET_SM } from "@/components/responsive-table";
import { cn } from "@/lib/utils";

type AdCopy = { message: string; headline: string; link: string };

/** Makes a paused partnership ad from a creator's ad code. Works on any post. */
export function PartnershipCodeAction({ postId }: { postId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/content/${postId}/ad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adCode: code }),
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

  const hintId = `partnership-hint-${postId}`;
  if (!open) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-describedby={hintId}
          className="block min-h-11 text-left text-sm text-muted-foreground underline hover:text-foreground md:min-h-0"
        >
          Have a partnership ad code?
        </button>
        <p id={hintId} className="text-sm text-muted-foreground">
          The creator&apos;s code runs the ad from their account. Use it if they sent you one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-2">
      <label className="block text-sm text-muted-foreground">
        Paste the creator&apos;s code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="adcode-..."
          className="mt-1 w-full min-h-11 rounded border bg-background px-2 py-1 text-sm md:min-h-0 text-foreground"
        />
      </label>
      <Button size="sm" className={cn("w-full", TAP_TARGET_SM)} onClick={() => void create()} disabled={busy || !code.trim()}>
        {busy ? "Creating..." : "Create paused partnership ad"}
      </Button>
      <p className="text-sm text-muted-foreground">Runs from their handle and yours. Stays paused until you turn it on.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** Makes a paused Meta ad from an approved post. */
export function AdAction({ postId, defaults }: { postId: string; defaults: AdCopy }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<AdCopy>(defaults);
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
      <Button size="sm" className={cn("w-full", TAP_TARGET_SM)} onClick={() => setOpen(true)}>
        Create ad
      </Button>
    );
  }

  const field = "mt-1 w-full min-h-11 rounded border bg-background px-2 py-1 text-sm md:min-h-0 text-foreground";
  return (
    <div className="space-y-2 rounded-md border p-2">
      <label className="block text-sm text-muted-foreground">
        Ad text
        <textarea
          value={copy.message}
          onChange={(e) => setCopy({ ...copy, message: e.target.value })}
          rows={3}
          className={field}
        />
      </label>
      <label className="block text-sm text-muted-foreground">
        Headline
        <input value={copy.headline} onChange={(e) => setCopy({ ...copy, headline: e.target.value })} className={field} />
      </label>
      <label className="block text-sm text-muted-foreground">
        Link
        <input value={copy.link} onChange={(e) => setCopy({ ...copy, link: e.target.value })} className={field} />
      </label>
      <Button size="sm" className={cn("w-full", TAP_TARGET_SM)} onClick={() => void create()} disabled={busy}>
        {busy ? "Creating (up to a minute)..." : "Create paused ad"}
      </Button>
      <p className="text-sm text-muted-foreground">It stays paused. Nothing spends until you turn it on in Ads Manager.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
