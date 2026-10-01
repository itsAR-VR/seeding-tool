"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/** Paste any creator's partnership ad code to make a paused partnership ad. */
export function PartnershipForm() {
  const router = useRouter();
  const [adCode, setAdCode] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/ads/partnership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adCode, postUrl }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessage({ ok: false, text: data?.error ?? "Couldn't create the ad." });
        return;
      }
      setMessage({ ok: true, text: "Paused partnership ad created." });
      setAdCode("");
      setPostUrl("");
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Couldn't create the ad." });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-md border bg-background px-3 py-2 text-sm";
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="text-sm">
        Creator&apos;s partnership code
        <input value={adCode} onChange={(e) => setAdCode(e.target.value)} placeholder="adcode-..." className={`mt-1 ${field}`} />
      </label>
      <label className="text-sm">
        Post link (optional)
        <input value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://www.instagram.com/p/..." className={`mt-1 ${field}`} />
      </label>
      <Button onClick={() => void submit()} disabled={busy || !adCode.trim()}>
        {busy ? "Creating (up to a minute)..." : "Create paused ad"}
      </Button>
      {message && (
        <p className={`text-sm sm:col-span-3 ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</p>
      )}
    </div>
  );
}
